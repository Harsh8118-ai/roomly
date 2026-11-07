import { env } from '../config/env.js'

const pad = (n) => String(n).padStart(2, '0')

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: env.APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

/** Today's calendar date ("YYYY-MM-DD") in the household timezone. */
export const todayISO = () => fmt.format(new Date())
/** Calendar date of an instant, in the household timezone. */
export const isoDateOf = (date) => fmt.format(date)
export const monthOf = (iso) => iso.slice(0, 7)
export const currentMonth = () => monthOf(todayISO())
export const isMonthKey = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s)
export const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function addDays(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + delta))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`
}

export const monthRange = (month) => ({ $gte: `${month}-01`, $lte: `${month}-31` })

export const monthName = (month) =>
  new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1, 1)).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' })
