import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { addExpense, api, joinHousehold, newHousehold, newUser, setup, teardown } from './helpers.js'
import { currentMonth, shiftMonth, todayISO } from '../src/utils/date.js'

before(setup)
after(async () => { await teardown(); await fs.rm('./uploads-test', { recursive: true, force: true }) })

describe('auth (Google OAuth only)', () => {
  it('health check', async () => {
    const res = await api().get('/api/health')
    assert.equal(res.status, 200)
    assert.equal(res.body.ok, true)
  })

  it('does not expose password registration, password login, or password recovery routes', async () => {
    for (const [method, path, body] of [
      ['post', '/api/auth/register', { name: 'Test User', email: 'test@example.com', password: 'password123' }],
      ['post', '/api/auth/login', { email: 'test@example.com', password: 'password123' }],
      ['post', '/api/auth/forgot-password', { email: 'test@example.com' }],
      ['post', '/api/auth/change-password', { currentPassword: 'old', newPassword: 'newpassword123' }],
    ]) {
      const response = await api()[method](path).send(body)
      assert.equal(response.status, 404, `${method.toUpperCase()} ${path} must not be available`)
    }
  })

  it('starts Google OAuth when configured and reports missing configuration safely', async () => {
    const response = await api().get('/api/auth/google')
    assert.equal(response.status, 503)
    assert.match(response.body.message, /Google sign-in is not configured/)
  })

  it('protects the profile endpoint and issues valid test sessions', async () => {
    const user = await newUser('Rahul Sharma')
    assert.equal((await api().get('/api/auth/me')).status, 401)
    assert.equal((await api().get('/api/auth/me').set('Authorization', 'Bearer garbage')).status, 401)
    const me = await user.as(api().get('/api/auth/me'))
    assert.equal(me.status, 200)
    assert.equal(me.body.name, 'Rahul Sharma')
    assert.equal(me.body.email, user.user.email)
    assert.equal((await user.as(api().get('/api/expenses'))).status, 404)
    assert.equal((await user.as(api().post('/api/auth/logout'))).status, 200)
  })
})

describe('households', () => {
  it('creates a household with the creator as admin; member id equals user id', async () => {
    const u = await newUser('Rahul Sharma')
    const h = await newHousehold(u, 'Casa 4')
    assert.match(h.inviteCode, /^\\d{4}$/)
    assert.equal(h.members.length, 1)
    assert.equal(h.members[0].id, u.user.id)
    assert.equal(h.members[0].role, 'admin')
    const me = await u.as(api().get('/api/auth/me'))
    assert.equal(me.body.currentHouseholdId, h.id)
    const list = await u.as(api().get('/api/households'))
    assert.deepEqual(list.body, [{ id: h.id, name: 'Casa 4', memberCount: 1 }])
  })

  it('invites, joins by code, enforces admin-only rename, and supports switching', async () => {
    const owner = await newUser('Owner One')
    const h = await newHousehold(owner, 'Flat 302')
    const invited = await owner.as(api().post('/api/households/current/invites')).send({ name: 'Aman', email: '' })
    assert.equal(invited.status, 201)
    assert.equal(invited.body.status, 'invited')

    const friend = await newUser('Friend Two')
    const joined = await joinHousehold(friend, h.inviteCode.toLowerCase())
    assert.equal(joined.members.length, 3)
    assert.equal((await friend.as(api().post('/api/households/join')).send({ inviteCode: h.inviteCode })).status, 409)
    assert.equal((await friend.as(api().post('/api/households/join')).send({ inviteCode: '0000' })).status, 404)

    assert.equal((await friend.as(api().patch('/api/households/current')).send({ name: 'Hijacked' })).status, 403)
    const renamed = await owner.as(api().patch('/api/households/current')).send({ name: 'Flat 303' })
    assert.equal(renamed.body.name, 'Flat 303')

    const second = await newHousehold(owner, 'Second Home')
    const sw = await owner.as(api().put('/api/households/current')).send({ householdId: h.id })
    assert.equal(sw.body.currentHouseholdId, h.id)
    const cannot = await friend.as(api().put('/api/households/current')).send({ householdId: second.id })
    assert.equal(cannot.status, 403)
  })

  it('an invited placeholder is taken over (with their expenses) when that person joins', async () => {
    const owner = await newUser('Owner Three')
    const h = await newHousehold(owner)
    const inv = (await owner.as(api().post('/api/households/current/invites')).send({ name: 'Kunal', email: 'kunal-claim@example.com' })).body
    const e = await addExpense(owner, { amount: 300, paidBy: inv.id, date: todayISO() })
    assert.equal(e.status, 201)
    const kunal = await newUser('Kunal Mehta', 'kunal-claim@example.com')
    const joined = await joinHousehold(kunal, h.inviteCode)
    assert.equal(joined.members.length, 2)
    assert.ok(joined.members.some((m) => m.id === kunal.user.id && m.status === 'active'))
    const list = await kunal.as(api().get('/api/expenses'))
    assert.equal(list.body[0].paidBy, kunal.user.id)
  })

  it('profile updates flow into the member list', async () => {
    const u = await newUser('Old Name')
    await newHousehold(u)
    const res = await u.as(api().patch('/api/auth/me')).send({ name: 'New Name', tone: 3 })
    assert.equal(res.body.name, 'New Name')
    const h = await u.as(api().get('/api/households/current'))
    assert.equal(h.body.members[0].name, 'New Name')
    assert.equal(h.body.members[0].tone, 3)
  })
})

