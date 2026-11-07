import { env } from '../../config/env.js'

/** Error from Meta's Graph API. `code` is Meta's numeric error code (never includes secrets). */
export class GraphError extends Error {
  constructor(status, metaError, message) {
    super(message ?? metaError?.message ?? `Graph API error (${status})`)
    this.name = 'GraphError'
    this.status = status
    this.code = metaError?.code
    this.details = metaError?.error_data?.details
  }
}

let fetchImpl = (...args) => globalThis.fetch(...args)
/** Tests swap this for a fake Meta. */
export const __setFetch = (fn) => { fetchImpl = fn ?? ((...a) => globalThis.fetch(...a)) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Calls the Graph API with a timeout and one retry on network errors, 429 and 5xx. */
export async function graph(method, path, body) {
  const w = env.whatsapp
  if (!w.configured) throw new GraphError(0, null, 'WhatsApp is not configured')
  const url = `https://graph.facebook.com/${w.graphVersion}${path}`
  for (let attempt = 0; ; attempt++) {
    let res
    try {
      res = await fetchImpl(url, {
        method,
        headers: { Authorization: `Bearer ${w.token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      if (attempt === 0) { await sleep(400); continue }
      throw new GraphError(0, null, 'Could not reach WhatsApp')
    }
    if ((res.status >= 500 || res.status === 429) && attempt === 0) { await sleep(400); continue }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new GraphError(res.status, data?.error)
    return data
  }
}

/**
 * Sends a text message. Never throws: a failed confirmation must not undo the
 * expense that was just recorded. Returns true if Meta accepted it.
 */
export async function sendText({ to, text, group = false }) {
  if (!env.whatsapp.configured) return false
  try {
    await graph('POST', `/${env.whatsapp.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: group ? 'group' : 'individual',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    })
    return true
  } catch (e) {
    console.error(`[whatsapp] send failed (status ${e.status ?? '?'}, code ${e.code ?? '?'})`)
    return false
  }
}
