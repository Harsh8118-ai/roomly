import { Expense } from '../models/Expense.js'
import { SettlementPayment } from '../models/SettlementPayment.js'
import { computeBalances, simplifyDebts } from '../utils/settlement.js'
import { currentMonth, daysInMonth, monthOf, monthRange, todayISO } from '../utils/date.js'

/**
 * Everyone who should share this month's cost: current members, plus anyone
 * who paid for something that month and has since left (so balances still sum to zero).
 */
export function participantIds(household, expenses) {
  const ids = household.members.map((m) => String(m._id))
  for (const e of expenses) {
    const id = String(e.paidBy)
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

export function buildSettlement({ household, month, expenses, payments }) {
  const math = computeBalances(expenses, participantIds(household, expenses))
  const transactions = simplifyDebts(math.members, month).map((t) => {
    const pay = payments.find((p) => p.txId === t.id && p.amount === t.amount)
    return pay ? { ...t, status: 'settled', settledAt: new Date(pay.paidAt).toISOString() } : { ...t, status: 'pending' }
  })
  const status = expenses.length === 0 ? 'empty' : transactions.every((t) => t.status === 'settled') ? 'settled' : 'open'
  return {
    householdId: String(household._id), month, total: math.total, fairShare: math.fairShare,
    expenseCount: expenses.length, members: math.members, transactions, status,
  }
}

export async function loadMonthData(householdId, month) {
  const [expenses, payments] = await Promise.all([
    Expense.find({ householdId, date: monthRange(month) }).lean(),
    SettlementPayment.find({ householdId, month }).lean(),
  ])
  return { expenses, payments }
}

export async function getSettlement(household, month) {
  const { expenses, payments } = await loadMonthData(household._id, month)
  return buildSettlement({ household, month, expenses, payments })
}

/** A past month that everyone has paid up is locked: no edits, no new expenses. */
export async function isMonthClosed(household, month) {
  if (month >= currentMonth()) return false
  return (await getSettlement(household, month)).status === 'settled'
}

export async function buildSummary(household, month) {
  const { expenses, payments } = await loadMonthData(household._id, month)
  const settlement = buildSettlement({ household, month, expenses, payments })
  const cat = new Map()
  const mem = new Map()
  const day = new Map()
  for (const e of expenses) {
    const c = cat.get(e.category) ?? { total: 0, count: 0 }; c.total += e.amount; c.count++; cat.set(e.category, c)
    const m = mem.get(String(e.paidBy)) ?? { total: 0, count: 0 }; m.total += e.amount; m.count++; mem.set(String(e.paidBy), m)
    day.set(e.date, (day.get(e.date) ?? 0) + e.amount)
  }
  const last = month === currentMonth() ? Number(todayISO().slice(8)) : daysInMonth(month)
  return {
    month, total: settlement.total, expenseCount: settlement.expenseCount, fairShare: settlement.fairShare, status: settlement.status,
    byCategory: [...cat].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total),
    byMember: household.members.map((m) => ({ memberId: String(m._id), total: mem.get(String(m._id))?.total ?? 0, count: mem.get(String(m._id))?.count ?? 0 })),
    topExpenses: [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5),
    trend: Array.from({ length: last }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, '0')}`
      return { date, amount: day.get(date) ?? 0 }
    }),
  }
}

/** All months that have spend (plus the current one) with their status, newest first. */
export async function listMonths(household) {
  const [expenses, payments] = await Promise.all([
    Expense.find({ householdId: household._id }).select('date amount paidBy').lean(),
    SettlementPayment.find({ householdId: household._id }).lean(),
  ])
  const byMonth = new Map([[currentMonth(), []]])
  for (const e of expenses) {
    const m = monthOf(e.date)
    if (!byMonth.has(m)) byMonth.set(m, [])
    byMonth.get(m).push(e)
  }
  return [...byMonth.keys()].sort().reverse().map((month) => {
    const s = buildSettlement({ household, month, expenses: byMonth.get(month), payments: payments.filter((p) => p.month === month) })
    return { month, total: s.total, expenseCount: s.expenseCount, status: s.status }
  })
}
