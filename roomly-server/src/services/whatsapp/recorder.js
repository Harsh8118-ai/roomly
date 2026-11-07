import { Expense } from '../../models/Expense.js'
import { addDays, isoDateOf, monthName, monthOf } from '../../utils/date.js'
import { firstName } from '../../utils/format.js'
import { isMonthClosed } from '../settlementService.js'
import { notifyExpenseAdded } from '../notificationService.js'
import { publish } from '../events.js'

const UNDO_WINDOW_MS = 15 * 60_000

/** Turns a parsed chat message into a real expense (idempotent on the WhatsApp message id). */
export async function recordExpense({ household, user, parsed, wamid, sentAt }) {
  const date = addDays(isoDateOf(sentAt), parsed.dayOffset)
  const month = monthOf(date)
  if (await isMonthClosed(household, month)) return { status: 'closed', month: monthName(month) }

  const expense = await Expense.create({
    householdId: household._id, title: parsed.title, amount: parsed.amount, category: parsed.category ?? 'other',
    paidBy: user._id, createdBy: user._id, date, source: 'whatsapp', whatsappMessageId: wamid,
  })
  await notifyExpenseAdded(household, user, expense).catch((e) => console.error('[notify]', e.message))
  publish(household._id, { type: 'expense.created', id: String(expense._id), by: String(user._id), source: 'whatsapp', title: expense.title, amount: expense.amount, category: expense.category })
  return { status: 'created', expense }
}

/** Removes the sender's most recent WhatsApp expense from the last 15 minutes. */
export async function undoLast({ household, user }) {
  const expense = await Expense.findOne({
    householdId: household._id, paidBy: user._id, source: 'whatsapp', createdAt: { $gt: new Date(Date.now() - UNDO_WINDOW_MS) },
  }).sort({ createdAt: -1 })
  if (!expense) return { status: 'none' }
  if (await isMonthClosed(household, monthOf(expense.date))) return { status: 'closed', month: monthName(monthOf(expense.date)) }
  await expense.deleteOne()
  publish(household._id, { type: 'expense.deleted', id: String(expense._id), by: String(user._id), source: 'whatsapp', title: expense.title, amount: expense.amount })
  return { status: 'undone', expense }
}

/** "paid kunal 500" is money moving between housemates, not a purchase. */
export function looksLikeTransfer(household, title) {
  const names = new Set(household.members.map((m) => firstName(m.name).toLowerCase()))
  const words = title.toLowerCase().split(/\s+/)
  return words.length > 0 && words.every((w) => names.has(w))
}
