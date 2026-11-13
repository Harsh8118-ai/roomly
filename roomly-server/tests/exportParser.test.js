import test from 'node:test'
import assert from 'node:assert/strict'
import { parseWhatsAppExport, fingerprintMessage } from '../src/services/whatsapp/exportParser.js'

test('parses common Android WhatsApp export lines and expense candidates', () => {
  const parsed = parseWhatsAppExport('13/11/26, 10:30 am - Aman: Groceries 450\n13/11/26, 10:32 am - Rahul: hello', 'house-1')
  assert.equal(parsed.length, 2)
  assert.equal(parsed[0].sender, 'Aman')
  assert.equal(parsed[0].parsed.kind, 'expense')
  assert.equal(parsed[0].parsed.amount, 450)
  assert.equal(parsed[1].parsed.kind, 'ignore')
})

test('parses common iOS WhatsApp export lines', () => {
  const parsed = parseWhatsAppExport('[13/11/26, 10:30:00 AM] Aman: Electricity bill ₹1,800', 'house-1')
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].sender, 'Aman')
  assert.equal(parsed[0].parsed.kind, 'expense')
  assert.equal(parsed[0].parsed.amount, 1800)
})

test('fingerprints are stable across whitespace and case normalization', () => {
  const date = new Date('2026-11-13T10:30:00.000Z')
  assert.equal(
    fingerprintMessage('h1', 'Aman', date, 'Groceries   450'),
    fingerprintMessage('h1', 'aman', date, 'groceries 450'),
  )
  assert.notEqual(fingerprintMessage('h1', 'Aman', date, 'Groceries 450'), fingerprintMessage('h2', 'Aman', date, 'Groceries 450'))
})
