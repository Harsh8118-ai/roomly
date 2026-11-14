import { ChatImport } from '../models/ChatImport.js'
import { ImportedMessage } from '../models/ImportedMessage.js'
import { Expense } from '../models/Expense.js'
import { parseWhatsAppExport, detectWhatsAppDateFormat } from '../services/whatsapp/exportParser.js'
import { CATEGORY_IDS, MAX_MEMBERS } from '../constants.js'
import { nextTone } from '../services/householdService.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { isMonthClosed } from '../services/settlementService.js'
import { monthOf } from '../utils/date.js'
import { publish } from '../services/events.js'

const MAX_EXPORT_CHARS = 10 * 1024 * 1024
function normalizeSender(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim()
}

function senderDisplayName(value) {
  return String(value ?? '').normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, '')
    .replace(/\s+/g, ' ').trim().slice(0, 60)
}

function isSwappedMonthDay(existingDate, incomingDate) {
  const oldDate = new Date(existingDate)
  const newDate = new Date(incomingDate)
  return oldDate.getFullYear() === newDate.getFullYear()
    && oldDate.getMonth() + 1 === newDate.getDate()
    && oldDate.getDate() === newDate.getMonth() + 1
}

function resolveSenderMember(household, sender) {
  const key = normalizeSender(sender)
  if (!key) return null
  const existing = household.members.find((member) => normalizeSender(member.name) === key)
  if (existing) return existing
  const name = senderDisplayName(sender)
  if (!name || !/\p{L}/u.test(name) || household.members.length >= MAX_MEMBERS) return null
  household.members.push({ name, role: 'member', status: 'active', tone: nextTone(household) })
  return household.members[household.members.length - 1]
}

async function createImportedExpense({ household, user, message, memberId }) {
  const amount = Number(message.parsed?.amount)
  const title = String(message.parsed?.title ?? '').trim()
  const category = CATEGORY_IDS.includes(message.parsed?.category) ? message.parsed.category : 'other'
  const sentAt = new Date(message.sentAt)
  const date = new Date(sentAt.getTime() + Number(message.parsed?.dayOffset ?? 0) * 86400000).toISOString().slice(0, 10)
  if (!Number.isInteger(amount) || amount < 1 || amount > 500000 || !title || title.length > 80) return { invalid: true }
  if (await isMonthClosed(household, monthOf(date))) return { closed: true }
  const whatsappMessageId = 'import:' + message._id
  // Idempotency guard: a retried import must never create a second expense
  // for an ImportedMessage, even if the request was interrupted after Expense.create.
  let expense = await Expense.findOne({ whatsappMessageId })
  let createdNow = false
  if (!expense) {
    try {
      expense = await Expense.create({
        householdId: household._id, title, amount, category, paidBy: memberId, date,
        note: 'Imported from WhatsApp chat', createdBy: user._id, source: 'whatsapp',
        whatsappMessageId,
      })
      createdNow = true
    } catch (error) {
      if (error?.code !== 11000) throw error
      expense = await Expense.findOne({ whatsappMessageId })
      if (!expense) throw error
    }
  }
  message.status = 'approved'
  message.senderMemberId = memberId
  message.expenseId = expense._id
  await message.save()
  if (createdNow) {
    publish(household._id, { type: 'expense.created', id: String(expense._id), by: String(user._id), source: 'whatsapp', title, amount, category })
  }
  return { expense }
}

export const previewWhatsAppExport = asyncHandler(async (req, res) => {
  const { content } = req.body ?? {}
  if (typeof content !== 'string' || !content.trim()) throw ApiError.invalid('Upload a non-empty WhatsApp chat export.')
  if (content.length > MAX_EXPORT_CHARS) throw ApiError.invalid('This export is too large. The maximum supported size is 10 MB.')
  const parsed = parseWhatsAppExport(content, req.household._id)
  const senders = [...new Set(parsed.filter((item) => item.parsed.kind === 'expense').map((item) => item.sender))]
  res.json({ senders, candidates: parsed.filter((item) => item.parsed.kind === 'expense').length, dateFormat: detectWhatsAppDateFormat(content) })
})

