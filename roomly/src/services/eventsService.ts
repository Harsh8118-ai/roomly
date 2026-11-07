import { config } from '@/app/config'
import { mockBus } from '@/mock/events'
import { resolveMockHousehold } from '@/mock/server'
import type { LiveEvent } from '@/types'
import { tokenStore } from './api/client'

/**
 * Subscribes to live household events (new expenses, WhatsApp activity, payments).
 * Mock mode uses an in-browser bus; real mode streams Server-Sent Events from
 * GET /events with fetch, so the Authorization header can be used (EventSource can't).
 * Reconnects with backoff. Returns an unsubscribe function.
 */
export function subscribeToEvents(onEvent: (e: LiveEvent) => void): () => void {
  if (config.useMock) {
    const hid = resolveMockHousehold(tokenStore.get())
    return mockBus.subscribe((householdId, event) => { if (householdId === hid) onEvent(event) })
  }

  let stopped = false
  let controller: AbortController | null = null
  let attempt = 0

  const connect = async () => {
    controller = new AbortController()
    try {
      const res = await fetch(`${config.apiUrl}/events`, {
        headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}`, Accept: 'text/event-stream' },
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`)
      attempt = 0
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        let idx
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const data = frame.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('')
          if (data) { try { onEvent(JSON.parse(data) as LiveEvent) } catch { /* ignore malformed frame */ } }
        }
      }
    } catch { /* fall through to reconnect */ }
    if (stopped) return
    attempt += 1
    setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)))
  }
  void connect()
  return () => { stopped = true; controller?.abort() }
}
