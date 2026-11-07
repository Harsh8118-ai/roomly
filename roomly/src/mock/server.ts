/**
 * An in-browser stand-in for the Express API. It speaks the same REST shape the
 * real backend will, so services never know the difference. Unset VITE_API_URL
 * to use it; set it to talk to a real server.
 */
import { CATEGORY_MAP } from '@/constants/categories'
import type {
  AppNotification, AuthSession, CategoryId, Expense, ExpenseInput, ExpenseQuery, Household,
  HouseholdSummary, Member, MonthKey, MonthListItem, MonthlySummary, Settlement, User,
} from '@/types'
import { ApiError } from '@/utils/errors'
import { addDays, currentMonth, daysInMonth, monthOf, todayISO } from '@/utils/date'
import { uid } from '@/utils/id'
import { computeBalances, simplifyDebts } from '@/utils/settlement'
import { formatINR } from '@/utils/format'
import { getDb, persist, resetDb, type DbUser } from './db'
import { mockBus } from './events'
import { makeWhatsAppHandlers } from './whatsappMock'

export interface MockRequest { method: string; path: string; query: Record<string, string>; body: any; token: string | null }

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const FAIL_KEY = 'roomly.mock.fail'
export const mockControls = {
  isFailing: () => localStorage.getItem(FAIL_KEY) === '1',
  setFailing: (on: boolean) => (on ? localStorage.setItem(FAIL_KEY, '1') : localStorage.removeItem(FAIL_KEY)),
  reset: resetDb,
}

/* ------------------------------ helpers ------------------------------ */
const publicUser = (u: DbUser): User => ({ id: u.id, name: u.name, email: u.email, householdIds: u.householdIds, currentHouseholdId: u.currentHouseholdId })

function authUser(token: string | null): DbUser {
  const id = token?.startsWith('mock.') ? token.slice(5) : null
  const user = getDb().users.find((u) => u.id === id)
  if (!user) throw new ApiError(401, 'Session expired')
  return user
}

function currentHousehold(user: DbUser): Household {
  const h = getDb().households.find((x) => x.id === user.currentHouseholdId)
  if (!h) throw new ApiError(404, 'No household')
  return h
}

/** Which household a mock session token currently points at (for the live-event stream). */
export function resolveMockHousehold(token: string | null): string | null {
  const id = token?.startsWith('mock.') ? token.slice(5) : null
  return getDb().users.find((u) => u.id === id)?.currentHouseholdId ?? null
}

const activeMemberIds = (h: Household) => h.members.map((m) => m.id)
const monthExpenses = (h: Household, month: MonthKey) => getDb().expenses.filter((e) => e.householdId === h.id && monthOf(e.date) === month)
const isClosed = (h: Household, month: MonthKey) => getDb().closedMonths.some((c) => c.householdId === h.id && c.month === month)

function validateExpense(h: Household, body: Partial<ExpenseInput>): ExpenseInput {
  if (!body.title?.trim()) throw new ApiError(422, 'Add a short description.')
  if (!(Number(body.amount) > 0)) throw new ApiError(422, 'Amount must be more than ₹0.')
  if (!CATEGORY_MAP[body.category as CategoryId]) throw new ApiError(422, 'Pick a category.')
  if (!h.members.some((m) => m.id === body.paidBy)) throw new ApiError(422, 'Pick who paid.')
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new ApiError(422, 'Pick a valid date.')
  return {
    title: body.title.trim(), amount: Math.round(Number(body.amount)), category: body.category as CategoryId,
    paidBy: body.paidBy!, date: body.date, note: body.note?.trim() || undefined, receiptUrl: body.receiptUrl || undefined,
  }
}

