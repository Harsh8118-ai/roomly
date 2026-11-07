import { config } from '@/app/config'
import type { ISODate, MonthKey } from '@/types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Parse "YYYY-MM-DD" as a local date (avoids UTC off-by-one). */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Today" — the real day, or the fixed demo day in mock mode. */
export function todayISO(): ISODate {
  return config.useMock ? config.demoToday : toISODate(new Date())
}

export const monthOf = (iso: ISODate): MonthKey => iso.slice(0, 7)
export const currentMonth = (): MonthKey => monthOf(todayISO())

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function addDays(iso: ISODate, delta: number): ISODate {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + delta)
  return toISODate(d)
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86_400_000)
}

export const monthLabel = (month: MonthKey, opts: { short?: boolean; year?: boolean } = {}) => {
  const { short = false, year = true } = opts
  return parseISODate(`${month}-01`).toLocaleDateString('en-IN', {
    month: short ? 'short' : 'long',
    ...(year ? { year: 'numeric' } : {}),
  })
}

/** Human-friendly: Today · Yesterday · 2 Oct · 2 Oct 2025 (if another year) */
export function formatDate(iso: ISODate): string {
  const today = todayISO()
  const diff = diffDays(today, iso)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  const d = parseISODate(iso)
  const sameYear = d.getFullYear() === parseISODate(today).getFullYear()
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export const formatLongDate = (iso: ISODate) =>
  parseISODate(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

export const formatWeekday = (iso: ISODate) =>
  parseISODate(iso).toLocaleDateString('en-IN', { weekday: 'long' })

/** Relative timestamps for notifications and activity: "5 min ago", "Yesterday". */
export function timeAgo(isoTimestamp: string): string {
  const now = config.useMock ? parseISODate(config.demoToday).getTime() + 21 * 3_600_000 + 40 * 60_000 : Date.now()
  const diff = Math.max(0, now - new Date(isoTimestamp).getTime())
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const days = Math.floor(hr / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(isoTimestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export const formatTimestamp = (isoTimestamp: string) =>
  new Date(isoTimestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export function greeting(): string {
  const h = config.useMock ? 20 : new Date().getHours()
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
