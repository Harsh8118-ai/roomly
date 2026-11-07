import crypto from 'node:crypto'
import { env } from '../config/env.js'
import { handleWebhookPayload } from '../services/whatsapp/processor.js'

/** Meta calls this once, when you press "Verify and save" on the webhook in the developer dashboard. */
export function verify(req, res) {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query
  const expected = env.whatsapp.verifyToken
  const ok = mode === 'subscribe' && expected && typeof token === 'string' && token.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  if (!ok) return res.sendStatus(403)
  res.status(200).type('text/plain').send(String(challenge))
}

/**
 * Proves the request really came from Meta: X-Hub-Signature-256 is an HMAC-SHA256 of the
 * exact raw bytes, keyed with the app secret. Anything else is rejected before parsing.
 */
export function verifySignature(req, res, next) {
  const secret = env.whatsapp.appSecret
  if (!secret) return res.sendStatus(503)
  const header = String(req.get('x-hub-signature-256') ?? '')
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody ?? Buffer.alloc(0)).digest('hex')}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.sendStatus(401)
  next()
}

export async function receive(req, res) {
  if (req.body?.object !== 'whatsapp_business_account') return res.sendStatus(404)
  try {
    await handleWebhookPayload(req.body)
    res.sendStatus(200)
  } catch (e) {
    // 5xx makes Meta retry later; message ids are deduplicated, so a retry is safe.
    console.error('[whatsapp] webhook processing failed:', e.message)
    res.sendStatus(500)
  }
}
