import { after, before, beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import {
  addExpense, api, demoHouse, dmPayload, fakeMeta, groupEvent, groupPayload, newUser, newHousehold, postWebhook, setup, sign, teardown, PHONE_ID,
} from './helpers.js'
import { Expense } from '../src/models/Expense.js'
import { WhatsappGroup, WhatsappLink, WhatsappLinkCode, WhatsappMessage } from '../src/models/Whatsapp.js'
import { Notification } from '../src/models/Notification.js'
import { __resetAttempts } from '../src/services/whatsapp/linking.js'
import { __resetHints } from '../src/services/whatsapp/processor.js'
import { parseMessage } from '../src/services/whatsapp/parser.js'
import { subscribe } from '../src/services/events.js'
import { createApp } from '../src/app.js'
import { currentMonth, shiftMonth, todayISO } from '../src/utils/date.js'

const meta = fakeMeta()
const cases = JSON.parse(fs.readFileSync(new URL('./fixtures/parser-cases.json', import.meta.url), 'utf8'))

before(async () => { await setup(); meta.install() })
after(async () => { meta.uninstall(); await teardown() })
beforeEach(() => { meta.reset(); __resetAttempts(); __resetHints() })

describe('parser (shared fixtures with the frontend)', () => {
  for (const c of cases) {
    it(JSON.stringify(c.text), () => {
      const r = parseMessage(c.text)
      for (const [k, v] of Object.entries(c.expect)) assert.deepEqual(r[k], v, `${k} for ${c.text}`)
    })
  }
})

describe('webhook security', () => {
  it('answers Meta’s verification handshake only with the right token', async () => {
    const ok = await api().get('/api/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'test-verify-token', 'hub.challenge': '1158201444' })
    assert.equal(ok.status, 200)
    assert.equal(ok.text, '1158201444')
    assert.equal((await api().get('/api/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'x' })).status, 403)
    assert.equal((await api().get('/api/webhooks/whatsapp').query({ 'hub.mode': 'subscribe', 'hub.challenge': 'x' })).status, 403)
  })

  it('rejects missing, wrong and tampered signatures; accepts a correct one', async () => {
    const payload = dmPayload({ from: '919000000001', text: 'hello' })
    assert.equal((await api().post('/api/webhooks/whatsapp').send(payload)).status, 401)
    assert.equal((await postWebhook(payload, { signature: 'sha256=deadbeef' })).status, 401)
    assert.equal((await postWebhook(payload, { signature: sign(JSON.stringify(payload), 'another-secret') })).status, 401)
    const raw = JSON.stringify(payload)
    assert.equal((await postWebhook(payload, { raw: raw.replace('hello', 'hellp'), signature: sign(raw) })).status, 401)
    assert.equal((await postWebhook(payload)).status, 200)
  })

  it('ignores payloads that aren’t WhatsApp Business events, and other phone numbers', async () => {
    assert.equal((await postWebhook({ object: 'page', entry: [] })).status, 404)
    const h = await demoHouse()
    const foreign = dmPayload({ from: h.phone(h.rahul), text: 'vegetables 150' })
    foreign.entry[0].changes[0].value.metadata.phone_number_id = 'someone-elses-number'
    assert.equal((await postWebhook(foreign)).status, 200)
    assert.equal(await Expense.countDocuments({ householdId: h.house.id }), 0)
  })
})

describe('linking a number', () => {
  it('link code → send it from WhatsApp → linked; single use; wrong codes fail; numbers are exclusive', async () => {
    const owner = await newUser('Rahul Sharma'); const hh = await newHousehold(owner)
    const other = await newUser('Aman Verma'); await other.as(api().post('/api/households/join')).send({ inviteCode: hh.inviteCode })

    const before = await owner.as(api().get('/api/whatsapp/status'))
    assert.equal(before.body.configured, true)
    assert.equal(before.body.me.linked, false)
    assert.equal(before.body.botNumber, '919876543210')

    const { body: lc } = await owner.as(api().post('/api/whatsapp/link-code'))
    assert.match(lc.code, /^RM-[A-HJ-NP-Z2-9]{6}$/)
    assert.equal(lc.deepLink, `https://wa.me/919876543210?text=${encodeURIComponent(`link ${lc.code}`)}`)
    assert.ok(new Date(lc.expiresAt) > new Date())

    await postWebhook(dmPayload({ from: '919911112222', text: 'link RM-ZZZZZZ' }))
    assert.match(meta.texts().at(-1).text.body, /didn’t work/)
    assert.equal((await owner.as(api().get('/api/whatsapp/status'))).body.me.linked, false)

    meta.reset()
    assert.equal((await postWebhook(dmPayload({ from: '+91 99111-12222', text: `!link ${lc.code.toLowerCase()}`, name: 'Rahul' }))).status, 200)
    const reply = meta.texts().at(-1)
    if (!reply) {
      const recent = await WhatsappMessage.find().sort({ createdAt: -1 }).limit(5).select('wamid outcome via text').lean()
      assert.fail(`Expected a WhatsApp link reply; recent message outcomes: ${JSON.stringify(recent)}`)
    }
    assert.equal(reply.to, '919911112222')
    assert.equal(reply.recipient_type, 'individual')
    assert.match(reply.text.body, /^✅ Linked! Hi Rahul/)
    const status = (await owner.as(api().get('/api/whatsapp/status'))).body
    assert.equal(status.me.linked, true)
    assert.equal(status.me.phoneMasked, '•••• 2222')
    assert.deepEqual(status.members.map((m) => m.linked), [true, false])
    assert.ok(!JSON.stringify(status).includes('919911112222'), 'full number is never sent to the browser')

    meta.reset()
    await postWebhook(dmPayload({ from: '919933334444', text: `link ${lc.code}` }))
    assert.match(meta.texts().at(-1).text.body, /didn’t work/, 'single use')

    const { body: other1 } = await other.as(api().post('/api/whatsapp/link-code'))
    meta.reset()
    await postWebhook(dmPayload({ from: '919911112222', text: `link ${other1.code}` }))
    assert.match(meta.texts().at(-1).text.body, /already linked to a different/)

    await owner.as(api().delete('/api/whatsapp/link'))
    assert.equal((await owner.as(api().get('/api/whatsapp/status'))).body.me.linked, false)
  })

  it('expired codes fail, and guessing is rate limited per number', async () => {
    const u = await newUser('Tester One'); await newHousehold(u)
    const { body: lc } = await u.as(api().post('/api/whatsapp/link-code'))
    await WhatsappLinkCode.updateMany({}, { expiresAt: new Date(Date.now() - 1000) })
    meta.reset()
    await postWebhook(dmPayload({ from: '919955550001', text: `link ${lc.code}` }))
    if (!meta.texts().at(-1)) {
      const recent = await WhatsappMessage.find().sort({ createdAt: -1 }).limit(5).select('wamid outcome via text').lean()
      assert.fail(`Expected an expired-code reply; recent message outcomes: ${JSON.stringify(recent)}`)
    }
    assert.match(meta.texts().at(-1).text.body, /didn’t work/)

    for (let i = 0; i < 9; i++) await postWebhook(dmPayload({ from: '919955550002', text: `link RM-AAAA${i}A` }))
    assert.match(meta.texts().at(-1).text.body, /Too many tries/)
  })

  it('codes are never accepted in a group', async () => {
    const h = await demoHouse()
    const g = await WhatsappGroup.create({ householdId: h.house.id, groupId: 'GRP-link', subject: 's', status: 'active' })
    meta.reset()
    await postWebhook(groupPayload({ from: h.phone(h.rahul), groupId: g.groupId, text: 'link RM-ABCDEF' }))
    assert.match(meta.texts().at(-1).text.body, /private chat/)
    assert.equal(meta.texts().at(-1).recipient_type, 'group')
  })
})

describe('texting an expense to the bot', () => {
  it('"vegetables 150rs" becomes a real expense, with confirmation, notification and live event', async () => {
    const h = await demoHouse()
    const events = []
    const off = subscribe(h.house.id, (e) => events.push(e))
    assert.equal((await postWebhook(dmPayload({ from: h.phone(h.aman), text: 'vegetables 150rs' }))).status, 200)

    const list = (await h.rahul.as(api().get('/api/expenses'))).body
    assert.equal(list.length, 1)
    assert.deepEqual({ title: list[0].title, amount: list[0].amount, category: list[0].category, paidBy: list[0].paidBy, source: list[0].source, date: list[0].date },
      { title: 'Vegetables', amount: 150, category: 'vegetables', paidBy: h.aman.user.id, source: 'whatsapp', date: todayISO() })

    const reply = meta.texts().at(-1)
    assert.equal(reply.to, h.phone(h.aman))
    assert.equal(reply.text.body, '✅ Added ₹150 · Vegetables · Aman\nSend “undo” to remove it.')
    const call = meta.calls.at(-1)
    assert.equal(call.url, `https://graph.facebook.com/v23.0/${PHONE_ID}/messages`)
    assert.equal(call.headers.Authorization, 'Bearer test-token')

    assert.ok(await Notification.findOne({ userId: h.rahul.user.id, title: /Aman added ₹150 for vegetables/ }), 'housemates are notified')
    assert.equal(await Notification.countDocuments({ userId: h.aman.user.id, title: /added ₹150/ }), 0, 'not the author')
    assert.equal(events[0].type, 'expense.created'); assert.equal(events[0].source, 'whatsapp'); assert.equal(events[0].amount, 150)
    off()

    const s = (await h.rahul.as(api().get(`/api/settlements/${currentMonth()}`))).body
    assert.equal(s.total, 150)
    assert.equal(s.members.find((m) => m.memberId === h.aman.user.id).paid, 150)
  })

  it('is idempotent: Meta retrying the same message creates one expense', async () => {
    const h = await demoHouse()
    const payload = dmPayload({ from: h.phone(h.kunal), text: 'petrol 500', id: 'wamid.RETRY1' })
    for (let i = 0; i < 3; i++) assert.equal((await postWebhook(payload)).status, 200)
    assert.equal(await Expense.countDocuments({ householdId: h.house.id }), 1)
    assert.equal(meta.texts().length, 1, 'and only one confirmation')
  })

  it('a failure mid-way returns 5xx so Meta retries, and the retry succeeds exactly once', async () => {
    const h = await demoHouse()
    const payload = dmPayload({ from: h.phone(h.vikas), text: 'milk 60', id: 'wamid.FLAKY' })
    const original = Expense.create
    Expense.create = async () => { throw new Error('database blip') }
    try { assert.equal((await postWebhook(payload)).status, 500) } finally { Expense.create = original }
    assert.equal(await WhatsappMessage.countDocuments({ wamid: 'wamid.FLAKY' }), 0, 'marker removed so the retry is processed')
    assert.equal((await postWebhook(payload)).status, 200)
    assert.equal(await Expense.countDocuments({ householdId: h.house.id }), 1)
  })

  it('a failed confirmation message never undoes the expense', async () => {
    const h = await demoHouse()
    const prev = meta.respond
    meta.respond = () => ({ status: 500, body: { error: { message: 'boom', code: 1 } } })
    try { assert.equal((await postWebhook(dmPayload({ from: h.phone(h.rahul), text: 'doodh 60' }))).status, 200) } finally { meta.respond = prev }
    assert.equal(await Expense.countDocuments({ householdId: h.house.id }), 1)
  })

  it('understands "yesterday" and Hinglish', async () => {
    const h = await demoHouse()
    await postWebhook(dmPayload({ from: h.phone(h.rahul), text: 'yesterday doodh 60' }))
    const [e] = (await h.rahul.as(api().get('/api/expenses'))).body
    assert.equal(e.category, 'milk')
    const d = new Date(`${todayISO()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1)
    assert.equal(e.date, d.toISOString().slice(0, 10))
  })

  it('stays silent for chatter, questions, times, transfers between housemates', async () => {
    const h = await demoHouse()
    for (const text of ['ok', 'come at 5 pm', 'who is buying milk?', "I'll pay 200 tomorrow", 'paid kunal 500', 'good morning 5', 'room 12 key']) {
      assert.equal((await postWebhook(dmPayload({ from: h.phone(h.aman), text }))).status, 200)
    }
    assert.equal(await Expense.countDocuments({ householdId: h.house.id }), 0)
    assert.equal(meta.texts().length, 0, 'no replies to noise')
    const row = await WhatsappMessage.findOne({ outcome: 'ignored' })
    assert.equal(row.text, undefined, 'content of ignored messages is never stored')
  })

  it('tells strangers how to link, and non-text messages are skipped', async () => {
    await demoHouse()
    await postWebhook(dmPayload({ from: '919000099999', text: 'vegetables 150' }))
    assert.match(meta.texts().at(-1).text.body, /don’t know this number/)
    meta.reset()
    const img = dmPayload({ from: '919000099999', text: 'x' })
    const m = img.entry[0].changes[0].value.messages[0]; delete m.text; m.type = 'image'
    assert.equal((await postWebhook(img)).status, 200)
    assert.equal(meta.texts().length, 0)
  })

  it('a linked person with no household is nudged', async () => {
    const u = await newUser('Loner Lal')
    await WhatsappLink.create({ userId: u.user.id, waId: '919000077777' })
    await postWebhook(dmPayload({ from: '919000077777', text: 'milk 60' }))
    assert.match(meta.texts().at(-1).text.body, /Join or create a household/)
  })
})

describe('commands', () => {
  it('help, balance, total and undo', async () => {
    const h = await demoHouse()
    const say = async (u, text) => { meta.reset(); await postWebhook(dmPayload({ from: h.phone(u), text })); return meta.texts().at(-1)?.text.body }

    assert.match(await say(h.rahul, 'help'), /balance — what you owe/)
    await addExpense(h.rahul, { amount: 800, paidBy: h.rahul.user.id, date: todayISO() })
    await addExpense(h.aman, { amount: 400, paidBy: h.aman.user.id, date: todayISO() })
    assert.equal(await say(h.rahul, 'balance'), 'You should receive ₹500 this month.')
    assert.equal(await say(h.vikas, 'balance'), 'You owe ₹300 this month.')
    assert.match(await say(h.kunal, 'total'), /^\w+: ₹1,200 across 2 expenses\.$/)

    await say(h.vikas, 'groceries 250')
    assert.equal(await say(h.vikas, 'undo'), '↩️ Removed ₹250 for Groceries.')
    assert.match(await say(h.vikas, 'undo'), /Nothing to undo/)
    assert.equal(await Expense.countDocuments({ householdId: h.house.id, source: 'whatsapp' }), 0)
    assert.match(await say(h.rahul, 'undo'), /Nothing to undo/, 'web expenses can’t be undone from chat')
    assert.equal(await Expense.countDocuments({ householdId: h.house.id }), 2)
  })

  it('undo only reaches back 15 minutes', async () => {
    const h = await demoHouse()
    await postWebhook(dmPayload({ from: h.phone(h.aman), text: 'groceries 250' }))
    // createdAt is immutable in Mongoose, so backdate through the raw collection
    await Expense.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 16 * 60_000) } })
    meta.reset()
    await postWebhook(dmPayload({ from: h.phone(h.aman), text: 'undo' }))
    assert.match(meta.texts().at(-1).text.body, /Nothing to undo/)
  })

  it('refuses to touch a month that is already settled', async () => {
    const h = await demoHouse()
    const lastMonth = shiftMonth(currentMonth(), -1)
    const past = `${lastMonth}-10`
    await addExpense(h.rahul, { amount: 1000, paidBy: h.rahul.user.id, date: past })
    await addExpense(h.aman, { amount: 400, paidBy: h.aman.user.id, date: past })
    const s = (await h.rahul.as(api().get(`/api/settlements/${lastMonth}`))).body
    for (const t of s.transactions) await h.rahul.as(api().post(`/api/settlements/${lastMonth}/transactions/${encodeURIComponent(t.id)}/pay`))
    assert.equal((await h.rahul.as(api().get(`/api/settlements/${lastMonth}`))).body.status, 'settled')

    meta.reset()
    await postWebhook(dmPayload({ from: h.phone(h.kunal), text: 'milk 60', at: new Date(`${past}T08:00:00Z`) }))
    assert.match(meta.texts().at(-1).text.body, /already settled/)
    assert.equal(await Expense.countDocuments({ householdId: h.house.id, source: 'whatsapp' }), 0)
  })
})

describe('household group (Groups API)', () => {
  let h
  before(async () => { h = await demoHouse() })

  it('only admins create it; Roomly asks Meta; the invite link arrives by webhook', async () => {
    assert.equal((await h.aman.as(api().post('/api/whatsapp/group'))).status, 403)
    meta.reset()
    const res = await h.rahul.as(api().post('/api/whatsapp/group'))
    assert.equal(res.status, 201)
    assert.equal(res.body.group.status, 'creating')
    assert.equal(res.body.group.subject, 'Roomly · Casa 4')

    const call = meta.calls.find((c) => c.url.endsWith('/groups'))
    assert.equal(call.url, `https://graph.facebook.com/v23.0/${PHONE_ID}/groups`)
    assert.equal(call.method, 'POST')
    assert.deepEqual({ ...call.body, description: undefined }, { messaging_product: 'whatsapp', subject: 'Roomly · Casa 4', description: undefined, join_approval_mode: 'auto_approve' })
    assert.equal((await h.rahul.as(api().post('/api/whatsapp/group'))).status, 409, 'only one group per household')

    assert.equal((await postWebhook(groupEvent('group_lifecycle_update', { type: 'group_create', request_id: `req-${meta.requests}`, group_id: 'GRP-CASA4', subject: 'Roomly · Casa 4', invite_link: 'https://chat.whatsapp.com/ABC123' }))).status, 200)
    const st = (await h.rahul.as(api().get('/api/whatsapp/status'))).body
    assert.equal(st.group.status, 'active')
    assert.equal(st.group.inviteLink, 'https://chat.whatsapp.com/ABC123')
    assert.equal(st.group.joinedCount, 0)

    await postWebhook(groupEvent('group_participants_update', { type: 'group_participants_add', group_id: 'GRP-CASA4', reason: 'invite_link', added_participants: [{ wa_id: h.phone(h.aman) }, { wa_id: h.phone(h.kunal) }] }))
    assert.equal((await h.rahul.as(api().get('/api/whatsapp/status'))).body.group.joinedCount, 2)
    await postWebhook(groupEvent('group_participants_update', { type: 'group_participants_remove', group_id: 'GRP-CASA4', removed_participants: [{ wa_id: h.phone(h.kunal) }] }))
    assert.equal((await h.rahul.as(api().get('/api/whatsapp/status'))).body.group.joinedCount, 1)
  })

  it('records clear messages from linked members and confirms in the group', async () => {
    meta.reset()
    await postWebhook(groupPayload({ from: h.phone(h.vikas), groupId: 'GRP-CASA4', text: 'vegetables 150rs', name: 'Vikas' }))
    const e = await Expense.findOne({ householdId: h.house.id, source: 'whatsapp' })
    assert.equal(e.amount, 150); assert.equal(String(e.paidBy), h.vikas.user.id)
    const out = meta.texts().at(-1)
    assert.equal(out.recipient_type, 'group'); assert.equal(out.to, 'GRP-CASA4')
    assert.equal(out.text.body, '✅ Added ₹150 · Vegetables · Vikas', 'no "undo" hint in groups')
    assert.equal((await WhatsappMessage.findOne({ expenseId: e._id })).via, 'group')
    const feed = (await h.rahul.as(api().get('/api/whatsapp/activity'))).body
    assert.equal(feed[0].outcome, 'expense'); assert.equal(feed[0].via, 'group'); assert.equal(feed[0].memberId, h.vikas.user.id)
  })

  it('is stricter than DMs, and ignores chat', async () => {
    meta.reset()
    const before = await Expense.countDocuments({})
    for (const text of ['I bought some vegetables for the house for 150 today', 'lol 😂', 'who wants chai?', 'dinner at 8:30', 'come home by 7']) {
      await postWebhook(groupPayload({ from: h.phone(h.aman), groupId: 'GRP-CASA4', text }))
    }
    assert.equal(await Expense.countDocuments({}), before)
    assert.equal(meta.texts().length, 0)
  })

  it('never reads groups it didn’t create, or people outside the household', async () => {
    const before = await Expense.countDocuments({})
    await postWebhook(groupPayload({ from: h.phone(h.aman), groupId: 'SOMEONE-ELSES-GROUP', text: 'vegetables 150' }))
    const outsider = await newUser('Outsider'); await newHousehold(outsider, 'Elsewhere')
    await WhatsappLink.create({ userId: outsider.user.id, waId: '919000055555' })
    meta.reset()
    await postWebhook(groupPayload({ from: '919000055555', groupId: 'GRP-CASA4', text: 'vegetables 150' }))
    assert.equal(await Expense.countDocuments({}), before)
    assert.equal(meta.texts().length, 0)
  })

  it('asks unknown senders to link — once, not on every message', async () => {
    meta.reset()
    await postWebhook(groupPayload({ from: '919000066666', groupId: 'GRP-CASA4', text: 'milk 60', name: 'Anmol' }))
    await postWebhook(groupPayload({ from: '919000066666', groupId: 'GRP-CASA4', text: 'petrol 500', name: 'Anmol' }))
    await postWebhook(groupPayload({ from: '919000066666', groupId: 'GRP-CASA4', text: 'haha nice', name: 'Anmol' }))
    assert.equal(meta.texts().length, 1)
    assert.match(meta.texts()[0].text.body, /^Anmol, I can’t tell who you are yet/)
  })

  it('admins can turn the confirmations off', async () => {
    assert.equal((await h.aman.as(api().patch('/api/whatsapp/settings')).send({ autoReply: false })).status, 403)
    assert.equal((await h.rahul.as(api().patch('/api/whatsapp/settings')).send({ autoReply: false })).body.autoReply, false)
    meta.reset()
    await postWebhook(groupPayload({ from: h.phone(h.kunal), groupId: 'GRP-CASA4', text: 'milk 60' }))
    assert.equal(meta.texts().length, 0, 'recorded silently')
    assert.equal(await Expense.countDocuments({ householdId: h.house.id, title: 'Milk' }), 1)
    await postWebhook(dmPayload({ from: h.phone(h.kunal), text: 'milk 70' }))
    assert.equal(meta.texts().length, 1, 'DMs always get a reply')
    await h.rahul.as(api().patch('/api/whatsapp/settings')).send({ autoReply: true })
  })

  it('reset invite link, suspension and deletion', async () => {
    const prev = meta.respond
    meta.respond = (c) => (c.url.endsWith('/invite_link') ? { status: 200, body: { invite_link: 'https://chat.whatsapp.com/NEW999' } } : { status: 200, body: {} })
    const reset = await h.rahul.as(api().post('/api/whatsapp/group/invite-link'))
    assert.equal(reset.body.group.inviteLink, 'https://chat.whatsapp.com/NEW999')
    assert.equal((await h.aman.as(api().post('/api/whatsapp/group/invite-link'))).status, 403)

    await postWebhook(groupEvent('group_status_update', { type: 'group_suspend', group_id: 'GRP-CASA4' }))
    assert.equal((await h.rahul.as(api().get('/api/whatsapp/status'))).body.group.status, 'suspended')
    await postWebhook(groupEvent('group_status_update', { type: 'group_suspend_cleared', group_id: 'GRP-CASA4' }))
    assert.equal((await h.rahul.as(api().get('/api/whatsapp/status'))).body.group.status, 'active')

    meta.reset()
    assert.equal((await h.aman.as(api().delete('/api/whatsapp/group'))).status, 403)
    const del = await h.rahul.as(api().delete('/api/whatsapp/group'))
    assert.equal(del.body.group, null)
    assert.equal(meta.calls.find((c) => c.method === 'DELETE').url, 'https://graph.facebook.com/v23.0/GRP-CASA4')
    meta.respond = prev
    const before = await Expense.countDocuments({})
    await postWebhook(groupPayload({ from: h.phone(h.rahul), groupId: 'GRP-CASA4', text: 'milk 60' }))
    assert.equal(await Expense.countDocuments({}), before, 'messages from a deleted group are ignored')
  })

  it('surfaces a failed creation (e.g. not an Official Business Account) with a friendly reason', async () => {
    const prev = meta.respond
    meta.respond = () => ({ status: 403, body: { error: { code: 200, message: '(#200) token details: secret-ish' } } })
    const res = await h.rahul.as(api().post('/api/whatsapp/group'))
    assert.equal(res.status, 201)
    assert.equal(res.body.group.status, 'failed')
    assert.match(res.body.group.error, /Official Business Account/)
    assert.ok(!JSON.stringify(res.body).includes('secret-ish'), 'raw Meta errors never reach the browser')
    meta.respond = prev

    const again = await h.rahul.as(api().post('/api/whatsapp/group'))
    assert.equal(again.body.group.status, 'creating')
    await postWebhook(groupEvent('group_lifecycle_update', { type: 'group_create', request_id: `req-${meta.requests}`, subject: 'Roomly · Casa 4', errors: [{ code: 131, message: 'nope', error_data: { details: 'Recipient not eligible' } }] }))
    const st = (await h.rahul.as(api().get('/api/whatsapp/status'))).body
    assert.equal(st.group.status, 'failed'); assert.equal(st.group.error, 'Recipient not eligible')
  })

  it('a group stuck in "creating" is failed after two minutes', async () => {
    await WhatsappGroup.deleteMany({ householdId: h.house.id, status: 'failed' }) // leave only the stuck one
    await h.rahul.as(api().post('/api/whatsapp/group'))
    await WhatsappGroup.collection.updateMany({ status: 'creating' }, { $set: { createdAt: new Date(Date.now() - 3 * 60_000) } })
    const st = (await h.rahul.as(api().get('/api/whatsapp/status'))).body
    assert.equal(st.group.status, 'failed')
    assert.match(st.group.error, /didn’t confirm/)
  })
})

describe('REST helpers', () => {
  it('parse endpoint previews exactly what the bot would do', async () => {
    const h = await demoHouse()
    const p = async (text, context) => (await h.rahul.as(api().post('/api/whatsapp/parse')).send({ text, context })).body
    assert.deepEqual(await p('petrol 500'), { kind: 'expense', amount: 500, title: 'Petrol', category: 'transport', dayOffset: 0, confidence: 'high', wouldRecord: true })
    const medium = await p('I bought some vegetables for the house for 150 today', 'group')
    assert.equal(medium.kind, 'expense'); assert.equal(medium.wouldRecord, false)
    assert.equal((await p('I bought some vegetables for the house for 150 today', 'dm')).wouldRecord, true)
    assert.deepEqual(await p('come at 5 pm'), { kind: 'ignore', reason: 'time', wouldRecord: false })
    assert.deepEqual(await p('undo'), { kind: 'command', command: 'undo', wouldRecord: false })
  })

  it('simulator runs the real pipeline and returns the replies; members only', async () => {
    const h = await demoHouse()
    const sim = (u, text, context) => h.rahul.as(api().post('/api/whatsapp/simulate')).send({ as: u.user.id, text, context })
    const res = await sim(h.kunal, 'gas refill 1130')
    assert.equal(res.body.outcome, 'expense')
    assert.equal(res.body.replies[0], '✅ Added ₹1,130 · Utilities · Kunal\nSend “undo” to remove it.')
    assert.equal(meta.texts().length, 0, 'nothing is sent to Meta')
    assert.equal((await sim(h.kunal, 'undo')).body.outcome, 'undo')
    assert.equal((await sim(h.kunal, 'milk 60', 'group')).status, 409, 'needs the group first')
    const outsider = await newUser('Out Sider')
    assert.equal((await h.rahul.as(api().post('/api/whatsapp/simulate')).send({ as: outsider.user.id, text: 'milk 60' })).status, 422)
  })

  it('status needs a session and a household', async () => {
    assert.equal((await api().get('/api/whatsapp/status')).status, 401)
    const u = await newUser('No House')
    assert.equal((await u.as(api().get('/api/whatsapp/status'))).status, 404)
  })

  it('health reports WhatsApp mode without leaking secrets', async () => {
    const res = await api().get('/api/health')
    assert.equal(res.body.whatsapp, 'configured')
    assert.ok(!JSON.stringify(res.body).includes('test-token'))
  })
})

describe('live updates (Server-Sent Events)', () => {
  it('streams expense events to everyone in the household, and only them', async () => {
    const h = await demoHouse()
    const stranger = await newUser('Stranger'); await newHousehold(stranger, 'Other')
    const server = http.createServer(createApp()); await new Promise((r) => server.listen(0, r))
    const base = `http://127.0.0.1:${server.address().port}/api`
    const open = async (u) => {
      const ctrl = new AbortController(); const got = []
      const res = await fetch(`${base}/events`, { headers: { Authorization: `Bearer ${u.token}` }, signal: ctrl.signal })
      assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /text\/event-stream/)
      ;(async () => { try { const rd = res.body.pipeThrough(new TextDecoderStream()).getReader(); for (;;) { const { value, done } = await rd.read(); if (done) break; got.push(value) } } catch { /* aborted */ } })()
      return { ctrl, text: () => got.join('') }
    }
    try {
      const a = await open(h.aman); const s = await open(stranger)
      assert.equal((await fetch(`${base}/events`)).status, 401)
      await new Promise((r) => setTimeout(r, 100))
      await h.rahul.as(api().post('/api/expenses')).send({ title: 'Web expense', category: 'milk', amount: 60, paidBy: h.rahul.user.id, date: todayISO() })
      await postWebhook(dmPayload({ from: h.phone(h.kunal), text: 'petrol 500' }))
      await new Promise((r) => setTimeout(r, 300))
      const text = a.text()
      assert.match(text, /retry: 3000/)
      assert.match(text, /"type":"expense.created".*"source":"web"/)
      assert.match(text, /"type":"expense.created".*"source":"whatsapp".*"amount":500/)
      assert.ok(!s.text().includes('expense.created'), 'other households see nothing')
      a.ctrl.abort(); s.ctrl.abort()
    } finally { server.closeAllConnections?.(); server.close() }
  })
})
