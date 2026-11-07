import type { LiveEvent } from '@/types'

type Handler = (householdId: string, event: LiveEvent) => void
const handlers = new Set<Handler>()

/** In-browser stand-in for the server's live event stream. */
export const mockBus = {
  emit: (householdId: string, event: LiveEvent) => handlers.forEach((h) => h(householdId, event)),
  subscribe(handler: Handler) { handlers.add(handler); return () => handlers.delete(handler) },
}
