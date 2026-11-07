import crypto from 'node:crypto'
import { WhatsappLink, WhatsappLinkCode } from '../../models/Whatsapp.js'
import { env } from '../../config/env.js'
import { sha256 } from '../tokenService.js'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I
const CODE_TTL_MS = 10 * 60_000
const MAX_ATTEMPTS = 8
const WINDOW_MS = 60 * 60_000

export const normalizeWaId = (v) => String(v ?? '').replace(/\D/g, '')
export const maskPhone = (waId) => `•••• ${String(waId).slice(-4)}`

export async function createLinkCode(userId) {
  await WhatsappLinkCode.deleteMany({ userId })
  const code = `RM-${Array.from({ length: 6 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')}`
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)
  await WhatsappLinkCode.create({ userId, codeHash: sha256(code), expiresAt })
  const num = env.whatsapp.displayNumber
  return { code, expiresAt: expiresAt.toISOString(), deepLink: num ? `https://wa.me/${num}?text=${encodeURIComponent(`link ${code}`)}` : null }
}

// Guessing codes is the only way to attack linking, so cap attempts per phone number.
const attempts = new Map()
function allowAttempt(waId) {
  const now = Date.now()
  const rec = attempts.get(waId)
  if (!rec || rec.reset < now) { attempts.set(waId, { n: 1, reset: now + WINDOW_MS }); return true }
  rec.n += 1
  return rec.n <= MAX_ATTEMPTS
}
export const __resetAttempts = () => attempts.clear()

/** Redeems a code sent from `waId`. Returns { ok, reason?, userId? }. */
export async function redeemLinkCode({ waId, name, code }) {
  if (!allowAttempt(waId)) return { ok: false, reason: 'rate' }
  const entry = await WhatsappLinkCode.findOne({ codeHash: sha256(code.toUpperCase()), expiresAt: { $gt: new Date() } })
  if (!entry) return { ok: false, reason: 'invalid' }

  const owner = await WhatsappLink.findOne({ waId })
  if (owner && String(owner.userId) !== String(entry.userId)) return { ok: false, reason: 'taken' }

  // One number per person: re-linking replaces their previous number.
  await WhatsappLink.findOneAndUpdate({ userId: entry.userId }, { $set: { waId, displayName: name?.slice(0, 80), linkedAt: new Date() } }, { upsert: true })
  await WhatsappLinkCode.deleteMany({ userId: entry.userId })
  attempts.delete(waId)
  return { ok: true, userId: entry.userId }
}

export const unlinkUser = (userId) => WhatsappLink.deleteOne({ userId })
