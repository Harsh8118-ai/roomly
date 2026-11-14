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


test('infers month-first dates across the entire export when a day exceeds 12', () => {
  const parsed = parseWhatsAppExport([
    '[11/12/26, 11:29:29 PM] Biro 🖤: 549-surf and all',
    '[11/13/26, 8:29:22 PM] Biro 🖤: 120 dinner',
    '[11/13/26, 8:59:26 PM] You: 100 breakfast',
    '[11/13/26, 9:20:21 PM] Biro 🖤: 20 roll',
  ].join('\n'), 'house-1')
  assert.equal(parsed.length, 4)
  assert.equal(parsed[0].sentAt.getMonth(), 10)
  assert.equal(parsed[0].sentAt.getDate(), 12)
  assert.deepEqual(parsed.slice(1).map((item) => item.sentAt.getDate()), [13, 13, 13])
  assert.deepEqual(parsed.slice(1).map((item) => item.parsed.amount), [120, 100, 20])
})

test('ambiguous exports accept an explicit date order', () => {
  const content = '[11/12/26, 11:29:29 PM] Biro: 549-surf and all';
  const monthFirst = parseWhatsAppExport(content, 'house-1', { dateOrder: 'MDY' });
  const dayFirst = parseWhatsAppExport(content, 'house-1', { dateOrder: 'DMY' });
  assert.equal(monthFirst[0].sentAt.getMonth(), 10);
  assert.equal(monthFirst[0].sentAt.getDate(), 12);
  assert.equal(dayFirst[0].sentAt.getMonth(), 11);
  assert.equal(dayFirst[0].sentAt.getDate(), 11);
});

test('reports ambiguous date formats when no date disambiguates the export', async () => {
  const { detectWhatsAppDateFormat } = await import('../src/services/whatsapp/exportParser.js');
  assert.deepEqual(detectWhatsAppDateFormat('[11/11/26, 10:00 PM] You: 50 snacks'), {
    dateOrder: null, inferred: false, ambiguous: true,
  });
});
