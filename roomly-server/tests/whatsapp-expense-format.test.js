import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMessage } from '../src/services/whatsapp/parser.js'
import { parseWhatsAppExport } from '../src/services/whatsapp/exportParser.js'

test('parses separator variants used in WhatsApp expense lists', () => {
  const cases = [
    ['Veg--120', 120, 'Veg'],
    ['Refined--90', 90, 'Refined'],
    ['Besan-30', 30, 'Besan'],
    ['533-Bazar', 533, 'Bazar'],
    ['Oil175', 175, 'Oil'],
    ['65.pani sabji..', 65, 'pani sabji'],
    ['300 veg ,Kapda', 300, 'veg Kapda'],
    ['215 Rs sabji', 215, 'sabji'],
  ]
  for (const [input, amount, title] of cases) {
    const parsed = parseMessage(input)
    assert.equal(parsed.kind, 'expense', input)
    assert.equal(parsed.amount, amount, input)
    assert.equal(parsed.title.toLowerCase(), title.toLowerCase(), input)
  }
})

test('parses Indian WhatsApp date format, sender and multiline expense entries', () => {
  const chat = [
    '11/09/25, 10:19 pm - Nitin Asm Bitgo Room: Veg--120',
    'Refined--90',
    '12/09/25, 11:36 am - Nitin Asm Bitgo Room: 80 paneer',
    '12/09/25, 11:37 am - Anmol Tyagi: 300 veg ,Kapda <This message was edited>',
    '12/09/25, 11:38 am - Nitin Asm Bitgo Room: This message was deleted',
  ].join('\n')
  const entries = parseWhatsAppExport(chat, 'test-household')
  const expenses = entries.filter((entry) => entry.parsed.kind === 'expense')
  assert.deepEqual(expenses.map(({ sender, parsed }) => [sender, parsed.amount]), [
    ['Nitin Asm Bitgo Room', 120],
    ['Nitin Asm Bitgo Room', 90],
    ['Nitin Asm Bitgo Room', 80],
    ['Anmol Tyagi', 300],
  ])
  assert.ok(entries.every((entry) => entry.sentAt instanceof Date))
})
