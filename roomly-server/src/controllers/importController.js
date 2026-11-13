import mongoose from 'mongoose'
import { ChatImport } from '../models/ChatImport.js'
import { ImportedMessage } from '../models/ImportedMessage.js'
import { Expense } from '../models/Expense.js'
import { parseWhatsAppExport } from '../services/whatsapp/exportParser.js'
import { CATEGORY_IDS } from '../constants.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { isMonthClosed } from '../services/settlementService.js'
import { monthOf } from '../utils/date.js'
import { publish } from '../services/events.js'

const MAX_EXPORT_CHARS = 10 * 1024 * 1024
const publicMessage = (message) => ({
  id: String(message._id), sender: message.sender, senderMemberId: message.senderMemberId ? String(message.senderMemberId) : null,
  sentAt: message.sentAt, text: message.text, parsed: message.parsed, status: message.status,
})

export const uploadWhatsAppExport = asyncHandler(async (req, res) => {
  const { content, filename = 'WhatsApp Chat.txt' } = req.body ?? {}
  if (typeof content !== 'string' || !content.trim()) throw ApiError.invalid('Upload a non-empty WhatsApp .txt or .md chat export.')
  if (typeof filename !== 'string') throw ApiError.invalid('Choose a valid .txt or .md filename.')
  if (content.length > MAX_EXPORT_CHARS) throw ApiError.invalid('This export is too large. The maximum supported size is 10 MB.')
  if (!/\.txt$/i.test(filename)) throw ApiError.invalid('Please upload a WhatsApp .txt export.')

  const batch = await ChatImport.create({
    householdId: req.household._id, uploadedBy: req.user._id, filename: filename.slice(0, 180),
  })
  const parsedMessages = parseWhatsAppExport(content, req.household._id)
  const memberByName = new Map(req.household.members.map((m) => [m.name.trim().toLowerCase(), m._id]))
  let duplicates = 0, newMessages = 0, candidates = 0, ignored = 0
  for (const item of parsedMessages) {
    const expenseCandidate = item.parsed.kind === 'expense'
    const status = expenseCandidate ? 'pending' : 'ignored'
    const doc = {
      householdId: req.household._id, importId: batch._id, fingerprint: item.fingerprint,
      sender: item.sender, senderMemberId: memberByName.get(item.sender.toLowerCase()) ?? null,
      sentAt: item.sentAt, ...(expenseCandidate ? { text: item.text.slice(0, 1000), parsed: item.parsed } : {}),
      status,
    }
    try {
      await ImportedMessage.create(doc)
      newMessages++
      if (expenseCandidate) candidates++
      else ignored++
    } catch (error) {
      if (error?.code === 11000) { duplicates++; continue }
      throw error
    }
  }
  batch.stats = { total: parsedMessages.length, newMessages, duplicates, candidates, ignored, approved: 0, rejected: 0 }
  if (candidates === 0) batch.status = 'completed'
  await batch.save()
  res.status(201).json({
    import: { id: String(batch._id), filename: batch.filename, status: batch.status, stats: batch.stats },
    messages: (await ImportedMessage.find({ importId: batch._id, status: 'pending' }).sort({ sentAt: 1 }).lean()).map(publicMessage),
  })
})

export const getImportReview = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Import not found.')
  const batch = await ChatImport.findOne({ _id: req.params.id, householdId: req.household._id }).lean()
  if (!batch) throw ApiError.notFound('Import not found.')
  const messages = await ImportedMessage.find({ importId: batch._id, status: 'pending' }).sort({ sentAt: 1 }).lean()
  res.json({ import: { id: String(batch._id), filename: batch.filename, status: batch.status, stats: batch.stats }, messages: messages.map(publicMessage), members: req.household.members.map((m) => ({ id: String(m._id), name: m.name })) })
})

export const approveImportMessages = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Import not found.')
  const batch = await ChatImport.findOne({ _id: req.params.id, householdId: req.household._id })
  if (!batch) throw ApiError.notFound('Import not found.')
  const decisions = Array.isArray(req.body?.decisions) ? req.body.decisions : []
  if (!decisions.length || decisions.length > 500) throw ApiError.invalid('Choose at least one expense to review.')
  let approved = 0, rejected = 0
  for (const decision of decisions) {
    if (!['approve', 'reject'].includes(decision.action)) throw ApiError.invalid('Choose approve or reject for each message.')
    const message = await ImportedMessage.findOne({ _id: decision.messageId, importId: batch._id, householdId: req.household._id, status: 'pending' })
    if (!message) continue
    if (decision.action === 'reject') {
      message.status = 'rejected'
      await message.save()
      rejected++
      continue
    }
    const member = req.household.members.id(decision.paidBy || message.senderMemberId)
    if (!member) throw ApiError.invalid(`Map “${message.sender}” to a household member before approving.`)
    const amount = Number(decision.amount ?? message.parsed?.amount)
    const title = String(decision.title ?? message.parsed?.title ?? '').trim()
    const category = decision.category ?? message.parsed?.category ?? 'other'
    const sentAt = new Date(message.sentAt)
    const date = new Date(sentAt.getTime() + Number(message.parsed?.dayOffset ?? 0) * 86400000).toISOString().slice(0, 10)
    if (!Number.isInteger(amount) || amount < 1 || amount > 500000 || !title || title.length > 80 || !CATEGORY_IDS.includes(category)) throw ApiError.invalid('Check the expense amount, description and category.')
    if (await isMonthClosed(req.household, monthOf(date))) throw ApiError.conflict('That expense belongs to a settled month. Reopen the month before importing it.')
    const expense = await Expense.create({
      householdId: req.household._id, title, amount, category, paidBy: member._id, date,
      note: 'Imported from WhatsApp chat', createdBy: req.user._id, source: 'whatsapp',
      whatsappMessageId: `import:${message._id}`,
    })
    message.senderMemberId = member._id
    message.status = 'approved'
    message.expenseId = expense._id
    await message.save()
    approved++
    publish(req.household._id, { type: 'expense.created', id: String(expense._id), by: String(req.user._id), source: 'whatsapp', title, amount, category })
  }
  batch.stats.approved += approved
  batch.stats.rejected += rejected
  const pending = await ImportedMessage.countDocuments({ importId: batch._id, status: 'pending' })
  if (pending === 0) batch.status = 'completed'
  await batch.save()
  res.json({ approved, rejected, pending, status: batch.status, stats: batch.stats })
})

export const listImports = asyncHandler(async (req, res) => {
  const batches = await ChatImport.find({ householdId: req.household._id }).sort({ createdAt: -1 }).limit(50).lean()
  res.json(batches.map((batch) => ({ id: String(batch._id), filename: batch.filename, status: batch.status, stats: batch.stats, createdAt: batch.createdAt })))
})
