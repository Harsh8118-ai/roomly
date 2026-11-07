import type { AppNotification, Expense, Household, WhatsAppActivity, WhatsAppGroupStatus } from '@/types'
import { CLOSED_MONTHS, demoHousehold, demoUsers, seedExpenses, seedNotifications, seedWhatsApp } from './seed'

export interface DbUser {
  id: string; name: string; email: string; password: string
  householdIds: string[]; currentHouseholdId: string | null
}
export interface DbPayment { householdId: string; txId: string; amount: number; paidAt: string }

export interface MockWhatsApp {
  links: { userId: string; waId: string; linkedAt: string }[]
  codes: { userId: string; code: string; expiresAt: string }[]
  groups: Record<string, { status: WhatsAppGroupStatus; subject: string; inviteLink?: string; createdAt: string; error?: string }>
  settings: Record<string, { autoReply: boolean }>
  log: (WhatsAppActivity & { householdId: string })[]
}

export interface Db {
  version: number
  users: DbUser[]
  households: Household[]
  expenses: Expense[]
  payments: DbPayment[]
  closedMonths: { householdId: string; month: string }[]
  notifications: Record<string, AppNotification[]>
  whatsapp: MockWhatsApp
}

const KEY = 'roomly.mockdb.v3'
const VERSION = 3

function seed(): Db {
  const users = demoUsers()
  const expenses = seedExpenses()
  return {
    version: VERSION,
    users,
    households: [demoHousehold()],
    expenses,
    payments: [],
    closedMonths: CLOSED_MONTHS.map((month) => ({ householdId: 'h_casa4', month })),
    notifications: Object.fromEntries(users.map((u) => [u.id, seedNotifications(u.id)])),
    whatsapp: seedWhatsApp(expenses),
  }
}

let cache: Db | null = null

export function getDb(): Db {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Db
      if (parsed.version === VERSION) return (cache = parsed)
    }
  } catch { /* fall through to a fresh seed */ }
  cache = seed()
  persist()
  return cache
}

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* storage full or blocked */ }
}

export function resetDb() {
  cache = seed()
  persist()
}