function filterExpenses(h: Household, q: Record<string, string>): Expense[] {
  const query: ExpenseQuery = {
    month: q.month, q: q.q?.trim().toLowerCase(),
    members: q.members?.split(',').filter(Boolean), categories: q.categories?.split(',').filter(Boolean) as CategoryId[],
    from: q.from, to: q.to, minAmount: q.minAmount ? Number(q.minAmount) : undefined, maxAmount: q.maxAmount ? Number(q.maxAmount) : undefined,
  }
  return getDb().expenses
    .filter((e) => e.householdId === h.id)
    .filter((e) => !query.month || monthOf(e.date) === query.month)
    .filter((e) => !query.members?.length || query.members.includes(e.paidBy))
    .filter((e) => !query.categories?.length || query.categories.includes(e.category))
    .filter((e) => !query.from || e.date >= query.from)
    .filter((e) => !query.to || e.date <= query.to)
    .filter((e) => query.minAmount === undefined || e.amount >= query.minAmount)
    .filter((e) => query.maxAmount === undefined || e.amount <= query.maxAmount)
    .filter((e) => {
      if (!query.q) return true
      const who = h.members.find((m) => m.id === e.paidBy)?.name.toLowerCase() ?? ''
      const hay = `${e.title} ${CATEGORY_MAP[e.category].label} ${who} ${e.note ?? ''}`.toLowerCase()
      // light stemming so "grocery" finds "Groceries" and "veggie" finds "Veggies"
      return query.q.split(/\s+/).every((tok) => hay.includes(tok) || (tok.length > 3 && hay.includes(tok.replace(/(ies|es|y|s)$/, ''))))
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

function buildSettlement(h: Household, month: MonthKey): Settlement {
  const db = getDb()
  const exps = monthExpenses(h, month)
  const math = computeBalances(exps, activeMemberIds(h))
  const closed = isClosed(h, month)
  const [y, m] = month.split('-').map(Number)
  const closedStamp = new Date(y, m, 3, 11, 30).toISOString()
  const transactions = simplifyDebts(math.members, month).map((t) => {
    const pay = db.payments.find((p) => p.householdId === h.id && p.txId === t.id && p.amount === t.amount)
    if (closed) return { ...t, status: 'settled' as const, settledAt: closedStamp }
    return pay ? { ...t, status: 'settled' as const, settledAt: pay.paidAt } : { ...t, status: 'pending' as const }
  })
  const status = exps.length === 0 ? 'empty' : transactions.every((t) => t.status === 'settled') ? 'settled' : 'open'
  return { householdId: h.id, month, total: math.total, fairShare: math.fairShare, expenseCount: exps.length, members: math.members, transactions, status }
}

function buildSummary(h: Household, month: MonthKey): MonthlySummary {
  const exps = monthExpenses(h, month)
  const settlement = buildSettlement(h, month)
  const cat = new Map<CategoryId, { total: number; count: number }>()
  const mem = new Map<string, { total: number; count: number }>()
  const day = new Map<string, number>()
  exps.forEach((e) => {
    const c = cat.get(e.category) ?? { total: 0, count: 0 }; c.total += e.amount; c.count++; cat.set(e.category, c)
    const m = mem.get(e.paidBy) ?? { total: 0, count: 0 }; m.total += e.amount; m.count++; mem.set(e.paidBy, m)
    day.set(e.date, (day.get(e.date) ?? 0) + e.amount)
  })
  const last = month === currentMonth() ? Number(todayISO().slice(8)) : daysInMonth(month)
  return {
    month, total: settlement.total, expenseCount: exps.length, fairShare: settlement.fairShare, status: settlement.status,
    byCategory: [...cat].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total),
    byMember: h.members.map((m) => ({ memberId: m.id, total: mem.get(m.id)?.total ?? 0, count: mem.get(m.id)?.count ?? 0 })),
    topExpenses: [...exps].sort((a, b) => b.amount - a.amount).slice(0, 5),
    trend: Array.from({ length: last }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, '0')}`
      return { date, amount: day.get(date) ?? 0 }
    }),
  }
}

function pushNotification(h: Household, type: AppNotification['type'], title: string, href: string, exceptUserId?: string) {
  const db = getDb()
  h.members.forEach((m) => {
    if (m.id === exceptUserId) return
    const list = (db.notifications[m.id] ??= [])
    list.unshift({ id: uid('n'), type, title, href, createdAt: new Date().toISOString(), read: false })
  })
}

const TONES = [1, 2, 4, 5, 3, 6]
const makeInviteCode = () => { let code = ''; do { code = String(Math.floor(Math.random() * 10000)).padStart(4, '0') } while (getDb().households.some((h) => h.inviteCode === code)); return code }

/* ------------------------------ router ------------------------------ */
type Handler = (req: MockRequest, m: RegExpMatchArray) => unknown
const routes: { method: string; re: RegExp; auth: boolean; fn: Handler }[] = []
const route = (method: string, pattern: string, auth: boolean, fn: Handler) =>
  routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '([^/]+)')}$`), auth, fn })

