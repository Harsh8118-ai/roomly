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
 * The timestamp is intentionally exact: two same-value purchases at different
 * times remain distinct expenses.
 */
export function isLegacyDuplicateExpense(candidate, existingMessages = []) {
  if (candidate?.parsed?.kind !== 'expense' || !candidate.sender || !candidate.sentAt) return false
  const candidateTime = new Date(candidate.sentAt).getTime()
  const expected = [
    Number(candidate.parsed.amount),
    normalize(candidate.parsed.title),
    Number(candidate.parsed.dayOffset ?? 0),
  ].join('|')

  return existingMessages.some((message) => {
    if (normalize(message.sender) !== normalize(candidate.sender)) return false
    if (new Date(message.sentAt).getTime() !== candidateTime) return false
    return parsedParts(message).some((parsed) => [
      Number(parsed.amount),
      normalize(parsed.title),
      Number(parsed.dayOffset ?? 0),
    ].join('|') === expected)
  })
}
