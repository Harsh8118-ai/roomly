import crypto from 'node:crypto'
import { parseMessage } from './parser.js'

const HEADER_PATTERNS = [
  /^\uFEFF?\[(\d{1,4}[/-]\d{1,2}[/-]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)\]\s*([^:]+):\s?(.*)$/i,
  /^\uFEFF?(\d{1,4}[/-]\d{1,2}[/-]\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)\s+-\s+([^:]+):\s?(.*)$/i,
]

function parseDate(datePart, timePart, dateOrder = 'DMY') {
  const bits = datePart.split(/[/-]/).map(Number)
  let day, month, year
  if (bits[0] > 31) [year, month, day] = bits
  else if (dateOrder === 'MDY') [month, day, year] = bits
  else [day, month, year] = bits
  if (year < 100) year += year >= 70 ? 1900 : 2000
  const time = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(timePart.trim())
  if (!time) return null
  let hour = Number(time[1])
  const meridiem = time[4]?.toLowerCase()
  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0
  const value = new Date(year, month - 1, day, hour, Number(time[2]), Number(time[3] ?? 0))
  return Number.isNaN(value.getTime()) || value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day ? null : value
}

function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function fingerprintMessage(householdId, sender, sentAt, text) {
  return crypto.createHash('sha256').update([
    String(householdId), normalize(sender), new Date(sentAt).toISOString(), normalize(text),
  ].join('|')).digest('hex')
}

export function detectWhatsAppDateFormat(content) {
  const lines = String(content ?? '').replace(/\r\n?/g, '\n').split('\n')
  for (const line of lines) {
    const header = HEADER_PATTERNS.map((pattern) => pattern.exec(line)).find(Boolean)
    if (!header) continue
    const [first, second] = header[1].split(/[/-]/).map(Number)
    if (first > 12 && first <= 31) return { dateOrder: 'DMY', inferred: true, ambiguous: false }
    if (second > 12 && second <= 31) return { dateOrder: 'MDY', inferred: true, ambiguous: false }
  }
  return { dateOrder: null, inferred: false, ambiguous: true }
}

export function parseWhatsAppExport(content, householdId, options = {}) {
  const lines = String(content ?? '').replace(/\r\n?/g, '\n').split('\n')
  const detected = detectWhatsAppDateFormat(content)
  const dateOrder = options.dateOrder === 'MDY' || options.dateOrder === 'DMY'
    ? options.dateOrder
    : detected.dateOrder ?? 'DMY'
  const messages = []
  let current = null

  for (const line of lines) {
    const match = HEADER_PATTERNS.map((pattern) => pattern.exec(line)).find(Boolean)
    if (match) {
      if (current) messages.push(current)
      const sentAt = parseDate(match[1], match[2], dateOrder)
      current = sentAt ? { sender: match[3].trim(), sentAt, text: match[4] ?? '' } : null
    } else if (current && line.trim()) {
      current.text += '\n' + line
    }
  }
  if (current) messages.push(current)

  const entries = []
  for (const message of messages) {
    const parts = message.text.split(/\n+/).map((part) => part.trim()).filter(Boolean)
    const parsedParts = parts.map((text) => ({ text, parsed: parseMessage(text) }))
    const expenseParts = parsedParts.filter((part) => part.parsed.kind === 'expense')
    const selected = expenseParts.length > 0 ? parsedParts : [{
      text: message.text.trim(),
      parsed: parseMessage(message.text),
    }]
    for (const part of selected) {
      entries.push({
        sender: message.sender,
        sentAt: message.sentAt,
        text: part.text,
        fingerprint: fingerprintMessage(householdId, message.sender, message.sentAt, part.text),
        parsed: part.parsed,
      })
    }
  }
  return entries
}
