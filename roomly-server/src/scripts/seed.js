/**
 * Seeds the demo household "Casa 4" so the frontend looks alive against a real database.
 *
 *   npm run seed            create the demo (skips if it already exists)
 *   npm run seed -- --reset wipe the whole database first (never in production)
 *
 * Data is anchored to the current month so "this month" always has spend:
 * the 47-expense, ₹18,420 dataset lands in the current month (dates compressed
 * if we're early in the month), with three settled months of history behind it.
 */
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDb, disconnectDb } from '../config/db.js'
import { env } from '../config/env.js'
import { Expense, Household, Notification, SettlementPayment, User, WhatsappLink, WhatsappGroup, WhatsappLinkCode, WhatsappMessage } from '../models/index.js'
import { OCTOBER_ROWS } from '../data/octoberRows.js'
import { buildSettlement } from '../services/settlementService.js'
import { currentMonth, daysInMonth, shiftMonth, todayISO } from '../utils/date.js'

const DEMO_PASSWORD = 'roomly123'
const PEOPLE = [
  { key: 'rahul', name: 'Rahul Sharma', role: 'admin', tone: 1 },
  { key: 'aman', name: 'Aman Verma', role: 'member', tone: 2 },
  { key: 'vikas', name: 'Vikas Singh', role: 'member', tone: 4 },
  { key: 'kunal', name: 'Kunal Mehta', role: 'member', tone: 5 },
]

function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const TEMPLATES = [
  ['Monthly groceries', 'groceries', 900, 1900, 3], ['Atta, rice & dal', 'groceries', 400, 900, 4], ['Snacks & biscuits', 'groceries', 150, 420, 3],
  ['Eggs & bread', 'groceries', 120, 260, 3], ['Sabzi mandi run', 'vegetables', 180, 420, 7], ['Fruits', 'vegetables', 120, 320, 3],
  ['Milk', 'milk', 110, 190, 6], ['Weekend dinner order', 'food', 380, 900, 3], ['Tiffin lunch', 'food', 200, 420, 2],
  ['Detergent & cleaning', 'cleaning', 160, 480, 3], ['Water cans', 'household', 80, 140, 2], ['Kitchen items', 'household', 180, 600, 2],
  ['Auto for shopping', 'transport', 70, 220, 2], ['Plumber visit', 'maintenance', 250, 700, 1], ['Party supplies', 'other', 200, 600, 1],
].map(([title, category, min, max, weight]) => ({ title, category, min, max, weight }))
const FIXED = [
  { title: 'Electricity bill (share)', category: 'utilities', day: 2, min: 1100, max: 1500 },
  { title: 'Gas cylinder refill', category: 'utilities', day: 9, min: 1000, max: 1150 },
  { title: 'Wi-Fi recharge', category: 'utilities', day: 14, min: 650, max: 750 },
]

/** Deterministic history so every seed produces the same past months. */
function generateMonth(month, total, count, seed, memberIds) {
  const rng = mulberry32(seed)
  const dim = daysInMonth(month)
  const weights = [0.28, 0.22, 0.24, 0.26]
  const pickMember = () => {
    let r = rng() * weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return memberIds[i] }
    return memberIds[0]
  }
  const pickTemplate = () => {
    let r = rng() * TEMPLATES.reduce((s, t) => s + t.weight, 0)
    for (const t of TEMPLATES) { r -= t.weight; if (r <= 0) return t }
    return TEMPLATES[0]
  }
  const raw = FIXED.map((f) => ({ title: f.title, category: f.category, day: f.day, raw: f.min + rng() * (f.max - f.min) }))
  while (raw.length < count) {
    const t = pickTemplate()
    raw.push({ title: t.title, category: t.category, day: 1 + Math.floor(rng() * dim), raw: t.min + rng() * (t.max - t.min) })
  }
  const scale = total / raw.reduce((s, r) => s + r.raw, 0)
  const amounts = raw.map((r) => Math.max(20, Math.round((r.raw * scale) / 5) * 5))
  amounts[amounts.indexOf(Math.max(...amounts))] += total - amounts.reduce((a, b) => a + b, 0)
  return raw.map((r, i) => ({ ...r, amount: amounts[i] })).sort((a, b) => a.day - b.day).map((r) => ({
    title: r.title, category: r.category, amount: r.amount, paidBy: pickMember(), date: `${month}-${String(r.day).padStart(2, '0')}`,
  }))
}