export const uploadWhatsAppExport = asyncHandler(async (req, res) => {
  const { content, filename = 'WhatsApp Chat.txt', senderMappings = [], selfSender = '', separateMemberName = '', dateOrder } = req.body ?? {}
  if (typeof content !== 'string' || !content.trim()) throw ApiError.invalid('Upload a non-empty WhatsApp .txt or .md chat export.')
  if (typeof filename !== 'string' || !/\.(txt|md)$/i.test(filename)) throw ApiError.invalid('Please upload a WhatsApp .txt or .md export.')
  if (content.length > MAX_EXPORT_CHARS) throw ApiError.invalid('This export is too large. The maximum supported size is 10 MB.')

  if (!Array.isArray(senderMappings) || senderMappings.some((item) => !item || typeof item.sender !== 'string')) throw ApiError.invalid('Invalid sender mapping.')
  if (typeof separateMemberName !== 'string') throw ApiError.invalid('Enter a valid member name.')
  if (dateOrder != null && dateOrder !== 'MDY' && dateOrder !== 'DMY') throw ApiError.invalid('Invalid date format.')
  const mappingBySender = new Map(senderMappings.map((mapping) => [normalizeSender(mapping.sender), mapping]))
  if (separateMemberName.trim()) {
    const separateName = senderDisplayName(separateMemberName)
    if (!separateName || !/\p{L}/u.test(separateName)) throw ApiError.invalid('Enter a valid member name.')
    if (req.household.members.length >= MAX_MEMBERS) throw ApiError.invalid(`A household can have up to ${MAX_MEMBERS} members.`)
    req.household.members.push({ name: separateName, role: 'member', status: 'active', tone: nextTone(req.household) })
    await req.household.save()
  }
  const batch = await ChatImport.create({
    householdId: req.household._id, uploadedBy: req.user._id, filename: filename.slice(0, 180),
    status: 'completed',
  })
  const detectedDateFormat = detectWhatsAppDateFormat(content)
  const parsedMessages = parseWhatsAppExport(content, req.household._id, { dateOrder: dateOrder ?? detectedDateFormat.dateOrder ?? 'DMY' })
  let duplicates = 0, newMessages = 0, imported = 0, ignored = 0, unmatched = 0
  for (const item of parsedMessages) {
    const isExpense = item.parsed.kind === 'expense'
    const mapping = mappingBySender.get(normalizeSender(item.sender))
    let member = null
    if (isExpense) {
      if (selfSender && normalizeSender(item.sender) === normalizeSender(selfSender)) member = req.member
      else if (mapping?.memberId && req.household.members.id(mapping.memberId)) member = req.household.members.id(mapping.memberId)
      else if (mapping?.name) {
        const key = normalizeSender(mapping.name)
        member = req.household.members.find((m) => normalizeSender(m.name) === key)
        if (!member && req.household.members.length < MAX_MEMBERS) {
          req.household.members.push({ name: senderDisplayName(mapping.name), role: 'member', status: 'active', tone: nextTone(req.household) })
          member = req.household.members[req.household.members.length - 1]
        }
      } else member = resolveSenderMember(req.household, item.sender)
    }
    if (req.household.isModified('members')) await req.household.save()
    const senderMemberId = member?._id ?? null
    const status = isExpense ? (senderMemberId ? 'approved' : 'pending') : 'ignored'
    // Repair legacy records created when an ambiguous date was previously
    // interpreted in the opposite month/day order. Match only the same sender,
    // exact message text, year, and swapped calendar components.
    if (isExpense) {
      const legacy = await ImportedMessage.findOne({
        householdId: req.household._id,
        sender: item.sender,
        text: item.text.slice(0, 1000),
        status: 'approved',
      })
      if (legacy && isSwappedMonthDay(legacy.sentAt, item.sentAt)) {
        const legacyExpense = legacy.expenseId
          ? await Expense.findOne({ _id: legacy.expenseId, householdId: req.household._id })
          : null
        legacy.sentAt = item.sentAt
        legacy.fingerprint = item.fingerprint
        legacy.parsed = item.parsed
        await legacy.save()
        if (legacyExpense) {
          const correctedDate = new Date(item.sentAt.getTime() + Number(item.parsed?.dayOffset ?? 0) * 86400000)
          legacyExpense.date = correctedDate.toISOString().slice(0, 10)
          await legacyExpense.save()
        }
        duplicates++
        continue
      }
    }

    // Check the household's import ledger before attempting an insert. This also
    // protects installations where MongoDB's unique index was not present yet.
    const previouslyImported = await ImportedMessage.findOne({
      householdId: req.household._id,
      fingerprint: item.fingerprint,
    })
    if (previouslyImported) {
      duplicates++
      // Recover a previously interrupted pending message only when a valid member
      // mapping is now available. Approved/ignored records are never re-created.
      if (isExpense && previouslyImported.status === 'pending' && senderMemberId) {
        previouslyImported.senderMemberId = senderMemberId
        const recovered = await createImportedExpense({
          household: req.household, user: req.user, message: previouslyImported, memberId: senderMemberId,
        })
        if (recovered.expense) {
          duplicates--
          imported++
          await ChatImport.updateOne({ _id: previouslyImported.importId }, { $inc: { 'stats.approved': 1, 'stats.unmatched': -1 } })
        } else if (recovered.invalid) {
          previouslyImported.status = 'ignored'
          await previouslyImported.save()
          ignored++
        } else if (recovered.closed) unmatched++
      }
      continue
    }

    const doc = {
      householdId: req.household._id, importId: batch._id, fingerprint: item.fingerprint,
      sender: item.sender, senderMemberId,
      sentAt: item.sentAt, text: item.text.slice(0, 1000),
      ...(isExpense ? { parsed: item.parsed } : {}),
      status,
    }
    let message
    try {
      message = await ImportedMessage.create(doc)
      newMessages++
    } catch (error) {
      if (error?.code !== 11000) throw error
      duplicates++
      // A previous import may have stored this as unmatched/pending. Retry it now
      // that the sender can be mapped to a household member.
      message = await ImportedMessage.findOne({ householdId: req.household._id, fingerprint: item.fingerprint })
      if (!message || !isExpense || message.status !== 'pending' || !senderMemberId) continue
      message.senderMemberId = senderMemberId
      const recovered = await createImportedExpense({ household: req.household, user: req.user, message, memberId: senderMemberId }).catch(async (expenseError) => {
        if (expenseError?.code === 11000) {
          const existingExpense = await Expense.findOne({ whatsappMessageId: 'import:' + message._id })
          if (existingExpense) {
            message.status = 'approved'
            message.expenseId = existingExpense._id
            await message.save()
            return { expense: existingExpense }
          }
        }
        throw expenseError
      })
      if (recovered.expense) {
        duplicates--
        imported++
        await ChatImport.updateOne({ _id: message.importId }, { $inc: { 'stats.approved': 1, 'stats.unmatched': -1 } })
      } else if (recovered.invalid) {
        message.status = 'ignored'; await message.save(); ignored++
      } else if (recovered.closed) {
        unmatched++
      }
      continue
    }

    if (!isExpense) { ignored++; continue }
    if (!senderMemberId) { unmatched++; continue }
    const created = await createImportedExpense({ household: req.household, user: req.user, message, memberId: senderMemberId })
    if (created.expense) imported++
    else if (created.invalid) { message.status = 'ignored'; await message.save(); ignored++ }
    else if (created.closed) { message.status = 'pending'; await message.save(); unmatched++ }
  }
  batch.stats = {
    total: parsedMessages.length, newMessages, duplicates,
    candidates: parsedMessages.filter((item) => item.parsed.kind === 'expense').length,
    ignored, approved: imported, rejected: 0, unmatched,
  }
  await batch.save()
  res.status(201).json({
    import: { id: String(batch._id), filename: batch.filename, status: batch.status, stats: batch.stats },
    messages: [],
  })
})

export const listImports = asyncHandler(async (req, res) => {
  const batches = await ChatImport.find({ householdId: req.household._id }).sort({ createdAt: -1 }).limit(50).lean()
  res.json(batches.map((batch) => ({ id: String(batch._id), filename: batch.filename, status: batch.status, stats: batch.stats, createdAt: batch.createdAt })))
})
