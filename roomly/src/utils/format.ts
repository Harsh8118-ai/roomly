const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** ₹18,420 — Indian digit grouping, no paise. */
export const formatINR = (n: number) => `${n < 0 ? '−' : ''}₹${inr.format(Math.abs(Math.round(n)))}`

/** +₹635 / −₹430 / ₹0 */
export const formatSigned = (n: number) => {
  const r = Math.round(n)
  if (r === 0) return '₹0'
  return `${r > 0 ? '+' : '−'}₹${inr.format(Math.abs(r))}`
}

export const formatNumber = (n: number) => inr.format(Math.round(n))
export const formatPercent = (n: number, digits = 1) => `${n.toFixed(digits)}%`
export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name
export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
