import bcrypt from 'bcryptjs'
import { User } from '../models/User.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { publicUser } from '../utils/serializers.js'
import { randomToken, sha256, signToken } from '../services/tokenService.js'
import { syncMemberProfile } from '../services/householdService.js'
import { sendMail } from '../utils/mailer.js'
import { env } from '../config/env.js'

const COST = env.isTest ? 4 : 12
// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST)

const session = (user) => ({ token: signToken(user), user: publicUser(user) })

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists.')
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, COST) })
  res.status(201).json(session(user))
})

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ email }).select('+passwordHash')
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !ok) throw ApiError.unauthorized('That email and password don’t match.')
  res.json(session(user))
})

// Tokens are stateless, so the client simply discards its token. Present for API symmetry.
export const logout = (_req, res) => res.json({ ok: true })

export const me = (req, res) => res.json(publicUser(req.user))

export const updateMe = asyncHandler(async (req, res) => {
  const { name, email, tone } = req.body
  const user = req.user
  if (email && email !== user.email) {
    if (await User.exists({ email, _id: { $ne: user._id } })) throw ApiError.conflict('An account with this email already exists.')
    user.email = email
  }
  if (name) user.name = name
  await user.save()
  await syncMemberProfile(user._id, { name, email, tone })
  res.json(publicUser(user))
})

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash')
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) throw ApiError.invalid('Your current password is incorrect.')
  user.passwordHash = await bcrypt.hash(req.body.newPassword, COST)
  user.tokenVersion += 1 // signs out every other device
  await user.save()
  res.json({ ok: true, token: signToken(user) })
})

/** Always answers "ok" so it can't be used to discover which emails have accounts. */
export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email })
  if (user) {
    const token = randomToken(32)
    user.resetTokenHash = sha256(token)
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000)
    await user.save()
    await sendMail({
      to: user.email, subject: 'Reset your Roomly password',
      text: `Hi ${user.name.split(' ')[0]},\n\nUse this link to choose a new password (valid for 1 hour):\n${env.CLIENT_URL}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
    }).catch((e) => console.error('[mail] failed', e.message))
  }
  res.json({ ok: true })
})

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ resetTokenHash: sha256(req.body.token), resetTokenExpires: { $gt: new Date() } }).select('+resetTokenHash +resetTokenExpires')
  if (!user) throw ApiError.invalid('That reset link has expired. Request a new one.')
  user.passwordHash = await bcrypt.hash(req.body.password, COST)
  user.resetTokenHash = undefined
  user.resetTokenExpires = undefined
  user.tokenVersion += 1
  await user.save()
  res.json({ ok: true })
})