describe('expenses', () => {
  let owner, mate, outsider, house
  before(async () => {
    owner = await newUser('Rahul Sharma'); house = await newHousehold(owner, 'Casa 4')
    mate = await newUser('Aman Verma'); await joinHousehold(mate, house.inviteCode)
    outsider = await newUser('Stranger'); await newHousehold(outsider, 'Elsewhere')
  })

  it('validates input with friendly messages', async () => {
    const t = todayISO()
    const bad = [
      [{ amount: 0, title: 'x', category: 'milk', paidBy: owner.user.id, date: t }, /more than/],
      [{ amount: 50, title: '  ', category: 'milk', paidBy: owner.user.id, date: t }, /description/],
      [{ amount: 50, title: 'x', category: 'nope', paidBy: owner.user.id, date: t }, /category/i],
      [{ amount: 50, title: 'x', category: 'milk', paidBy: outsider.user.id, date: t }, /who paid/i],
      [{ amount: 50, title: 'x', category: 'milk', paidBy: owner.user.id, date: '2026-13-45' }, /date/i],
      [{ amount: 50, title: 'x', category: 'milk', paidBy: owner.user.id, date: '2099-01-01' }, /future/i],
    ]
    for (const [body, re] of bad) {
      const res = await owner.as(api().post('/api/expenses')).send(body)
      assert.equal(res.status, 422, JSON.stringify(body))
      assert.match(res.body.message, re)
    }
  })

  it('creates, lists with filters, searches ("grocery" finds Groceries), and fetches one', async () => {
    const t = todayISO()
    const a = await addExpense(owner, { title: 'Weekly stock', amount: 1850, category: 'groceries', paidBy: owner.user.id, date: t })
    assert.equal(a.status, 201)
    assert.equal(a.body.amount, 1850)
    assert.equal(a.body.householdId, house.id)
    await addExpense(mate, { title: 'Sabzi', amount: 320, category: 'vegetables', paidBy: mate.user.id, date: t, note: 'from the mandi' })
    await addExpense(mate, { title: 'Amul milk', amount: 130, category: 'milk', paidBy: mate.user.id, date: t })

    const all = await owner.as(api().get('/api/expenses')).query({ month: currentMonth() })
    assert.equal(all.body.length, 3)
    assert.ok(all.body[0].createdAt >= all.body[1].createdAt || all.body[0].date >= all.body[1].date)

    const byMember = await owner.as(api().get('/api/expenses')).query({ members: mate.user.id })
    assert.equal(byMember.body.length, 2)
    const byCat = await owner.as(api().get('/api/expenses')).query({ categories: 'milk,vegetables' })
    assert.equal(byCat.body.length, 2)
    const byAmount = await owner.as(api().get('/api/expenses')).query({ minAmount: 300 })
    assert.equal(byAmount.body.length, 2)
    const grocery = await owner.as(api().get('/api/expenses')).query({ q: 'grocery' })
    assert.deepEqual(grocery.body.map((e) => e.title), ['Weekly stock'])
    const person = await owner.as(api().get('/api/expenses')).query({ q: 'aman' })
    assert.equal(person.body.length, 2)
    const note = await owner.as(api().get('/api/expenses')).query({ q: 'mandi' })
    assert.equal(note.body.length, 1)

    const one = await owner.as(api().get(`/api/expenses/${a.body.id}`))
    assert.equal(one.body.title, 'Weekly stock')
    assert.equal((await owner.as(api().get('/api/expenses/not-an-id'))).status, 404)
    assert.equal((await owner.as(api().get('/api/expenses/64b64b64b64b64b64b64b64b'))).status, 404)
  })

  it('keeps households isolated', async () => {
    const mine = await owner.as(api().get('/api/expenses'))
    const theirs = await outsider.as(api().get('/api/expenses'))
    assert.equal(theirs.body.length, 0)
    const peek = await outsider.as(api().get(`/api/expenses/${mine.body[0].id}`))
    assert.equal(peek.status, 404)
    const tamper = await outsider.as(api().delete(`/api/expenses/${mine.body[0].id}`))
    assert.equal(tamper.status, 404)
  })

  it('update and delete need the payer, the creator or an admin; delete can be undone', async () => {
    const t = todayISO()
    const e = (await addExpense(mate, { title: 'Bread', amount: 60, category: 'groceries', paidBy: mate.user.id, date: t })).body
    const third = await newUser('Third Mate'); await joinHousehold(third, house.inviteCode)

    assert.equal((await third.as(api().patch(`/api/expenses/${e.id}`)).send({ amount: 1 })).status, 403)
    assert.equal((await third.as(api().delete(`/api/expenses/${e.id}`))).status, 403)

    const upd = await mate.as(api().patch(`/api/expenses/${e.id}`)).send({ amount: 75, title: 'Bread & butter', note: 'Amul' })
    assert.equal(upd.status, 200)
    assert.equal(upd.body.amount, 75)
    assert.equal(upd.body.category, 'groceries') // untouched fields survive a partial update
    const cleared = await owner.as(api().patch(`/api/expenses/${e.id}`)).send({ note: '' }) // admin may edit
    assert.equal(cleared.body.note, undefined)
    assert.equal((await mate.as(api().patch(`/api/expenses/${e.id}`)).send({ amount: -5 })).status, 422)

    const del = await mate.as(api().delete(`/api/expenses/${e.id}`))
    assert.equal(del.status, 200)
    assert.equal((await mate.as(api().get(`/api/expenses/${e.id}`))).status, 404)
    const back = await mate.as(api().post(`/api/expenses/${e.id}/restore`)).send({ ...del.body })
    assert.equal(back.status, 201)
    assert.equal(back.body.id, e.id)
    assert.equal(back.body.title, 'Bread & butter')
    assert.equal((await mate.as(api().get(`/api/expenses/${e.id}`))).status, 200)
    // restore is idempotent
    assert.equal((await mate.as(api().post(`/api/expenses/${e.id}/restore`)).send({ ...del.body })).status, 200)
  })

  it('stores receipt images and rejects anything else', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    const ok = await owner.as(api().post('/api/uploads/receipts')).send({ dataUrl: png, name: 'r.png' })
    assert.equal(ok.status, 201)
    assert.match(ok.body.url, new RegExp(`^http://localhost:5000/uploads/${house.id}/[a-f0-9]{32}\\.png$`))
    const served = await api().get(new URL(ok.body.url).pathname)
    assert.equal(served.status, 200)
    assert.match(served.headers['content-security-policy'], /sandbox/)
    const svg = await owner.as(api().post('/api/uploads/receipts')).send({ dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' })
    assert.equal(svg.status, 422)
    const junk = await owner.as(api().post('/api/uploads/receipts')).send({ dataUrl: 'data:text/html;base64,PGgxPmhpPC9oMT4=' })
    assert.equal(junk.status, 422)
    const withReceipt = await addExpense(owner, { title: 'With bill', amount: 99, paidBy: owner.user.id, date: todayISO(), receiptUrl: ok.body.url })
    assert.equal(withReceipt.body.receiptUrl, ok.body.url)
    assert.equal((await addExpense(owner, { amount: 99, paidBy: owner.user.id, date: todayISO(), receiptUrl: 'javascript:alert(1)' })).status, 422)
  })

  it('notifies housemates (not the author) and tracks read state', async () => {
    const before = (await mate.as(api().get('/api/notifications'))).body
    await addExpense(owner, { title: 'Gas refill', amount: 1130, category: 'utilities', paidBy: owner.user.id, date: todayISO() })
    const after = (await mate.as(api().get('/api/notifications'))).body
    assert.equal(after.length, before.length + 1)
    assert.match(after[0].title, /^Rahul added ₹1,130 for gas refill\.$/)
    assert.equal(after[0].read, false)
    const mine = (await owner.as(api().get('/api/notifications'))).body
    assert.ok(!mine.some((n) => /gas refill/.test(n.title)))
    await mate.as(api().post(`/api/notifications/${after[0].id}/read`))
    assert.equal((await mate.as(api().get('/api/notifications'))).body[0].read, true)
    await mate.as(api().post('/api/notifications/read-all'))
    assert.ok((await mate.as(api().get('/api/notifications'))).body.every((n) => n.read))
  })
})

describe('settlement (the demo scenario: ₹18,420 across four people)', () => {
  let rahul, aman, vikas, kunal, house
  const month = currentMonth()
  before(async () => {
    rahul = await newUser('Rahul Sharma'); house = await newHousehold(rahul, 'Casa 4')
    ;[aman, vikas, kunal] = await Promise.all(['Aman Verma', 'Vikas Singh', 'Kunal Mehta'].map((n) => newUser(n)))
    for (const u of [aman, vikas, kunal]) await joinHousehold(u, house.inviteCode)
    const t = todayISO()
    for (const [u, amount] of [[rahul, 5240], [aman, 4180], [vikas, 4320], [kunal, 4680]]) {
      assert.equal((await addExpense(u, { title: 'Monthly spend', amount, paidBy: u.user.id, date: t })).status, 201)
    }
  })

  it('computes fair share and balances that sum to zero', async () => {
    const s = (await rahul.as(api().get(`/api/settlements/${month}`))).body
    assert.equal(s.total, 18420)
    assert.equal(s.fairShare, 4605)
    assert.equal(s.expenseCount, 4)
    assert.equal(s.status, 'open')
    const bal = Object.fromEntries(s.members.map((m) => [m.memberId, m.balance]))
    assert.deepEqual(bal, { [rahul.user.id]: 635, [aman.user.id]: -425, [vikas.user.id]: -285, [kunal.user.id]: 75 })
    assert.equal(s.members.reduce((a, m) => a + m.balance, 0), 0)
    assert.deepEqual(s.transactions.map((t) => [t.from, t.to, t.amount, t.status]), [
      [aman.user.id, rahul.user.id, 425, 'pending'],
      [vikas.user.id, rahul.user.id, 210, 'pending'],
      [vikas.user.id, kunal.user.id, 75, 'pending'],
    ])
  })

  it('summary and months reflect the same numbers', async () => {
    const sum = (await rahul.as(api().get(`/api/summaries/${month}`))).body
    assert.equal(sum.total, 18420)
    assert.equal(sum.byMember.find((m) => m.memberId === rahul.user.id).total, 5240)
    assert.equal(sum.byCategory[0].category, 'groceries')
    assert.equal(sum.topExpenses[0].amount, 5240)
    assert.equal(sum.trend.length, Number(todayISO().slice(8)))
    const months = (await rahul.as(api().get('/api/months'))).body
    assert.deepEqual(months[0], { month, total: 18420, expenseCount: 4, status: 'open' })
    assert.equal((await rahul.as(api().get('/api/settlements/2026-13'))).status, 422)
  })

  it('changing an expense updates everyone’s balance', async () => {
    const list = (await rahul.as(api().get('/api/expenses'))).body
    const kunalsExp = list.find((e) => e.paidBy === kunal.user.id)
    await kunal.as(api().patch(`/api/expenses/${kunalsExp.id}`)).send({ amount: 4780 })
    const s = (await rahul.as(api().get(`/api/settlements/${month}`))).body
    assert.equal(s.total, 18520)
    assert.equal(s.members.reduce((a, m) => a + m.balance, 0), 0)
    await kunal.as(api().patch(`/api/expenses/${kunalsExp.id}`)).send({ amount: 4680 }) // put it back
  })

  it('only the people involved (or an admin) can mark a payment; settling everything notifies all', async () => {
    const s = (await rahul.as(api().get(`/api/settlements/${month}`))).body
    const [amanToRahul, vikasToRahul, vikasToKunal] = s.transactions
    const pay = (u, t) => u.as(api().post(`/api/settlements/${month}/transactions/${encodeURIComponent(t.id)}/pay`))

    assert.equal((await pay(kunal, amanToRahul)).status, 403) // uninvolved, not admin
    const first = await pay(aman, amanToRahul)
    assert.equal(first.status, 200)
    assert.equal(first.body.transactions[0].status, 'settled')
    assert.ok(first.body.transactions[0].settledAt)
    assert.equal(first.body.status, 'open')
    assert.equal((await pay(aman, amanToRahul)).status, 200) // idempotent

    const notified = (await rahul.as(api().get('/api/notifications'))).body
    assert.ok(notified.some((n) => /Aman marked ₹425 as paid to you\./.test(n.title)))

    assert.equal((await pay(rahul, vikasToRahul)).status, 200) // receiver can confirm
    const last = await pay(vikas, vikasToKunal)
    assert.equal(last.body.status, 'settled')
    for (const u of [rahul, aman, vikas, kunal]) {
      const n = (await u.as(api().get('/api/notifications'))).body
      assert.ok(n.some((x) => x.type === 'settled' && /All members have settled/.test(x.title)), 'settled notification')
    }
    assert.equal((await pay(vikas, { id: `${month}:nope>nope` })).status, 404)

    // undo one payment reopens the month
    const undo = await vikas.as(api().delete(`/api/settlements/${month}/transactions/${encodeURIComponent(vikasToKunal.id)}/pay`))
    assert.equal(undo.body.status, 'open')
    await pay(vikas, vikasToKunal)
  })

  it('adding an expense after everyone paid reopens the month (stale payments stop counting)', async () => {
    await addExpense(aman, { title: 'Late gas bill', amount: 1000, category: 'utilities', paidBy: aman.user.id, date: todayISO() })
    const s = (await rahul.as(api().get(`/api/settlements/${month}`))).body
    assert.equal(s.status, 'open')
    assert.ok(s.transactions.some((t) => t.status === 'pending'))
  })
})

describe('closed months and members who left', () => {
  it('a fully paid past month is locked against edits', async () => {
    const a = await newUser('Closer A'); const h = await newHousehold(a)
    const b = await newUser('Closer B'); await joinHousehold(b, h.inviteCode)
    const past = `${shiftMonth(currentMonth(), -1)}-10`
    const e1 = (await addExpense(a, { amount: 1000, paidBy: a.user.id, date: past })).body
    await addExpense(b, { amount: 400, paidBy: b.user.id, date: past })
    const pm = past.slice(0, 7)
    const s = (await a.as(api().get(`/api/settlements/${pm}`))).body
    assert.equal(s.transactions[0].amount, 300)
    // still editable while a payment is pending
    assert.equal((await a.as(api().patch(`/api/expenses/${e1.id}`)).send({ amount: 1000 })).status, 200)
    await b.as(api().post(`/api/settlements/${pm}/transactions/${encodeURIComponent(s.transactions[0].id)}/pay`))
    assert.equal((await a.as(api().get(`/api/settlements/${pm}`))).body.status, 'settled')
    const locked = await a.as(api().patch(`/api/expenses/${e1.id}`)).send({ amount: 1 })
    assert.equal(locked.status, 409)
    assert.match(locked.body.message, /already settled/)
    assert.equal((await a.as(api().delete(`/api/expenses/${e1.id}`))).status, 409)
    assert.equal((await addExpense(a, { amount: 5, paidBy: a.user.id, date: past })).status, 409)
  })

  it('balances still sum to zero after someone leaves; admin passes on; empty households vanish', async () => {
    const a = await newUser('Leaver A'); const h = await newHousehold(a)
    const b = await newUser('Leaver B'); await joinHousehold(b, h.inviteCode)
    const c = await newUser('Leaver C'); await joinHousehold(c, h.inviteCode)
    for (const [u, amount] of [[a, 900], [b, 300], [c, 0 + 600]]) await addExpense(u, { amount, paidBy: u.user.id, date: todayISO() })

    const left = await a.as(api().delete('/api/households/current/members/me'))
    assert.equal(left.status, 200)
    assert.equal(left.body.currentHouseholdId, null)
    const h2 = (await b.as(api().get('/api/households/current'))).body
    assert.equal(h2.members.length, 2)
    assert.ok(h2.members.some((m) => m.role === 'admin'), 'someone was promoted to admin')

    const s = (await b.as(api().get(`/api/settlements/${currentMonth()}`))).body
    assert.equal(s.total, 1800)
    assert.equal(s.members.length, 3) // includes the person who left, for the month they paid
    assert.equal(s.members.reduce((x, m) => x + m.balance, 0), 0)

    await b.as(api().delete('/api/households/current/members/me'))
    await c.as(api().delete('/api/households/current/members/me'))
    const gone = await a.as(api().get('/api/households'))
    assert.deepEqual(gone.body, [])
  })

  it('admins can remove a member; non-admins cannot', async () => {
    const a = await newUser('Boss'); const h = await newHousehold(a)
    const b = await newUser('Worker'); await joinHousehold(b, h.inviteCode)
    assert.equal((await b.as(api().delete(`/api/households/current/members/${a.user.id}`))).status, 403)
    assert.equal((await a.as(api().delete(`/api/households/current/members/${a.user.id}`))).status, 400)
    assert.equal((await a.as(api().delete(`/api/households/current/members/${b.user.id}`))).status, 200)
    assert.equal((await b.as(api().get('/api/households/current'))).status, 404) // no household now
  })
})

describe('plumbing', () => {
  it('returns JSON 404s and rejects malformed JSON', async () => {
    const nf = await api().get('/api/nope')
    assert.equal(nf.status, 404)
    assert.equal(nf.body.message, 'Not found')
    const bad = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{oops')
    assert.equal(bad.status, 400)
  })

  it('CORS allows the configured client origin only', async () => {
    const ok = await api().options('/api/expenses').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'GET')
    assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:5173')
    const no = await api().options('/api/expenses').set('Origin', 'http://evil.example').set('Access-Control-Request-Method', 'GET')
    assert.equal(no.headers['access-control-allow-origin'], undefined)
  })
})
