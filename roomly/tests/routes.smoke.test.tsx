import { describe, expect, it, beforeAll, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: q.includes('min-width'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null } as any))
  ;(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  ;(globalThis as any).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
  window.scrollTo = (() => {}) as any
  Element.prototype.scrollIntoView = () => {}
})

const cases: [string, RegExp][] = [
  ['/', /awkward math/],
  ['/login', /Welcome back/],
  ['/register', /Create your account/],
  ['/forgot-password', /Reset your password/],
  ['/app/dashboard', /Household spending/],
  ['/app/expenses', /Sabzi mandi run|Groceries — weekly stock/],
  ['/app/expenses/e_2026-10-47', /Expense|Added/],
  ['/app/settlement', /Fair share/],
  ['/app/members', /Kunal Mehta/],
  ['/app/members/m_rahul', /Average expense/],
  ['/app/history', /September 2026/],
  ['/app/history/2026-10', /Biggest expenses/],
  ['/app/wrapped/2026-10', /Roomly Wrapped/],
  ['/app/settings', /Invite code/],
  ]

describe('smoke', () => {
  for (const [path, re] of cases) {
    it(path, async () => {
      localStorage.clear()
      if (path.startsWith('/app')) localStorage.setItem('roomly.token', 'mock.m_rahul')
      window.history.pushState({}, '', path)
      const errors: string[] = []
      const orig = console.error
      console.error = (...a: any[]) => { errors.push(String(a[0]).slice(0, 200)) }
      vi.resetModules()
      const { App } = await import('@/app/App')
      render(<App />)
      await waitFor(() => expect(screen.getAllByText(re).length).toBeGreaterThan(0), { timeout: 4000 })
      console.error = orig
      const real = errors.filter((e) => !/act\(|not wrapped|ResizeObserver|width\(0\)/.test(e))
      if (real.length) console.log(path, 'console.error:', real)
      cleanup()
    })
  }
})
