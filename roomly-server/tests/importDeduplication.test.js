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
    text: '120 dinner\\n100 breakfast\\n20 roll',
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
