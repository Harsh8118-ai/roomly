/** Maps Mongo documents to the exact JSON shapes the frontend's types expect. */
const iso = (d) => (d ? new Date(d).toISOString() : undefined)

export const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  householdIds: (u.householdIds ?? []).map(String),
  currentHouseholdId: u.currentHouseholdId ? String(u.currentHouseholdId) : null,
})

export const publicMember = (m) => ({
  id: String(m._id),
  name: m.name,
  ...(m.email ? { email: m.email } : {}),
  role: m.role,
  status: m.status,
  tone: m.tone,
  joinedAt: iso(m.joinedAt),
})

export const publicHousehold = (h) => ({
  id: String(h._id),
  name: h.name,
  inviteCode: h.inviteCode,
  currency: 'INR',
  createdAt: iso(h.createdAt),
  members: h.members.map(publicMember),
})

export const publicExpense = (e) => ({
  id: String(e._id),
  householdId: String(e.householdId),
  title: e.title,
  amount: e.amount,
  category: e.category,
  paidBy: String(e.paidBy),
  date: e.date,
  splitType: e.splitType ?? 'equal',
  splits: (e.splits ?? []).map((split) => ({ memberId: String(split.memberId), amount: split.amount })),
  ...(e.note ? { note: e.note } : {}),
  ...(e.receiptUrl ? { receiptUrl: e.receiptUrl } : {}),
  source: e.source ?? 'web',
  createdAt: iso(e.createdAt),
  updatedAt: iso(e.updatedAt),
})

export const publicNotification = (n) => ({
  id: String(n._id),
  type: n.type,
  title: n.title,
  createdAt: iso(n.createdAt),
  read: n.read,
  href: n.href,
})
