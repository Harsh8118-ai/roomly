const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
export const formatINR = (n) => `₹${inr.format(Math.round(n))}`
export const firstName = (name = '') => name.trim().split(/\s+/)[0] || name
