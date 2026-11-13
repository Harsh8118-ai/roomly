/**
 * Pure settlement maths. Mirrors the frontend's logic so the numbers a person
 * sees never depend on which side computed them.
 */

/** Split an integer total into n whole-rupee shares that add up exactly. */
export function splitEvenly(total, n) {
  if (n <= 0) return []
  const base = Math.floor(total / n)
  const remainder = total - base * n
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0))
}

/** Paid vs. fair share per member. Balances always sum to zero. */
export function computeBalances(expenses, memberIds) {
  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const shareByMember = new Map(memberIds.map((id) => [id, 0]))
  for (const expense of expenses) {
    if (expense.splitType === 'custom' && Array.isArray(expense.splits) && expense.splits.length) {
      for (const split of expense.splits) {
        const id = String(split.memberId)
        shareByMember.set(id, (shareByMember.get(id) ?? 0) + split.amount)
      }
    } else {
      const shares = splitEvenly(expense.amount, memberIds.length)
      memberIds.forEach((id, i) => shareByMember.set(id, (shareByMember.get(id) ?? 0) + shares[i]))
    }
  }
  const members = memberIds.map((memberId) => {
    const paid = expenses.filter((e) => String(e.paidBy) === memberId).reduce((s, e) => s + e.amount, 0)
    const share = shareByMember.get(memberId) ?? 0
    return { memberId, paid, share, balance: paid - share }
  })
  return { total, fairShare: memberIds.length ? Math.round(total / memberIds.length) : 0, members }
}

/** Fewest payments: repeatedly match the biggest debtor with the biggest creditor. Deterministic ids. */
export function simplifyDebts(members, month) {
  const creditors = members.filter((m) => m.balance > 0).map((m) => ({ id: m.memberId, left: m.balance }))
  const debtors = members.filter((m) => m.balance < 0).map((m) => ({ id: m.memberId, left: -m.balance }))
  const desc = (a, b) => b.left - a.left
  const out = []
  while (creditors.length && debtors.length) {
    creditors.sort(desc)
    debtors.sort(desc)
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
