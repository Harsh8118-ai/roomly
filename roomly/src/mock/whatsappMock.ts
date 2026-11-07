/**
 * Browser-side imitation of the server's WhatsApp feature, so the whole flow
 * (link a number, create a group, text an expense, watch it appear) works in demo mode.
 * It runs the same parser the real bot uses.
 */
import { parseMessage, shouldRecord } from '@/utils/whatsappParser'
import type {
  CategoryId, Expense, Household, LiveEvent, MonthKey, Settlement, WhatsAppActivity, WhatsAppLinkCode, WhatsAppPreview, WhatsAppStatus,
} from '@/types'
import { ApiError } from '@/utils/errors'
import { addDays, currentMonth, monthLabel, monthOf, todayISO } from '@/utils/date'
import { formatINR } from '@/utils/format'
import { uid } from '@/utils/id'
import { CATEGORY_MAP } from '@/constants/categories'
import { getDb, persist, type DbUser } from './db'

export interface WhatsAppDeps {
  buildSettlement: (h: Household, month: MonthKey) => Settlement
  isClosed: (h: Household, month: MonthKey) => boolean
  notifyExpense: (h: Household, text: string, exceptUserId: string) => void
  emit: (householdId: string, event: LiveEvent) => void
}

const BOT_NUMBER = '919876543210'
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const UNDO_WINDOW_MS = 15 * 60_000
const wa = () => getDb().whatsapp
const isAdmin = (h: Household, userId: string) => h.members.find((m) => m.id === userId)?.role === 'admin'
const first = (name: string) => name.trim().split(/\s+/)[0]
const randomCode = () => `RM-${Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('')}`

