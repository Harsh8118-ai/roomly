import { beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import cases from './fixtures/parser-cases.json'
import { parseMessage } from '@/utils/whatsappParser'

describe('shared parser fixtures', () => {
  for (const c of cases as { text: string; expect: Record<string, unknown> }[]) {
    it(`${JSON.stringify(c.text)}`, () => {
      const r = parseMessage(c.text) as Record<string, unknown>
      for (const [k, v] of Object.entries(c.expect)) expect(r[k], k).toEqual(v)
    })
  }
})

describe('mock WhatsApp pipeline (services level)', () => {
  it('link → text an expense → totals update → undo', async () => {
    localStorage.clear(); vi.resetModules()
    localStorage.setItem('roomly.token', 'mock.m_rahul')
    const { whatsappService: wa } = await import('@/services/whatsappService')
    const { settlementService } = await import('@/services/settlementService')
    const { expenseService } = await import('@/services/expenseService')
    const { subscribeToEvents } = await import('@/services/eventsService')

    let s = await wa.getStatus()
    expect(s.configured).toBe(true)
    expect(s.me.linked).toBe(false)
    expect(s.members.filter((m) => m.linked)).toHaveLength(3)
    expect(s.group?.status).toBe('active')

    expect((await wa.simulate({ as: 'm_rahul', text: 'vegetables 150rs' })).outcome).toBe('unlinked')
    expect((await wa.simulate({ as: 'm_rahul', text: 'link RM-WRONG1' })).outcome).toBe('link-failed')
    const code = await wa.createLinkCode()
    expect(code.code).toMatch(/^RM-[A-Z0-9]{6}$/)
    expect(code.deepLink).toContain(encodeURIComponent(`link ${code.code}`))
    expect((await wa.simulate({ as: 'm_aman', text: `link ${code.code}` })).outcome).toBe('link-failed')
    expect((await wa.simulate({ as: 'm_rahul', text: `link ${code.code}` })).outcome).toBe('link')
    s = await wa.getStatus()
    expect(s.me.linked).toBe(true)
    expect(s.me.phoneMasked).toMatch(/^•••• \d{4}$/)

    const events: string[] = []
    const off = subscribeToEvents((e) => events.push(`${e.type}:${e.source}`))
    const before = (await settlementService.getSettlement('2026-10')).total

    const add = await wa.simulate({ as: 'm_rahul', text: 'vegetables 150rs', context: 'dm' })
    expect(add.outcome).toBe('expense')
    expect(add.replies[0]).toContain('✅ Added ₹150 · Vegetables · Rahul')
    expect((await settlementService.getSettlement('2026-10')).total).toBe(before + 150)
    const list = await expenseService.getExpenses({ q: 'vegetables', members: ['m_rahul'] })
    const created = list.find((e) => e.source === 'whatsapp' && e.amount === 150)!
    expect(created).toBeTruthy()
    expect(created.category).toBe('vegetables')
    expect(created.date).toBe('2026-10-28')
    expect(events).toContain('expense.created:whatsapp')

    expect((await wa.simulate({ as: 'm_rahul', text: 'I bought some vegetables for the house for 150 today', context: 'group' })).outcome).toBe('ignored')
    expect((await wa.simulate({ as: 'm_rahul', text: 'come at 5 pm', context: 'group' })).replies).toEqual([])
    expect((await wa.simulate({ as: 'm_rahul', text: 'paid kunal 500' })).outcome).toBe('ignored')
    await wa.updateSettings({ autoReply: false })
    expect((await wa.simulate({ as: 'm_rahul', text: 'milk 60', context: 'group' })).replies).toEqual([])
    await wa.updateSettings({ autoReply: true })

    expect((await wa.simulate({ as: 'm_rahul', text: 'balance' })).replies[0]).toMatch(/receive|owe|square/)
    expect((await wa.simulate({ as: 'm_rahul', text: 'total' })).replies[0]).toMatch(/October: ₹[\d,]+ across \d+ expenses/)

    // two WhatsApp expenses exist now (vegetables 150, and milk 60 from the group): undo peels them off newest-first
    expect((await wa.simulate({ as: 'm_rahul', text: 'undo' })).replies[0]).toContain('Milk')
    expect((await wa.simulate({ as: 'm_rahul', text: 'undo' })).replies[0]).toContain('Vegetables')
    expect((await wa.simulate({ as: 'm_rahul', text: 'undo' })).outcome).toBe('undo-none')
    expect((await settlementService.getSettlement('2026-10')).total).toBe(before)
    off()

    const activity = await wa.getActivity(5)
    expect(activity.length).toBeGreaterThan(0)
    expect(activity.some((a) => a.outcome === 'undo')).toBe(true)
    expect(await wa.preview('petrol 500', 'dm')).toMatchObject({ kind: 'expense', amount: 500, category: 'transport', wouldRecord: true })
    expect(await wa.preview('who is buying milk?', 'dm')).toMatchObject({ kind: 'ignore', wouldRecord: false })
  })

  it('group lifecycle: only admins; creating → active; reset link; delete', async () => {
    localStorage.clear(); vi.resetModules()
    localStorage.setItem('roomly.token', 'mock.m_aman')
    const { whatsappService: wa } = await import('@/services/whatsappService')
    await expect(wa.createGroup()).rejects.toMatchObject({ status: 403 })
    await expect(wa.updateSettings({ autoReply: false })).rejects.toMatchObject({ status: 403 })

    localStorage.setItem('roomly.token', 'mock.m_rahul')
    await expect(wa.createGroup()).rejects.toMatchObject({ status: 409 })
    const before = (await wa.getStatus()).group!.inviteLink
    expect((await wa.resetInviteLink()).group!.inviteLink).not.toBe(before)
    expect((await wa.deleteGroup()).group).toBeNull()
    expect((await wa.createGroup()).group?.status).toBe('creating')
    await new Promise((r) => setTimeout(r, 2000))
    const s = await wa.getStatus()
    expect(s.group?.status).toBe('active')
    expect(s.group?.inviteLink).toMatch(/^https:\/\/chat\.whatsapp\.com\//)
  })
})

describe('WhatsApp UI', () => {
  beforeAll(() => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('min-width'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as any))
    ;(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
    ;(globalThis as any).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
    window.scrollTo = (() => {}) as any
    Element.prototype.scrollIntoView = () => {}
  })

  async function open(path: string) {
    localStorage.clear(); vi.resetModules(); cleanup()
    localStorage.setItem('roomly.token', 'mock.m_rahul')
    window.history.pushState({}, '', path)
    const { App } = await import('@/app/App')
    render(<App />)
  }

  it('dashboard suggests WhatsApp until you link, and can be dismissed', async () => {
    await open('/app/dashboard')
    await waitFor(() => expect(screen.getByText('Log expenses from WhatsApp')).toBeTruthy(), { timeout: 5000 })
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText('Log expenses from WhatsApp')).toBeNull()
    expect(localStorage.getItem('roomly.nudge.whatsapp')).toBe('1')
  })

  it('settings: link a number through the dialog, try a message, send it, see it in activity', async () => {
    await open('/app/settings')
    await waitFor(() => expect(screen.getByText('Who can text expenses')).toBeTruthy(), { timeout: 5000 })
    expect(screen.getByText('3 of 4 linked')).toBeTruthy()
    expect(screen.getByText('Household group')).toBeTruthy()
    expect(screen.getByText(/Recent from WhatsApp/)).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Link my number' })[0])
    const dialog = await screen.findByRole('dialog', {}, { timeout: 4000 })
    await within(dialog).findByText(/^RM-[A-Z0-9]{6}$/, {}, { timeout: 4000 })
    expect(within(dialog).getByText(/Waiting for your message/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: /Simulate sending it/ }))
    await within(dialog).findByText(/You’re linked/, {}, { timeout: 6000 })
    // the dialog auto-closes 1.6s after linking, then animates out — allow for a loaded CI machine
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 10000 })
    await waitFor(() => expect(screen.getByText('4 of 4 linked')).toBeTruthy(), { timeout: 8000 })

    const input = screen.getByLabelText('Message to test') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'petrol 500' } })
    await screen.findByText('Roomly adds this', {}, { timeout: 4000 })
    fireEvent.change(input, { target: { value: 'come at 5 pm' } })
    await screen.findByText(/Roomly would ignore this/, {}, { timeout: 4000 })

    fireEvent.change(input, { target: { value: 'vegetables 150rs' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByText(/✅ Added ₹150 · Vegetables · Rahul/, {}, { timeout: 4000 })
    await screen.findByText(/texted “vegetables 150rs”/, {}, { timeout: 5000 })
  })
})
