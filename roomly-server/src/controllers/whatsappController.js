import crypto from 'node:crypto'
import { WhatsappGroup, WhatsappLink, WhatsappMessage } from '../models/Whatsapp.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { publish } from '../services/events.js'
import { createGroup, deleteGroup, resetInviteLink } from '../services/whatsapp/groups.js'
import { createLinkCode, unlinkUser } from '../services/whatsapp/linking.js'
import { parseMessage, shouldRecord } from '../services/whatsapp/parser.js'
import { handleInboundMessage } from '../services/whatsapp/processor.js'
import { buildStatus } from '../services/whatsapp/status.js'

const ctx = (req) => ({ user: req.user, household: req.household, member: req.member })
const requireEnabled = () => { if (!env.whatsapp.enabled) throw new ApiError(503, 'WhatsApp isn’t set up on this server yet.') }

export const status = asyncHandler(async (req, res) => res.json(await buildStatus(ctx(req))))

export const linkCode = asyncHandler(async (req, res) => {
  requireEnabled()
  res.json(await createLinkCode(req.user._id))
})

export const unlink = asyncHandler(async (req, res) => {
  await unlinkUser(req.user._id)
  publish(req.household._id, { type: 'whatsapp.updated', by: String(req.user._id) })
  res.json({ ok: true })
})

export const group = {
  create: asyncHandler(async (req, res) => {
    requireEnabled()
    await createGroup({ household: req.household, user: req.user })
    publish(req.household._id, { type: 'whatsapp.updated' })
    res.status(201).json(await buildStatus(ctx(req)))
  }),
  remove: asyncHandler(async (req, res) => {
    await deleteGroup({ household: req.household })
    publish(req.household._id, { type: 'whatsapp.updated' })
    res.json(await buildStatus(ctx(req)))
  }),
  resetInvite: asyncHandler(async (req, res) => {
    await resetInviteLink({ household: req.household })
    res.json(await buildStatus(ctx(req)))
  }),
}

export const settings = asyncHandler(async (req, res) => {
  req.household.whatsappAutoReply = req.body.autoReply
  await req.household.save()
  res.json(await buildStatus(ctx(req)))
})

export const activity = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10))
  const rows = await WhatsappMessage.find({ householdId: req.household._id, outcome: { $in: ['expense', 'undo', 'link'] } }).sort({ createdAt: -1 }).limit(limit).lean()
  res.json(rows.map((r) => ({
    id: String(r._id), at: r.createdAt.toISOString(), outcome: r.outcome, via: r.via ?? 'dm', memberId: r.userId ? String(r.userId) : null,
    ...(r.text ? { text: r.text } : {}), ...(r.amount ? { amount: r.amount } : {}), ...(r.expenseId ? { expenseId: String(r.expenseId) } : {}),
  })))
})

/** What would the bot do with this message? Same parser as the webhook — no side effects. */
export const parse = (req, res) => {
  const r = parseMessage(req.body.text)
  const context = req.body.context === 'group' ? 'group' : 'dm'
  if (r.kind === 'expense') return res.json({ kind: 'expense', amount: r.amount, title: r.title, category: r.category, dayOffset: r.dayOffset, confidence: r.confidence, wouldRecord: shouldRecord(r, context) })
  if (r.kind === 'command') return res.json({ kind: 'command', command: r.command, wouldRecord: false })
  res.json({ kind: 'ignore', reason: r.reason, wouldRecord: false })
}

/**
 * Development only (WHATSAPP_SIMULATOR=true, never in production): feeds a fake message through the
 * REAL processor as if a housemate had sent it, and returns what the bot would have replied.
 */
export const simulate = asyncHandler(async (req, res) => {
  if (!env.whatsapp.simulator) throw ApiError.notFound()
  const { as, text, context } = req.body
  const member = req.household.members.id(as)
  if (!member) throw ApiError.invalid('Pick a household member.')

  const link = await WhatsappLink.findOne({ userId: member._id })
  const waId = link?.waId ?? `9199${String(parseInt(String(member._id).slice(-7), 16) % 1e8).padStart(8, '0')}`
  const msg = { from: waId, id: `wamid.SIM${crypto.randomBytes(8).toString('hex')}`, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }
  if (context === 'group') {
    const g = await WhatsappGroup.findOne({ householdId: req.household._id, status: 'active' })
    if (!g?.groupId) throw ApiError.conflict('Create the WhatsApp group first.')
    msg.group_id = g.groupId
  }
  const replies = []
  const outcome = await handleInboundMessage({ msg, name: member.name, send: async ({ text: t }) => { replies.push(t); return true } })
  res.json({ outcome, replies })
})
