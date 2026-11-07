import crypto from 'node:crypto'
import { User } from '../models/User.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { publicUser } from '../utils/serializers.js'
import { signToken } from '../services/tokenService.js'
import { syncMemberProfile } from '../services/householdService.js'
import { env } from '../config/env.js'

export const googleStart = (req, res) => {
  if (!env.google.clientId || !env.google.clientSecret || !env.google.redirectUri) {
    return res.status(503).json({ message: 'Google sign-in is not configured. Add the Google OAuth environment variables to the API.' })
  }
  const state = crypto.randomBytes(24).toString('hex')
  const requestedNext = typeof req.query.next === 'string' ? req.query.next : '/'
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/'
  const stateCookie = Buffer.from(JSON.stringify({ state, next })).toString('base64url')
  res.cookie('roomly_oauth_state', stateCookie, { httpOnly: true, secure: env.isProd, sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/api/auth' })
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({ client_id: env.google.clientId, redirect_uri: env.google.redirectUri, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' }).toString()
  res.redirect(url.toString())
}

export const googleCallback = asyncHandler(async (req, res) => {
  const cookieHeader = req.headers.cookie ?? ''
  const rawCookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith('roomly_oauth_state='))?.slice('roomly_oauth_state='.length)
  let saved
  try { saved = JSON.parse(Buffer.from(decodeURIComponent(rawCookie ?? ''), 'base64url').toString()) } catch { throw ApiError.unauthorized('Google sign-in expired. Please try again.') }
  if (!req.query.state || req.query.state !== saved.state || !req.query.code) throw ApiError.unauthorized('Google sign-in could not be verified.')
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: String(req.query.code), client_id: env.google.clientId, client_secret: env.google.clientSecret, redirect_uri: env.google.redirectUri, grant_type: 'authorization_code' }),
  })
  if (!tokenResponse.ok) throw ApiError.unauthorized('Google could not complete sign-in.')
  const tokens = await tokenResponse.json()
  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } })
  if (!profileResponse.ok) throw ApiError.unauthorized('Could not read your Google profile.')
  const profile = await profileResponse.json()
  if (!profile.email || !profile.email_verified || !profile.sub) throw ApiError.unauthorized('Use a verified Google account.')
  let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email: String(profile.email).toLowerCase() }] })
  if (user) {
    if (!user.googleId) user.googleId = profile.sub
    if (profile.name) user.name = profile.name
    if (profile.picture) user.avatarUrl = profile.picture
    await user.save()
  } else {
    user = await User.create({ googleId: profile.sub, name: profile.name || profile.email.split('@')[0], email: profile.email.toLowerCase(), avatarUrl: profile.picture })
  }
  res.setHeader('Cache-Control', 'no-store')
  res.clearCookie('roomly_oauth_state', { httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/api/auth' })
  res.redirect(`${env.CLIENT_URL}/auth/callback?next=${encodeURIComponent(saved.next || '/') }#token=${encodeURIComponent(signToken(user))}`)
})

export const logout = (_req, res) => res.json({ ok: true })
export const me = (req, res) => res.json(publicUser(req.user))
export const updateMe = asyncHandler(async (req, res) => {
  const { name, tone } = req.body
  if (name) req.user.name = name
  await req.user.save()
  await syncMemberProfile(req.user._id, { name, tone })
  res.json(publicUser(req.user))
})
