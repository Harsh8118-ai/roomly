/**
 * Live updates. Each open Roomly tab holds a Server-Sent Events stream; whenever
 * something changes (an expense from the app or WhatsApp, a payment) we push a small
 * event so every screen can refresh without polling.
 *
 * In-process on purpose: it needs no extra infrastructure for a single server.
 * Running more than one API instance? Replace publish() with Redis pub/sub (or Mongo
 * change streams) — callers don't change.
 */
const channels = new Map() // householdId -> Set<write fn>
const MAX_LISTENERS_PER_HOUSEHOLD = 100

export function subscribe(householdId, write) {
  const key = String(householdId)
  let set = channels.get(key)
  if (!set) channels.set(key, (set = new Set()))
  if (set.size >= MAX_LISTENERS_PER_HOUSEHOLD) return null
  set.add(write)
  return () => { set.delete(write); if (set.size === 0) channels.delete(key) }
}

export function publish(householdId, event) {
  const set = channels.get(String(householdId))
  if (!set) return
  for (const write of set) { try { write(event) } catch { /* a dead socket cleans itself up on close */ } }
}

export const listenerCount = (householdId) => channels.get(String(householdId))?.size ?? 0
