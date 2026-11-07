import type { AppNotification, CategoryId, Expense, Household, ISODate, Member, MonthKey } from '@/types'
import type { MockWhatsApp } from './db'
import { addDays, daysInMonth } from '@/utils/date'
import { OCTOBER_ROWS } from './octoberData'
import { receiptSvg } from './receipt'

export const DEMO_HOUSEHOLD_ID = 'h_casa4'
export const DEMO_PASSWORD = 'roomly123'

const members: Member[] = [
  { id: 'm_rahul', name: 'Rahul Sharma', email: 'rahul@roomly.app', role: 'admin', status: 'active', tone: 1, joinedAt: '2026-01-04T10:00:00+05:30' },
  { id: 'm_aman', name: 'Aman Verma', email: 'aman@roomly.app', role: 'member', status: 'active', tone: 2, joinedAt: '2026-01-04T10:05:00+05:30' },
  { id: 'm_vikas', name: 'Vikas Singh', email: 'vikas@roomly.app', role: 'member', status: 'active', tone: 4, joinedAt: '2026-01-05T09:12:00+05:30' },
  { id: 'm_kunal', name: 'Kunal Mehta', email: 'kunal@roomly.app', role: 'member', status: 'active', tone: 5, joinedAt: '2026-01-06T18:40:00+05:30' },
]

export const demoHousehold = (): Household => ({
  id: DEMO_HOUSEHOLD_ID,
  name: 'Casa 4',
  inviteCode: 'CASA-4X7K',
  currency: 'INR',
  createdAt: '2026-01-04T10:00:00+05:30',
  members,
})

export const demoUsers = () =>
  members.map((m) => ({
    id: m.id, name: m.name, email: m.email!, password: DEMO_PASSWORD,
    householdIds: [DEMO_HOUSEHOLD_ID], currentHouseholdId: DEMO_HOUSEHOLD_ID,
  }))

/* ---------- deterministic PRNG so history looks the same on every load ---------- */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Template { title: string; category: CategoryId; min: number; max: number; weight: number }
const TEMPLATES: Template[] = [
  { title: 'Monthly groceries', category: 'groceries', min: 900, max: 1900, weight: 3 },
  { title: 'Atta, rice & dal', category: 'groceries', min: 400, max: 900, weight: 4 },
  { title: 'Snacks & biscuits', category: 'groceries', min: 150, max: 420, weight: 3 },
  { title: 'Eggs & bread', category: 'groceries', min: 120, max: 260, weight: 3 },
  { title: 'Sabzi mandi run', category: 'vegetables', min: 180, max: 420, weight: 7 },
  { title: 'Fruits', category: 'vegetables', min: 120, max: 320, weight: 3 },
  { title: 'Milk', category: 'milk', min: 110, max: 190, weight: 6 },
  { title: 'Weekend dinner order', category: 'food', min: 380, max: 900, weight: 3 },
  { title: 'Tiffin lunch', category: 'food', min: 200, max: 420, weight: 2 },
  { title: 'Detergent & cleaning', category: 'cleaning', min: 160, max: 480, weight: 3 },
  { title: 'Water cans', category: 'household', min: 80, max: 140, weight: 2 },
  { title: 'Kitchen items', category: 'household', min: 180, max: 600, weight: 2 },
  { title: 'Auto for shopping', category: 'transport', min: 70, max: 220, weight: 2 },
  { title: 'Plumber visit', category: 'maintenance', min: 250, max: 700, weight: 1 },
  { title: 'Party supplies', category: 'other', min: 200, max: 600, weight: 1 },
]
const FIXED: { title: string; category: CategoryId; day: number; min: number; max: number }[] = [
  { title: 'Electricity bill (share)', category: 'utilities', day: 2, min: 1100, max: 1500 },
  { title: 'Gas cylinder refill', category: 'utilities', day: 9, min: 1000, max: 1150 },
  { title: 'Wi-Fi recharge', category: 'utilities', day: 14, min: 650, max: 750 },
]

function pickWeighted<T extends { weight: number }>(rng: () => number, xs: T[]): T {
  const total = xs.reduce((s, x) => s + x.weight, 0)
  let r = rng() * total
  for (const x of xs) { r -= x.weight; if (r <= 0) return x }
  return xs[xs.length - 1]
}

