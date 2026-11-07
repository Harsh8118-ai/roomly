import type { Expense, MemberSettlement, MonthKey, SettlementTransaction } from '@/types'

/** Split an integer total into n whole-rupee shares that add up exactly. */
export function splitEvenly(total: number, n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(total / n)
  const remainder = total - base * n
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0))
}

export interface SettlementMath {
  total: number
  fairShare: number
  members: MemberSettlement[]
}

/** Paid vs. fair share for every member. Balances always sum to zero. */
export function computeBalances(expenses: Pick<Expense, 'amount' | 'paidBy'>[], memberIds: string[]): SettlementMath {
  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const shares = splitEvenly(total, memberIds.length)
  const members = memberIds.map((memberId, i) => {
    const paid = expenses.filter((e) => e.paidBy === memberId).reduce((s, e) => s + e.amount, 0)
    return { memberId, paid, share: shares[i], balance: paid - shares[i] }
  })
  return { total, fairShare: memberIds.length ? Math.round(total / memberIds.length) : 0, members }
}

/**
 * Minimise the number of payments: repeatedly match the biggest debtor with the
 * biggest creditor. Deterministic, so IDs are stable between renders.
 */
export function simplifyDebts(members: MemberSettlement[], month: MonthKey): Omit<SettlementTransaction, 'status'>[] {
  const creditors = members.filter((m) => m.balance > 0).map((m) => ({ id: m.memberId, left: m.balance }))
  const debtors = members.filter((m) => m.balance < 0).map((m) => ({ id: m.memberId, left: -m.balance }))
  const byLeftDesc = (a: { left: number }, b: { left: number }) => b.left - a.left
  const out: Omit<SettlementTransaction, 'status'>[] = []

  while (creditors.length && debtors.length) {
    creditors.sort(byLeftDesc)
    debtors.sort(byLeftDesc)
    const c = creditors[0]
    const d = debtors[0]
    const amount = Math.min(c.left, d.left)
    out.push({ id: `${month}:${d.id}>${c.id}`, from: d.id, to: c.id, amount })
    c.left -= amount
    d.left -= amount
    if (c.left === 0) creditors.shift()
    if (d.left === 0) debtors.shift()
  }
  return out
}
