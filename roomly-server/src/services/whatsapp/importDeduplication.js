import { parseMessage } from './parser.js'

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
function sameMessageTime(left, right) {
  const a = new Date(left)
  const b = new Date(right)
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return false
  if (a.getTime() === b.getTime()) return true
  const sameClock = a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCHours() === b.getUTCHours()
    && a.getUTCMinutes() === b.getUTCMinutes()
    && a.getUTCSeconds() === b.getUTCSeconds()
    && a.getUTCMilliseconds() === b.getUTCMilliseconds()
  const swappedDate = a.getUTCMonth() === b.getUTCDate() - 1
    && a.getUTCDate() === b.getUTCMonth() + 1
  return sameClock && swappedDate
}

export function legacyTimestampCandidates(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return []
  // Only swap when both components could represent a month. If the day is
  // greater than 12, the export itself disambiguates the date order.
  if (date.getUTCDate() > 12) return [date]
  const swapped = new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCDate() - 1, date.getUTCMonth() + 1,
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds(),
  ))
  return [date, swapped]
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