export function generateMonth(month: MonthKey, total: number, count: number, seed: number, householdId = DEMO_HOUSEHOLD_ID): Expense[] {
  const rng = mulberry32(seed)
  const dim = daysInMonth(month)
  const weights = [0.28, 0.22, 0.24, 0.26]
  const memberIds = members.map((m) => m.id)
  const pickMember = () => {
    let r = rng() * weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return memberIds[i] }
    return memberIds[0]
  }
  const raw: { title: string; category: CategoryId; day: number; raw: number }[] = []
  FIXED.forEach((f) => raw.push({ title: f.title, category: f.category, day: f.day, raw: f.min + rng() * (f.max - f.min) }))
  while (raw.length < count) {
    const t = pickWeighted(rng, TEMPLATES)
    raw.push({ title: t.title, category: t.category, day: 1 + Math.floor(rng() * dim), raw: t.min + rng() * (t.max - t.min) })
  }
  const scale = total / raw.reduce((s, r) => s + r.raw, 0)
  const amounts = raw.map((r) => Math.max(20, Math.round((r.raw * scale) / 5) * 5))
  const diff = total - amounts.reduce((a, b) => a + b, 0)
  const biggest = amounts.indexOf(Math.max(...amounts))
  amounts[biggest] += diff

  return raw
    .map((r, i) => ({ r, amount: amounts[i] }))
    .sort((a, b) => a.r.day - b.r.day)
    .map(({ r, amount }, i) => {
      const date = `${month}-${String(r.day).padStart(2, '0')}`
      const stamp = `${date}T${String(9 + ((i * 7) % 12)).padStart(2, '0')}:${String((i * 13) % 60).padStart(2, '0')}:00+05:30`
      return {
        id: `e_${month}_${String(i + 1).padStart(2, '0')}`,
        householdId, title: r.title, amount, category: r.category, paidBy: pickMember(),
        date, createdAt: stamp, updatedAt: stamp,
      }
    })
}

export function seedExpenses(): Expense[] {
  const oct: Expense[] = OCTOBER_ROWS.map((row, i) => {
    const date: ISODate = `2026-10-${String(row.day).padStart(2, '0')}`
    const hour = 8 + ((i * 5) % 13)
    const stamp = `${date}T${String(hour).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}:00+05:30`
    return {
      id: `e_2026-10_${String(i + 1).padStart(2, '0')}`,
      householdId: DEMO_HOUSEHOLD_ID,
      title: row.title,
      amount: row.amount,
      category: row.category as CategoryId,
      paidBy: row.by,
      date,
      note: row.note,
      receiptUrl: row.receipt ? receiptSvg(row.title, row.amount, date) : undefined,
      // Housemates' everyday purchases came in through the WhatsApp group in the demo.
      source: row.by !== 'm_rahul' && ['milk', 'vegetables', 'transport'].includes(row.category) ? 'whatsapp' : 'web',
      createdAt: stamp,
      updatedAt: stamp,
    }
  })
  return [
    ...generateMonth('2026-07', 15380, 41, 7),
    ...generateMonth('2026-08', 14250, 39, 8),
    ...generateMonth('2026-09', 16820, 42, 9),
    ...oct,
  ]
}

export const CLOSED_MONTHS = ['2026-07', '2026-08', '2026-09']

export function seedNotifications(userId: string): AppNotification[] {
  const base = (id: string, type: AppNotification['type'], title: string, createdAt: string, read: boolean, href: string): AppNotification => ({ id: `${userId}_${id}`, type, title, createdAt, read, href })
  return [
    base('n1', 'expense', 'Rahul added ₹1,850 for groceries.', '2026-10-28T18:05:00+05:30', false, '/app/expenses'),
    base('n2', 'owe', 'Settlement for October is ready to review.', '2026-10-28T09:00:00+05:30', false, '/app/settlement'),
    base('n3', 'expense', 'Kunal added ₹640 for a groceries top-up.', '2026-10-27T20:14:00+05:30', true, '/app/expenses'),
    base('n4', 'settled', 'All members have settled September.', '2026-10-03T11:30:00+05:30', true, '/app/history/2026-09'),
  ]
}

export { addDays }

/** Demo WhatsApp state: three housemates linked, an active group, and recent activity. */
export function seedWhatsApp(expenses: Expense[]): MockWhatsApp {
  const fromChat = expenses.filter((e) => e.source === 'whatsapp').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
  return {
    links: [
      { userId: 'm_aman', waId: '919811100021', linkedAt: '2026-09-02T10:00:00+05:30' },
      { userId: 'm_vikas', waId: '919811100034', linkedAt: '2026-09-02T10:05:00+05:30' },
      { userId: 'm_kunal', waId: '919811100057', linkedAt: '2026-09-03T09:12:00+05:30' },
    ],
    codes: [],
    groups: { [DEMO_HOUSEHOLD_ID]: { status: 'active', subject: 'Roomly · Casa 4', inviteLink: 'https://chat.whatsapp.com/RoomlyDemoInvite4x7K', createdAt: '2026-09-02T09:50:00+05:30' } },
    settings: { [DEMO_HOUSEHOLD_ID]: { autoReply: true } },
    log: fromChat.map((e) => ({
      id: `wl_${e.id}`, householdId: DEMO_HOUSEHOLD_ID, at: e.createdAt, outcome: 'expense' as const, via: 'group' as const,
      memberId: e.paidBy, text: `${e.title.toLowerCase()} ${e.amount}`, amount: e.amount, expenseId: e.id,
    })),
  }
}