// ---- auth
route('POST', '/auth/login', false, ({ body }) => {
  const user = getDb().users.find((u) => u.email.toLowerCase() === String(body.email ?? '').toLowerCase())
  if (!user || user.password !== body.password) throw new ApiError(401, 'That email and password don’t match.')
  return { token: `mock.${user.id}`, user: publicUser(user) } satisfies AuthSession
})
route('POST', '/auth/register', false, ({ body }) => {
  const db = getDb()
  if (db.users.some((u) => u.email.toLowerCase() === String(body.email).toLowerCase())) throw new ApiError(409, 'An account with this email already exists.')
  const user: DbUser = { id: uid('u'), name: String(body.name).trim(), email: String(body.email).trim(), password: String(body.password), householdIds: [], currentHouseholdId: null }
  db.users.push(user); db.notifications[user.id] = []; persist()
  return { token: `mock.${user.id}`, user: publicUser(user) } satisfies AuthSession
})
route('POST', '/auth/forgot-password', false, ({ body }) => {
  if (!/^\S+@\S+\.\S+$/.test(String(body.email ?? ''))) throw new ApiError(422, 'Enter a valid email address.')
  return { ok: true }
})
route('POST', '/auth/logout', true, () => ({ ok: true }))
route('GET', '/auth/me', true, ({ token }) => publicUser(authUser(token)))
route('PATCH', '/auth/me', true, ({ token, body }) => {
  const u = authUser(token)
  if (body.name !== undefined) {
    if (!String(body.name).trim()) throw new ApiError(422, 'Name can’t be empty.')
    u.name = String(body.name).trim()
    getDb().households.forEach((h) => h.members.forEach((m) => { if (m.id === u.id) m.name = u.name }))
  }
  if (body.email !== undefined) u.email = String(body.email).trim()
  if (body.tone !== undefined) getDb().households.forEach((h) => h.members.forEach((m) => { if (m.id === u.id) m.tone = Number(body.tone) }))
  persist(); return publicUser(u)
})
route('POST', '/auth/change-password', true, ({ token, body }) => {
  const u = authUser(token)
  if (u.password !== body.currentPassword) throw new ApiError(422, 'Your current password is incorrect.')
  if (String(body.newPassword ?? '').length < 8) throw new ApiError(422, 'New password must be at least 8 characters.')
  u.password = body.newPassword; persist(); return { ok: true }
})

// ---- households
route('GET', '/households', true, ({ token }) => {
  const u = authUser(token)
  return getDb().households.filter((h) => u.householdIds.includes(h.id)).map((h): HouseholdSummary => ({ id: h.id, name: h.name, memberCount: h.members.length }))
})
route('POST', '/households', true, ({ token, body }) => {
  const db = getDb(); const u = authUser(token)
  if (!String(body.name ?? '').trim()) throw new ApiError(422, 'Give your household a name.')
  const me: Member = { id: u.id, name: u.name, email: u.email, role: 'admin', status: 'active', tone: 1, joinedAt: new Date().toISOString() }
  const h: Household = { id: uid('h'), name: String(body.name).trim(), inviteCode: makeInviteCode(), currency: 'INR', createdAt: new Date().toISOString(), members: [me] }
  db.households.push(h); u.householdIds.push(h.id); u.currentHouseholdId = h.id; persist()
  return h
})
route('POST', '/households/join', true, ({ token, body }) => {
  const db = getDb(); const u = authUser(token)
  const h = db.households.find((item) => item.inviteCode === String(body.inviteCode ?? '').trim())
  if (!h) throw new ApiError(404, 'That four-digit code does not match a group.')
  if (h.members.some((m) => m.id === u.id)) throw new ApiError(409, 'You are already in this group.')
  if (h.members.length >= 12) throw new ApiError(422, 'A group can have up to 12 members.')
  h.members.push({ id: u.id, name: u.name, email: u.email, role: 'member', status: 'active', tone: TONES[h.members.length % TONES.length], joinedAt: new Date().toISOString() })
  if (!u.householdIds.includes(h.id)) u.householdIds.push(h.id)
  u.currentHouseholdId = h.id; persist(); return h
})
route('PUT', '/households/current', true, ({ token, body }) => {
  const u = authUser(token)
  if (!u.householdIds.includes(body.householdId)) throw new ApiError(403)
  u.currentHouseholdId = body.householdId; persist(); return publicUser(u)
})
route('GET', '/households/current', true, ({ token }) => currentHousehold(authUser(token)))
route('PATCH', '/households/current', true, ({ token, body }) => {
  const h = currentHousehold(authUser(token))
  if (!String(body.name ?? '').trim()) throw new ApiError(422, 'Household name can’t be empty.')
  h.name = String(body.name).trim(); persist(); return h
})
route('GET', '/households/current/members', true, ({ token }) => currentHousehold(authUser(token)).members)
route('POST', '/households/current/invites', true, ({ token, body }) => {
  const h = currentHousehold(authUser(token))
  const name = String(body.name ?? '').trim()
  if (!name) throw new ApiError(422, 'Add a name for your housemate.')
  if (h.members.length >= 12) throw new ApiError(422, 'A household can have up to 12 members.')
  const member: Member = { id: uid('m'), name, email: body.email || undefined, role: 'member', status: 'invited', tone: TONES[h.members.length % TONES.length], joinedAt: new Date().toISOString() }
  h.members.push(member); persist(); return member
})
route('DELETE', '/households/current/members/me', true, ({ token }) => {
  const db = getDb(); const u = authUser(token); const h = currentHousehold(u)
  h.members = h.members.filter((m) => m.id !== u.id)
  u.householdIds = u.householdIds.filter((id) => id !== h.id)
  u.currentHouseholdId = u.householdIds[0] ?? null
  if (h.members.length === 0) db.households = db.households.filter((x) => x.id !== h.id)
  persist(); return publicUser(u)
})

