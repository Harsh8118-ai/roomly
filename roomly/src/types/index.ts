export type CategoryId =
  | 'groceries' | 'vegetables' | 'milk' | 'food' | 'cleaning'
  | 'household' | 'utilities' | 'transport' | 'maintenance' | 'other'

/** ISO calendar date, e.g. "2026-10-28" */
export type ISODate = string
/** Month key, e.g. "2026-10" */
export type MonthKey = string

export interface User {
  id: string
  name: string
  email: string
  householdIds: string[]
  currentHouseholdId: string | null
}

export interface Member {
  id: string
  name: string
  email?: string
  role: 'admin' | 'member'
  status: 'active' | 'invited'
  /** 1–6, picks the avatar colour tone */
  tone: number
  joinedAt: string
}

export interface Household {
  id: string
  name: string
  inviteCode: string
  currency: 'INR'
  createdAt: string
  members: Member[]
}

export interface HouseholdSummary {
  id: string
  name: string
  memberCount: number
}

export type ExpenseSource = 'web' | 'whatsapp'

export interface Expense {
  id: string
  householdId: string
  title: string
  amount: number
  category: CategoryId
  paidBy: string
  date: ISODate
  splitType?: 'equal' | 'custom'
  splits?: { memberId: string; amount: number }[]
  note?: string
  receiptUrl?: string
  /** Where it was recorded: the app, or a WhatsApp message. */
  source?: ExpenseSource
  createdAt: string
  updatedAt: string
}

export type ExpenseInput = Pick<Expense, 'title' | 'amount' | 'category' | 'paidBy' | 'date'> & { splitType?: 'equal' | 'custom'; splits?: { memberId: string; amount: number }[];
  note?: string
  receiptUrl?: string
}

export interface ExpenseQuery {
  month?: MonthKey
  q?: string
  members?: string[]
  categories?: CategoryId[]
  from?: ISODate
  to?: ISODate
  minAmount?: number
  maxAmount?: number
}

export interface MemberSettlement {
  memberId: string
  paid: number
  share: number
  /** paid − share. Positive = should receive, negative = owes. */
  balance: number
}

export interface SettlementTransaction {
  id: string
  from: string
  to: string
  amount: number
  status: 'pending' | 'settled'
  settledAt?: string
}

export type SettlementStatus = 'empty' | 'open' | 'settled'

export interface Settlement {
  householdId: string
  month: MonthKey
  total: number
  fairShare: number
  expenseCount: number
  members: MemberSettlement[]
  transactions: SettlementTransaction[]
  status: SettlementStatus
}

export type NotificationType = 'expense' | 'owe' | 'settlement' | 'settled'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  createdAt: string
  read: boolean
  href: string
}

export interface CategoryTotal { category: CategoryId; total: number; count: number }
export interface MemberTotal { memberId: string; total: number; count: number }
export interface TrendPoint { date: ISODate; amount: number }

export interface MonthlySummary {
  month: MonthKey
  total: number
  expenseCount: number
  fairShare: number
  status: SettlementStatus
  byCategory: CategoryTotal[]
  byMember: MemberTotal[]
  topExpenses: Expense[]
  trend: TrendPoint[]
}

export interface MonthListItem {
  month: MonthKey
  total: number
  expenseCount: number
  status: SettlementStatus
}

export interface AuthSession { token: string; user: User }

/* ------------------------------ WhatsApp ------------------------------ */
export type WhatsAppGroupStatus = 'creating' | 'active' | 'failed' | 'deleted' | 'suspended'

export interface WhatsAppStatus {
  /** Server has Meta credentials configured. */
  configured: boolean
  /** Dev-only: server can fake incoming messages. */
  simulator: boolean
  /** Bot number as digits (e.g. 919876543210) for wa.me links, if known. */
  botNumber: string | null
  /** Groups API enabled for this deployment (needs an Official Business Account). */
  groupsAvailable: boolean
  isAdmin: boolean
  autoReply: boolean
  me: { linked: boolean; phoneMasked?: string; linkedAt?: string }
  group: null | { status: WhatsAppGroupStatus; subject: string; inviteLink?: string; joinedCount: number; error?: string }
  members: { memberId: string; linked: boolean }[]
}

export interface WhatsAppLinkCode { code: string; expiresAt: string; deepLink: string | null }

export interface WhatsAppActivity {
  id: string
  at: string
  outcome: 'expense' | 'undo' | 'link'
  via: 'dm' | 'group'
  memberId: string | null
  text?: string
  amount?: number
  expenseId?: string
}

export interface WhatsAppPreview {
  kind: 'expense' | 'command' | 'ignore'
  amount?: number
  title?: string
  category?: CategoryId | null
  dayOffset?: number
  confidence?: 'high' | 'medium'
  command?: string
  reason?: string
  wouldRecord: boolean
}

export interface LiveEvent {
  type: 'expense.created' | 'expense.updated' | 'expense.deleted' | 'settlement.updated' | 'whatsapp.updated'
  by?: string
  source?: ExpenseSource
  id?: string
  title?: string
  amount?: number
  category?: CategoryId
}
