import test from 'node:test'
import assert from 'node:assert/strict'
import { isLegacyDuplicateExpense } from '../src/services/whatsapp/importDeduplication.js'

const candidate = {
  sender: 'Biro 🖤',
  sentAt: new Date('2026-11-13T20:29:22.000Z'),
  parsed: { kind: 'expense', amount: 120, title: 'Dinner', dayOffset: 0 },
}

test('matches a current expense line against a legacy multiline ledger message', () => {
  assert.equal(isLegacyDuplicateExpense(candidate, [{
    sender: 'Biro 🖤',
    sentAt: candidate.sentAt,
    text: '120 dinner\n100 breakfast\n20 roll',
  }]), true)
})

test('does not collapse same-value expenses sent at different times', () => {
  assert.equal(isLegacyDuplicateExpense(candidate, [{
    sender: 'Biro 🖤',
    sentAt: new Date(candidate.sentAt.getTime() + 1000),
    text: '120 dinner',
  }]), false)
})

test('does not treat another sender or amount as a duplicate', () => {
  assert.equal(isLegacyDuplicateExpense(candidate, [
    { sender: 'You', sentAt: candidate.sentAt, text: '120 dinner' },
    { sender: 'Biro 🖤', sentAt: candidate.sentAt, text: '121 dinner' },
  ]), false)
})

test('matches legacy records with an old month/day-swapped timestamp', () => {
  const nov12 = new Date('2026-11-12T21:46:34.000Z')
  const dec11 = new Date('2026-12-11T21:46:34.000Z')
  assert.equal(isLegacyDuplicateExpense({
    sender: 'Biro 🖤',
    sentAt: nov12,
    parsed: { kind: 'expense', amount: 533, title: 'Bazar', dayOffset: 0 },
  }, [{
    sender: 'Biro 🖤',
    sentAt: dec11,
    text: '533-Bazar',
  }]), true)
})


test('provides exact and month/day-swapped timestamp query candidates', () => {
  const candidates = legacyTimestampCandidates(candidate.sentAt)
  assert.equal(candidates.length, 1, '13 cannot be a month, so date order is already clear')
  assert.equal(candidates[0].toISOString(), candidate.sentAt.toISOString())
  const ambiguous = legacyTimestampCandidates(new Date('2026-11-12T21:46:34.000Z'))
  assert.equal(ambiguous.length, 2)
  assert.equal(ambiguous[1].toISOString(), '2026-12-11T21:46:34.000Z')
})