export function makeWhatsAppHandlers(deps: WhatsAppDeps) {
  /** A group "created" a moment ago becomes active shortly after — like Meta's async webhook. */
  function resolveGroup(householdId: string) {
    const g = wa().groups[householdId]
    if (g?.status === 'creating' && Date.now() - new Date(g.createdAt).getTime() > 1800) {
      g.status = 'active'
      g.inviteLink = `https://chat.whatsapp.com/Roomly${uid('g').slice(2, 14)}`
      persist()
    }
    return g
  }

  function status(user: DbUser, h: Household): WhatsAppStatus {
    const g = resolveGroup(h.id)
    const mine = wa().links.find((l) => l.userId === user.id)
    const links = wa().links
    return {
      configured: true, simulator: true, botNumber: BOT_NUMBER, groupsAvailable: true,
      isAdmin: isAdmin(h, user.id), autoReply: wa().settings[h.id]?.autoReply ?? true,
      me: mine ? { linked: true, phoneMasked: `•••• ${mine.waId.slice(-4)}`, linkedAt: mine.linkedAt } : { linked: false },
      group: g && g.status !== 'deleted'
        ? { status: g.status, subject: g.subject, inviteLink: g.inviteLink, joinedCount: h.members.filter((m) => links.some((l) => l.userId === m.id)).length, error: g.error }
        : null,
      members: h.members.map((m) => ({ memberId: m.id, linked: links.some((l) => l.userId === m.id) })),
    }
  }

  const log = (h: Household, entry: Omit<WhatsAppActivity, 'id' | 'at'>) => {
    wa().log.unshift({ id: uid('wl'), at: new Date().toISOString(), householdId: h.id, ...entry })
    wa().log = wa().log.slice(0, 200)
  }

  function linkCode(user: DbUser): WhatsAppLinkCode {
    wa().codes = wa().codes.filter((c) => c.userId !== user.id)
    const code = randomCode()
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
    wa().codes.push({ userId: user.id, code, expiresAt })
    persist()
    return { code, expiresAt, deepLink: `https://wa.me/${BOT_NUMBER}?text=${encodeURIComponent(`link ${code}`)}` }
  }

  /* ---------- the inbound pipeline (mirrors server/src/services/whatsapp/processor.js) ---------- */
  function process(h: Household, userId: string, text: string, context: 'dm' | 'group'): { outcome: string; replies: string[] } {
    const result = parseMessage(text)
    const user = getDb().users.find((u) => u.id === userId)
    const member = h.members.find((m) => m.id === userId)
    if (!user || !member) return { outcome: 'ignored', replies: [] }
    const reply = (...r: string[]) => ({ replies: r })

    if (result.kind === 'command') {
      switch (result.command) {
        case 'link': return { outcome: 'link', ...reply(context === 'group' ? 'Please send link codes to me in a private chat, not in the group.' : 'You’re already linked.') }
        case 'help': return { outcome: 'help', ...reply('Send an expense like “vegetables 150” and I’ll add it.\nOther things I understand:\n• balance — what you owe or are owed\n• total — this month’s spend\n• undo — remove your last WhatsApp expense') }
        case 'balance': {
          const s = deps.buildSettlement(h, currentMonth())
          const b = s.members.find((m) => m.memberId === userId)?.balance ?? 0
          return { outcome: 'balance', ...reply(b > 0 ? `You should receive ${formatINR(b)} this month.` : b < 0 ? `You owe ${formatINR(-b)} this month.` : 'You’re all square this month.') }
        }
        case 'total': {
          const s = deps.buildSettlement(h, currentMonth())
          return { outcome: 'total', ...reply(`${monthLabel(currentMonth(), { year: false })}: ${formatINR(s.total)} across ${s.expenseCount} expenses.`) }
        }
        case 'undo': {
          const db = getDb()
          const last = db.expenses.filter((e) => e.householdId === h.id && e.source === 'whatsapp' && e.paidBy === userId && Date.now() - new Date(e.createdAt).getTime() < UNDO_WINDOW_MS)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
          if (!last) return { outcome: 'undo-none', ...reply('Nothing to undo — I only remove expenses you added from WhatsApp in the last 15 minutes.') }
          if (deps.isClosed(h, monthOf(last.date))) return { outcome: 'closed', ...reply(`${monthLabel(monthOf(last.date), { year: false })} is already settled, so I can’t change it.`) }
          db.expenses = db.expenses.filter((e) => e !== last)
          log(h, { outcome: 'undo', via: context, memberId: userId, text: last.title, amount: last.amount })
          persist(); deps.emit(h.id, { type: 'expense.deleted', id: last.id, by: userId, source: 'whatsapp', title: last.title, amount: last.amount })
          return { outcome: 'undo', ...reply(`↩️ Removed ${formatINR(last.amount)} for ${last.title}.`) }
        }
      }
    }

    if (result.kind !== 'expense' || !shouldRecord(result, context)) return { outcome: 'ignored', replies: [] }
    // "paid rahul 500" is a transfer between housemates, not a purchase.
    if (h.members.some((m) => first(m.name).toLowerCase() === result.title.toLowerCase())) return { outcome: 'ignored', replies: [] }

    const date = addDays(todayISO(), result.dayOffset)
    if (deps.isClosed(h, monthOf(date))) return { outcome: 'closed', ...reply(`${monthLabel(monthOf(date), { year: false })} is already settled, so I can’t add to it.`) }
    const now = new Date().toISOString()
    const category = (result.category ?? 'other') as CategoryId
    const expense: Expense = { id: uid('e'), householdId: h.id, title: result.title, amount: result.amount, category, paidBy: userId, date, source: 'whatsapp', createdAt: now, updatedAt: now }
    getDb().expenses.push(expense)
    log(h, { outcome: 'expense', via: context, memberId: userId, text: text.slice(0, 80), amount: expense.amount, expenseId: expense.id })
    deps.notifyExpense(h, `${first(member.name)} added ${formatINR(expense.amount)} for ${expense.title.toLowerCase()}.`, userId)
    persist()
    deps.emit(h.id, { type: 'expense.created', id: expense.id, by: userId, source: 'whatsapp', title: expense.title, amount: expense.amount, category })
    const autoReply = context === 'dm' || (wa().settings[h.id]?.autoReply ?? true)
    const label = CATEGORY_MAP[category].label
    return { outcome: 'expense', replies: autoReply ? [`✅ Added ${formatINR(expense.amount)} · ${label} · ${first(member.name)}${context === 'dm' ? '\nSend “undo” to remove it.' : ''}`] : [] }
  }

  function linkWithCode(h: Household, userId: string, code: string) {
    const entry = wa().codes.find((c) => c.code === code && new Date(c.expiresAt).getTime() > Date.now())
    if (!entry || entry.userId !== userId) return { outcome: 'link-failed', replies: ['That code didn’t work. Open Roomly → Settings → WhatsApp for a fresh one.'] }
    const user = getDb().users.find((u) => u.id === userId)!
    wa().links = wa().links.filter((l) => l.userId !== userId)
    wa().links.push({ userId, waId: `9199${Math.floor(10000000 + Math.random() * 89999999)}`, linkedAt: new Date().toISOString() })
    wa().codes = wa().codes.filter((c) => c !== entry)
    log(h, { outcome: 'link', via: 'dm', memberId: userId })
    persist()
    deps.emit(h.id, { type: 'whatsapp.updated', by: userId })
    return { outcome: 'link', replies: [`✅ Linked! Hi ${first(user.name)} — you can now log expenses here. Try: vegetables 150`] }
  }

  return {
    status,
    linkCode,

    unlink(user: DbUser, h: Household) {
      wa().links = wa().links.filter((l) => l.userId !== user.id)
      persist(); deps.emit(h.id, { type: 'whatsapp.updated', by: user.id })
      return { ok: true }
    },

    createGroup(user: DbUser, h: Household) {
      if (!isAdmin(h, user.id)) throw new ApiError(403, 'Only admins can create the WhatsApp group.')
      const existing = resolveGroup(h.id)
      if (existing && existing.status !== 'deleted' && existing.status !== 'failed') throw new ApiError(409, 'This household already has a WhatsApp group.')
      wa().groups[h.id] = { status: 'creating', subject: `Roomly · ${h.name}`, createdAt: new Date().toISOString() }
      persist()
      return status(user, h)
    },

    deleteGroup(user: DbUser, h: Household) {
      if (!isAdmin(h, user.id)) throw new ApiError(403, 'Only admins can delete the WhatsApp group.')
      if (wa().groups[h.id]) wa().groups[h.id].status = 'deleted'
      persist(); deps.emit(h.id, { type: 'whatsapp.updated', by: user.id })
      return status(user, h)
    },

    resetInvite(user: DbUser, h: Household) {
      if (!isAdmin(h, user.id)) throw new ApiError(403, 'Only admins can reset the invite link.')
      const g = wa().groups[h.id]
      if (!g || g.status !== 'active') throw new ApiError(409, 'There’s no active WhatsApp group yet.')
      g.inviteLink = `https://chat.whatsapp.com/Roomly${uid('g').slice(2, 14)}`
      persist()
      return status(user, h)
    },

    settings(user: DbUser, h: Household, body: { autoReply?: boolean }) {
      if (!isAdmin(h, user.id)) throw new ApiError(403, 'Only admins can change this.')
      wa().settings[h.id] = { autoReply: !!body.autoReply }
      persist()
      return status(user, h)
    },

    activity(h: Household, limit: number): WhatsAppActivity[] {
      return wa().log.filter((l) => l.householdId === h.id).slice(0, limit).map(({ householdId: _h, ...rest }) => rest)
    },

    parse(body: { text?: string; context?: 'dm' | 'group' }): WhatsAppPreview {
      const r = parseMessage(String(body.text ?? ''))
      const context = body.context === 'group' ? 'group' : 'dm'
      if (r.kind === 'expense') return { kind: 'expense', amount: r.amount, title: r.title, category: r.category as CategoryId | null, dayOffset: r.dayOffset, confidence: r.confidence, wouldRecord: shouldRecord(r, context) }
      if (r.kind === 'command') return { kind: 'command', command: r.command, wouldRecord: false }
      return { kind: 'ignore', reason: r.reason, wouldRecord: false }
    },

    simulate(h: Household, body: { as?: string; text?: string; context?: 'dm' | 'group' }) {
      const userId = String(body.as ?? '')
      if (!h.members.some((m) => m.id === userId)) throw new ApiError(422, 'Pick a household member.')
      const text = String(body.text ?? '')
      const context = body.context === 'group' ? 'group' : 'dm'
      const parsed = parseMessage(text)
      if (parsed.kind === 'command' && parsed.command === 'link' && context === 'dm') return linkWithCode(h, userId, parsed.arg ?? '')
      if (!wa().links.some((l) => l.userId === userId)) return { outcome: 'unlinked', replies: ['I don’t know this number yet. Open Roomly → Settings → WhatsApp → Link my number.'] }
      return process(h, userId, text, context)
    },
  }
}
