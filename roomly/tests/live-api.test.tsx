/** Runs the real frontend against a live Roomly server. Skipped unless LIVE_API is set. */
import { describe, expect, it, beforeAll, afterEach, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const API = process.env.LIVE_API
describe.skipIf(!API)('frontend ↔ live server', () => {
  beforeAll(() => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('min-width'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as any))
    ;(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
    ;(globalThis as any).IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
    window.scrollTo = (() => {}) as any
    Element.prototype.scrollIntoView = () => {}
  })
  afterEach(() => cleanup())

  for (const [path, re] of [
    ['/app/dashboard', /Household spending/], ['/app/expenses', /Groceries — weekly stock/], ['/app/settlement', /Who pays whom/],
    ['/app/members', /Kunal Mehta/], ['/app/history', /September 2026/], ['/app/settings', /Who can text expenses/],
  ] as [string, RegExp][]) {
    it(path, async () => {
      vi.resetModules(); vi.stubEnv('VITE_API_URL', API!)
      const { authService } = await import('@/services/authService')
      localStorage.clear()
      await authService.login('rahul@roomly.app', 'roomly123')
      window.history.pushState({}, '', path)
      const { App } = await import('@/app/App')
      render(<App />)
      await waitFor(() => expect(screen.getAllByText(re).length).toBeGreaterThan(0), { timeout: 6000 })
    })
  }
})
