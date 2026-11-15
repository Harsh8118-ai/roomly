import { parseMessage } from './parser.js'
import { env } from '../../config/env.js'

const normalize = (value) => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()

function parsedParts(message) {
  const results = []
  if (message?.parsed?.kind === 'expense') results.push(message.parsed)
  for (const line of String(message?.text ?? '').split(/\n+/).map((part) => part.trim()).filter(Boolean)) {
    const parsed = parseMessage(line)
    if (parsed.kind === 'expense') results.push(parsed)
  }
  return results
}

/**
 * Recognizes expense lines already imported by the legacy block-based parser.
 * The sender, message clock time and parsed amount/title must match. This also
 * recognizes the legacy parser's month/day-swapped timestamp when its export
 * date order was ambiguous. Same-value purchases at different times stay distinct.
 */
function partsInZone(value, timeZone) {
  const date = new Date(value)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
    millisecond: date.getUTCMilliseconds(),
  }
}

function dateRepresentations(value) {
  return [partsInZone(value, 'UTC'), partsInZone(value, env.APP_TIMEZONE)]
}

function sameMessageTime(left, right) {
  const aDate = new Date(left)
  const bDate = new Date(right)
  if (!Number.isFinite(aDate.getTime()) || !Number.isFinite(bDate.getTime())) return false
  if (aDate.getTime() === bDate.getTime()) return true
  for (const a of dateRepresentations(aDate)) {
    for (const b of dateRepresentations(bDate)) {
      const sameClock = a.hour === b.hour && a.minute === b.minute
        && a.second === b.second && a.millisecond === b.millisecond
      const sameDate = a.year === b.year && a.month === b.month && a.day === b.day
      const swappedDate = a.year === b.year && a.month === b.day && a.day === b.month
      if (sameClock && (sameDate || swappedDate)) return true
    }
  }
  return false
}

function wallTimeToInstant(parts) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  let guess = target
  for (let attempt = 0; attempt < 3; attempt++) {
    const formatted = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]))
    const represented = Date.UTC(Number(formatted.year), Number(formatted.month) - 1, Number(formatted.day),
      Number(formatted.hour), Number(formatted.minute), Number(formatted.second))
    const correction = represented - target
    if (!correction) break
    guess -= correction
  }
  return new Date(guess)
}

export function legacyTimestampCandidates(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return []
  const zoned = partsInZone(date, env.APP_TIMEZONE)
  const values = [date]
  // Current imports store real instants; old versions may have stored the same
  // wall-clock timestamp as if it were UTC. Query both representations.
  values.push(new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day,
    zoned.hour, zoned.minute, zoned.second, zoned.millisecond)))
  if (zoned.day <= 12) {
    const swapped = { ...zoned, month: zoned.day, day: zoned.month }
    values.push(wallTimeToInstant(swapped))
    values.push(new Date(Date.UTC(swapped.year, swapped.month - 1, swapped.day,
      swapped.hour, swapped.minute, swapped.second, swapped.millisecond)))
  }
  return [...new Map(values.filter((item) => Number.isFinite(item.getTime())).map((item) => [item.getTime(), item])).values()]
}

export function isLegacyDuplicateExpense(candidate, existingMessages = []) {
  if (candidate?.parsed?.kind !== 'expense' || !candidate.sender || !candidate.sentAt) return false
  const expected = [
    Number(candidate.parsed.amount),
    normalize(candidate.parsed.title),
    Number(candidate.parsed.dayOffset ?? 0),
  ].join('|')

  return existingMessages.some((message) => {
    if (normalize(message.sender) !== normalize(candidate.sender)) return false
    if (!sameMessageTime(message.sentAt, candidate.sentAt)) return false
    return parsedParts(message).some((parsed) => [
      Number(parsed.amount),
      normalize(parsed.title),
      Number(parsed.dayOffset ?? 0),
    ].join('|') === expected)
  })
}