async function main() {
  if (env.isProd) throw new Error('Refusing to seed demo data in production.')
  await connectDb()
  const reset = process.argv.includes('--reset')
  if (reset) await mongoose.connection.dropDatabase()
  else if (await User.exists({ email: 'rahul@roomly.app' })) {
    console.log('Demo data already exists. Run `npm run seed -- --reset` to start over.')
    return disconnectDb()
  }
  await Promise.all([User, Household, Expense, SettlementPayment, Notification, WhatsappLink, WhatsappGroup, WhatsappLinkCode, WhatsappMessage].map((m) => m.init()))

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const users = await User.create(PEOPLE.map((p) => ({ name: p.name, email: `${p.key}@roomly.app`, passwordHash })))
  const idOf = Object.fromEntries(PEOPLE.map((p, i) => [p.key, users[i]._id]))

  const household = await Household.create({
    name: 'Casa 4', inviteCode: 'CASA-4X7K', createdBy: idOf.rahul,
    members: PEOPLE.map((p, i) => ({ _id: users[i]._id, name: p.name, email: users[i].email, role: p.role, status: 'active', tone: p.tone, joinedAt: new Date('2026-01-04T04:30:00Z') })),
  })
  for (const u of users) { u.householdIds = [household._id]; u.currentHouseholdId = household._id; await u.save() }

  // Three housemates have already linked WhatsApp (the demo user hasn't, so the flow can be tried).
  await WhatsappLink.create(['aman', 'vikas', 'kunal'].map((k, i) => ({ userId: idOf[k], waId: `91981110002${i + 1}`, displayName: k })))

  const month = currentMonth()
  const today = Number(todayISO().slice(8))
  const squeeze = Math.min(1, today / 28)
  const memberIds = PEOPLE.map((p) => idOf[p.key])
  const docs = []
  const stamp = (date, i) => new Date(`${date}T${String(3 + ((i * 5) % 13)).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}:00Z`)
  const add = (list) => list.forEach((e, i) => docs.push({ householdId: household._id, createdBy: e.paidBy, ...e, createdAt: stamp(e.date, i) }))

  add(OCTOBER_ROWS.map((r) => ({
    title: r.title, category: r.category, amount: r.amount, paidBy: idOf[r.by], note: r.note,
    date: `${month}-${String(Math.max(1, Math.round(r.day * squeeze))).padStart(2, '0')}`,
  })))
  const history = [[shiftMonth(month, -1), 16820, 42, 9], [shiftMonth(month, -2), 14250, 39, 8], [shiftMonth(month, -3), 15380, 41, 7]]
  for (const [m, total, count, seed] of history) add(generateMonth(m, total, count, seed, memberIds))
  await Expense.create(docs)

  // Past months are fully paid up.
  const payments = []
  for (const [m] of history) {
    const exps = docs.filter((d) => d.date.startsWith(m))
    const s = buildSettlement({ household, month: m, expenses: exps, payments: [] })
    const paidAt = new Date(`${shiftMonth(m, 1)}-03T06:00:00Z`)
    for (const t of s.transactions) payments.push({ householdId: household._id, month: m, txId: t.id, amount: t.amount, paidBy: new mongoose.Types.ObjectId(t.from), paidAt })
  }
  await SettlementPayment.create(payments)

  const now = Date.now()
  const ago = (h) => new Date(now - h * 3_600_000)
  await Notification.create(users.flatMap((u) => [
    { userId: u._id, householdId: household._id, type: 'expense', title: 'Rahul added ₹1,850 for groceries — weekly stock.', href: '/app/expenses', createdAt: ago(3) },
    { userId: u._id, householdId: household._id, type: 'owe', title: 'Settlement for this month is ready to review.', href: '/app/settlement', createdAt: ago(10) },
    { userId: u._id, householdId: household._id, type: 'settled', title: `All members have settled ${new Date(`${history[0][0]}-01`).toLocaleDateString('en-IN', { month: 'long' })}.`, href: `/app/history/${history[0][0]}`, createdAt: ago(24 * 6), read: true },
  ]))

  const total = docs.filter((d) => d.date.startsWith(month)).reduce((s, d) => s + d.amount, 0)
  console.log(`Seeded Casa 4: ${docs.length} expenses over 4 months (this month: ₹${total.toLocaleString('en-IN')}).`)
  console.log(`Sign in as rahul@roomly.app / ${DEMO_PASSWORD}  (aman@, vikas@, kunal@ use the same password)`)
  await disconnectDb()
}

main().catch(async (e) => { console.error('Seed failed:', e.message); await disconnectDb(); process.exit(1) })
