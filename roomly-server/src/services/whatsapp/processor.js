import { Household } from '../../models/Household.js'
import { User } from '../../models/User.js'
import { WhatsappGroup, WhatsappLink, WhatsappMessage } from '../../models/Whatsapp.js'
import { env } from '../../config/env.js'
import { currentMonth, monthName } from '../../utils/date.js'
import { firstName } from '../../utils/format.js'
import { getSettlement } from '../settlementService.js'
import { publish } from '../events.js'
import { applyGroupChange } from './groups.js'
import { normalizeWaId, redeemLinkCode } from './linking.js'
import { parseMessage, shouldRecord } from './parser.js'
import { looksLikeTransfer, recordExpense, undoLast } from './recorder.js'
import { replies } from './replies.js'
import { sendText } from './client.js'

// Don't nag the same stranger in a group more than once in a while.
const hinted = new Map()
const HINT_COOLDOWN_MS = 6 * 60 * 60_000
export const __resetHints = () => hinted.clear()

/**
 * Handles ONE inbound message. Returns { outcome, ... } describing what happened.
 * Outcomes are stored per message id so Meta's retries are no-ops.
 */
async function route({ msg, name, send }) {
  const isGroup = Boolean(msg.group_id)
  const via = isGroup ? 'group' : 'dm'
  const waId = normalizeWaId(msg.from)
  const text = String(msg.text?.body ?? '')
  const sentAt = new Date((Number(msg.timestamp) || Date.now() / 1000) * 1000)
  const parsed = parseMessage(text)
  const say = (body) => send({ to: isGroup ? msg.group_id : waId, group: isGroup, text: body })

  let household = null
  if (isGroup) {
    const group = await WhatsappGroup.findOne({ groupId: msg.group_id, status: { $in: ['creating', 'active', 'suspended'] } })
    household = group && await Household.findById(group.householdId)
    if (!household) return { outcome: 'unknown-group', via } // a group we didn't create — never read it
  }

  // Linking happens in a private chat, before we know who the sender is.
  if (parsed.kind === 'command' && parsed.command === 'link') {
    if (isGroup) { await say(replies.linkInGroup); return { outcome: 'link-in-group', via } }
    const res = await redeemLinkCode({ waId, name, code: parsed.arg })
    if (res.ok) {
      const user = await User.findById(res.userId)
      await say(replies.linked(firstName(user.name)))
      const hid = user.currentHouseholdId
      if (hid) publish(hid, { type: 'whatsapp.updated', by: String(user._id) })
      return { outcome: 'link', via, userId: user._id, householdId: hid }
    }
    await say(res.reason === 'rate' ? replies.linkRateLimited : res.reason === 'taken' ? replies.linkTaken : replies.linkFailed)
    return { outcome: `link-${res.reason}`, via }
  }

  const link = await WhatsappLink.findOne({ waId })
  const actionable = parsed.kind === 'command' || shouldRecord(parsed, via)
  if (!link) {
    if (!actionable) return { outcome: 'ignored', via }
    if (!isGroup) { await say(replies.unlinkedDm); return { outcome: 'unlinked', via } }
    const last = hinted.get(waId) ?? 0
    if (Date.now() - last > HINT_COOLDOWN_MS) { hinted.set(waId, Date.now()); await say(replies.unlinkedGroup(firstName(name ?? 'Hi'))) }
    return { outcome: 'unlinked', via }
  }

  const user = await User.findById(link.userId)
  if (!user) return { outcome: 'ignored', via }
  if (!isGroup) household = user.currentHouseholdId ? await Household.findById(user.currentHouseholdId) : null
  const member = household?.members.id(user._id)
  if (!household || !member) {
    if (!isGroup && actionable) await say(replies.noHousehold)
    return { outcome: 'not-a-member', via }
  }
  const base = { via, userId: user._id, householdId: household._id }
  const confirm = (body) => (isGroup && !household.whatsappAutoReply ? null : say(body))

  if (parsed.kind === 'command') {
    switch (parsed.command) {
      case 'help': await say(replies.help); return { outcome: 'help', ...base }
      case 'balance': {
        const s = await getSettlement(household, currentMonth())
        await say(replies.balance(s.members.find((m) => m.memberId === String(user._id))?.balance ?? 0))
        return { outcome: 'balance', ...base }
      }
      case 'total': {
        const s = await getSettlement(household, currentMonth())
        await say(replies.total({ month: monthName(currentMonth()), total: s.total, count: s.expenseCount }))
        return { outcome: 'total', ...base }
      }
      case 'undo': {
        const r = await undoLast({ household, user })
        if (r.status === 'none') { await say(replies.undoNone); return { outcome: 'undo-none', ...base } }
        if (r.status === 'closed') { await say(replies.undoClosed(r.month)); return { outcome: 'closed', ...base } }
        await say(replies.undone({ title: r.expense.title, amount: r.expense.amount }))
        return { outcome: 'undo', ...base, text: r.expense.title, amount: r.expense.amount }
      }
      default: return { outcome: 'ignored', ...base }
    }
  }

  if (!shouldRecord(parsed, via) || looksLikeTransfer(household, parsed.title)) return { outcome: 'ignored', ...base }

  const r = await recordExpense({ household, user, parsed, wamid: msg.id, sentAt })
  if (r.status === 'closed') { await say(replies.closed(r.month)); return { outcome: 'closed', ...base } }
  await confirm(replies.added({ amount: r.expense.amount, category: r.expense.category, name: firstName(member.name), dm: !isGroup }))
  return { outcome: 'expense', ...base, text: text.slice(0, 80), amount: r.expense.amount, expenseId: r.expense._id }
}

export async function handleInboundMessage({ msg, name, send = sendText }) {
  if (msg.type !== 'text' || !msg.text?.body || !msg.id) return 'unsupported'
  try {
    await WhatsappMessage.create({ wamid: msg.id, outcome: 'processing' })
  } catch (e) {
    if (e?.code === 11000) return 'duplicate' // Meta retried; already handled
    throw e
  }
  try {
    const { outcome, via, userId, householdId, text, amount, expenseId } = await route({ msg, name, send })
    await WhatsappMessage.updateOne({ wamid: msg.id }, { $set: { outcome, via, userId, householdId, text, amount, expenseId } })
    return outcome
  } catch (e) {
    // Let Meta retry: forget the marker so the retry is processed instead of skipped.
    await WhatsappMessage.deleteOne({ wamid: msg.id, outcome: 'processing' }).catch(() => {})
    throw e
  }
}

/** Entry point for everything Meta posts to the webhook. */
export async function handleWebhookPayload(payload, { send = sendText } = {}) {
  const outcomes = []
  for (const entry of payload?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const { field, value } = change
      // Only act on events for OUR number.
      const pid = value?.metadata?.phone_number_id
      if (pid && env.whatsapp.phoneNumberId && pid !== env.whatsapp.phoneNumberId) continue

      if (field === 'messages') {
        const names = new Map((value.contacts ?? []).map((c) => [normalizeWaId(c.wa_id), c.profile?.name]))
        for (const msg of value.messages ?? []) outcomes.push(await handleInboundMessage({ msg, name: names.get(normalizeWaId(msg.from)), send }))
      } else if (typeof field === 'string' && field.startsWith('group_')) {
        await applyGroupChange(field, value)
        outcomes.push(field)
      }
    }
  }
  return outcomes
}
