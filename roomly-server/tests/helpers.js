import mongoose from 'mongoose'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { connectDb, disconnectDb } from '../src/config/db.js'
import { User } from '../src/models/User.js'
import { signToken } from '../src/services/tokenService.js'

export const app = createApp()
export const api = () => request(app)

export async function setup() {
  await connectDb()
  await mongoose.connection.dropDatabase()
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()))
}
export const teardown = () => disconnectDb()

let n = 0
/**
 * Creates a test user directly in the isolated test database.
 * Production authentication remains Google OAuth only; tests must not call
 * a removed password-registration endpoint.
 */
export async function newUser(name = 'Test User', email) {
  const normalizedEmail = (email ?? `user${++n}-${Date.now()}@example.com`).toLowerCase()
  const doc = await User.create({ name, email: normalizedEmail, googleId: `test-google-${normalizedEmail}` })
  const user = { id: String(doc._id), name: doc.name, email: doc.email, avatarUrl: doc.avatarUrl }
  const token = signToken(doc)
  return { token, user, as: (r) => r.set('Authorization', `Bearer ${token}`) }
}

export async function newHousehold(owner, name = 'Casa Test') {
  const res = await owner.as(api().post('/api/households')).send({ name })
  if (res.status !== 201) throw new Error(`create household failed: ${res.status}`)
  return res.body
}

export async function joinHousehold(user, code) {
  const res = await user.as(api().post('/api/households/join')).send({ inviteCode: code })
  if (res.status !== 200) throw new Error(`join failed: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body
}

export const addExpense = (user, body) =>
  user.as(api().post('/api/expenses')).send({ title: 'Test item', category: 'groceries', ...body })

/* ------------------------------- WhatsApp ------------------------------- */
import crypto from 'node:crypto'
import { __setFetch } from '../src/services/whatsapp/client.js'

export const APP_SECRET = 'test-app-secret'
export const PHONE_ID = '1065403522'
export const sign = (raw, secret = APP_SECRET) => `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`

/** POSTs a payload to the webhook exactly as Meta would (raw JSON + HMAC header). */
export function postWebhook(payload, { signature, raw } = {}) {
  const body = raw ?? JSON.stringify(payload)
  return api().post('/api/webhooks/whatsapp').set('Content-Type', 'application/json').set('X-Hub-Signature-256', signature ?? sign(body)).send(body)
}

const wrap = (field, value) => ({ object: 'whatsapp_business_account', entry: [{ id: 'WABA1', changes: [{ field, value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '919876543210', phone_number_id: PHONE_ID }, ...value } }] }] })

let seq = 0
export const ts = (d = new Date()) => String(Math.floor(d.getTime() / 1000))

/** A direct message to the bot. */
export const dmPayload = ({ from, text, id = `wamid.DM${++seq}${Date.now()}`, at, name = 'Someone' }) =>
  wrap('messages', { contacts: [{ profile: { name }, wa_id: from }], messages: [{ from, id, timestamp: ts(at), type: 'text', text: { body: text } }] })

/** A message in a Roomly-created group. */
export const groupPayload = ({ from, groupId, text, id = `wamid.GR${++seq}${Date.now()}`, at, name = 'Someone' }) =>
  wrap('messages', { contacts: [{ profile: { name }, wa_id: from }], messages: [{ from, group_id: groupId, id, timestamp: ts(at), type: 'text', text: { body: text } }] })

export const groupEvent = (field, group) => wrap(field, { groups: [{ timestamp: ts(), ...group }] })

/** Replaces Meta's Graph API. `calls` records every request; `respond` can be overridden per test. */
export function fakeMeta() {
  const meta = {
    calls: [],
    respond: (call) => (call.url.endsWith('/groups') ? { status: 200, body: { messaging_product: 'whatsapp', request_id: `req-${++meta.requests}` } } : { status: 200, body: { messages: [{ id: 'wamid.OUT' }] } }),
    requests: 0,
    reset() { meta.calls.length = 0 },
    texts: () => meta.calls.filter((c) => c.url.endsWith('/messages')).map((c) => c.body),
    install() { __setFetch(async (url, init) => {
      const call = { url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined }
      meta.calls.push(call)
      const r = meta.respond(call)
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status })
    }) },
    uninstall() { __setFetch(null) },
  }
  return meta
}

/** Household with four members, each with a linked WhatsApp number. Returns everything tests need. */
let houseSeq = 0
export async function demoHouse() {
  const batch = String(++houseSeq).padStart(3, '0')
  const { WhatsappLink } = await import('../src/models/Whatsapp.js')
  const names = ['Rahul Sharma', 'Aman Verma', 'Vikas Singh', 'Kunal Mehta']
  const users = []
  for (const name of names) users.push(await newUser(name))
  const house = await newHousehold(users[0], 'Casa 4')
  for (const u of users.slice(1)) await joinHousehold(u, house.inviteCode)
  const phones = {}
  for (const [i, u] of users.entries()) {
    phones[u.user.id] = `91981${batch}${String(i).padStart(4, '0')}` // unique per call: a number can belong to only one account
    await WhatsappLink.create({ userId: u.user.id, waId: phones[u.user.id] })
  }
  const [rahul, aman, vikas, kunal] = users
  return { house, rahul, aman, vikas, kunal, phone: (u) => phones[u.user.id] }
}