// ---- expenses
route('GET', '/expenses', true, ({ token, query }) => filterExpenses(currentHousehold(authUser(token)), query))
route('POST', '/expenses', true, ({ token, body }) => {
  const u = authUser(token); const h = currentHousehold(u)
  const input = validateExpense(h, body)
  const now = new Date().toISOString()
  const expense: Expense = { id: uid('e'), householdId: h.id, ...input, source: 'web', createdAt: now, updatedAt: now }
  getDb().expenses.push(expense)
  const payer = h.members.find((m) => m.id === expense.paidBy)
  pushNotification(h, 'expense', `${payer?.name.split(' ')[0] ?? 'Someone'} added ${formatINR(expense.amount)} for ${expense.title.toLowerCase()}.`, '/app/expenses', u.id)
  persist()
  mockBus.emit(h.id, { type: 'expense.created', id: expense.id, by: u.id, source: 'web', title: expense.title, amount: expense.amount, category: expense.category })
  return expense
})
route('GET', '/expenses/:id', true, ({ token }, m) => {
  const e = getDb().expenses.find((x) => x.id === m[1] && x.householdId === currentHousehold(authUser(token)).id)
  if (!e) throw new ApiError(404, 'Expense not found'); return e
})
route('PATCH', '/expenses/:id', true, ({ token, body }, m) => {
  const h = currentHousehold(authUser(token))
  const e = getDb().expenses.find((x) => x.id === m[1] && x.householdId === h.id)
  if (!e) throw new ApiError(404, 'Expense not found')
  if (isClosed(h, monthOf(e.date))) throw new ApiError(409, 'This month is already settled and can’t be edited.')
  Object.assign(e, validateExpense(h, { ...e, ...body }), { updatedAt: new Date().toISOString() })
  persist()
  mockBus.emit(h.id, { type: 'expense.updated', id: e.id, source: e.source })
  return e
})
route('DELETE', '/expenses/:id', true, ({ token }, m) => {
  const db = getDb(); const h = currentHousehold(authUser(token))
  const e = db.expenses.find((x) => x.id === m[1] && x.householdId === h.id)
  if (!e) throw new ApiError(404, 'Expense not found')
  if (isClosed(h, monthOf(e.date))) throw new ApiError(409, 'This month is already settled and can’t be edited.')
  db.expenses = db.expenses.filter((x) => x !== e); persist()
  mockBus.emit(h.id, { type: 'expense.deleted', id: e.id })
  return e
})
route('POST', '/expenses/:id/restore', true, ({ token, body }) => {
  const h = currentHousehold(authUser(token)); const e = body as Expense
  if (e.householdId !== h.id) throw new ApiError(403)
  if (!getDb().expenses.some((x) => x.id === e.id)) getDb().expenses.push(e)
  persist(); return e
})
route('POST', '/uploads/receipts', true, ({ body }) => {
  if (!String(body.dataUrl ?? '').startsWith('data:')) throw new ApiError(422, 'That file couldn’t be read.')
  return { url: body.dataUrl }
})

// ---- settlements, summaries, history
route('GET', '/settlements/:month', true, ({ token }, m) => buildSettlement(currentHousehold(authUser(token)), m[1]))
route('POST', '/settlements/:month/transactions/:tx/pay', true, ({ token }, m) => {
  const db = getDb(); const u = authUser(token); const h = currentHousehold(u)
  const month = m[1]; const txId = decodeURIComponent(m[2])
  if (isClosed(h, month)) throw new ApiError(409, 'This month is already settled.')
  const tx = buildSettlement(h, month).transactions.find((t) => t.id === txId)
  if (!tx) throw new ApiError(404, 'Payment not found')
  db.payments = db.payments.filter((p) => !(p.householdId === h.id && p.txId === txId))
  db.payments.push({ householdId: h.id, txId, amount: tx.amount, paidAt: new Date().toISOString() })
  const after = buildSettlement(h, month)
  if (after.status === 'settled') pushNotification(h, 'settled', `All members have settled ${new Date(`${month}-01`).toLocaleDateString('en-IN', { month: 'long' })}.`, `/app/history/${month}`)
  persist()
  mockBus.emit(h.id, { type: 'settlement.updated' })
  return after
})
route('GET', '/summaries/:month', true, ({ token }, m) => buildSummary(currentHousehold(authUser(token)), m[1]))
route('GET', '/months', true, ({ token }) => {
  const h = currentHousehold(authUser(token))
  const months = new Set<string>([currentMonth()])
  getDb().expenses.filter((e) => e.householdId === h.id).forEach((e) => months.add(monthOf(e.date)))
  return [...months].sort().reverse().map((month): MonthListItem => {
    const s = buildSettlement(h, month)
    return { month, total: s.total, expenseCount: s.expenseCount, status: s.status }
  })
})

// ---- whatsapp
const wa = makeWhatsAppHandlers({
  buildSettlement,
  isClosed,
  notifyExpense: (h, text, exceptUserId) => pushNotification(h, 'expense', text, '/app/expenses', exceptUserId),
  emit: (householdId, event) => mockBus.emit(householdId, event),
})
route('GET', '/whatsapp/status', true, ({ token }) => { const u = authUser(token); return wa.status(u, currentHousehold(u)) })
route('POST', '/whatsapp/link-code', true, ({ token }) => { const u = authUser(token); currentHousehold(u); return wa.linkCode(u) })
route('DELETE', '/whatsapp/link', true, ({ token }) => { const u = authUser(token); return wa.unlink(u, currentHousehold(u)) })
route('POST', '/whatsapp/group', true, ({ token }) => { const u = authUser(token); return wa.createGroup(u, currentHousehold(u)) })
route('DELETE', '/whatsapp/group', true, ({ token }) => { const u = authUser(token); return wa.deleteGroup(u, currentHousehold(u)) })
route('POST', '/whatsapp/group/invite-link', true, ({ token }) => { const u = authUser(token); return wa.resetInvite(u, currentHousehold(u)) })
route('PATCH', '/whatsapp/settings', true, ({ token, body }) => { const u = authUser(token); return wa.settings(u, currentHousehold(u), body) })
route('GET', '/whatsapp/activity', true, ({ token, query }) => wa.activity(currentHousehold(authUser(token)), Math.min(50, Number(query.limit) || 10)))
route('POST', '/whatsapp/parse', true, ({ body }) => wa.parse(body))
route('POST', '/whatsapp/simulate', true, ({ token, body }) => wa.simulate(currentHousehold(authUser(token)), body))

// ---- notifications
route('GET', '/notifications', true, ({ token }) => {
  const u = authUser(token)
  return [...(getDb().notifications[u.id] ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})
route('POST', '/notifications/read-all', true, ({ token }) => {
  getDb().notifications[authUser(token).id]?.forEach((n) => (n.read = true)); persist(); return { ok: true }
})
route('POST', '/notifications/:id/read', true, ({ token }, m) => {
  const n = getDb().notifications[authUser(token).id]?.find((x) => x.id === m[1])
  if (n) n.read = true; persist(); return { ok: true }
})

export async function handleMock(req: MockRequest): Promise<unknown> {
  await wait(180 + Math.random() * 260)
  if (mockControls.isFailing() && !req.path.startsWith('/auth')) throw new ApiError(500, 'Simulated outage')
  for (const r of routes) {
    if (r.method !== req.method) continue
    const match = req.path.match(r.re)
    if (!match) continue
    if (r.auth) authUser(req.token)
    return structuredClone(r.fn(req, match))
  }
  throw new ApiError(404, 'Not found')
}

// keep tree-shaking from dropping the unused helper in lean builds
void addDays
