import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { Household } from '../models/Household.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { publicHousehold, publicMember, publicUser } from '../utils/serializers.js'
import { MAX_MEMBERS } from '../constants.js'
import { createHousehold, joinHousehold, nextTone, removeMemberFromHousehold, uniqueInviteCode } from '../services/householdService.js'

export const list = asyncHandler(async (req, res) => {
  const households = await Household.find({ _id: { $in: req.user.householdIds } }).lean()
  const order = req.user.householdIds.map(String)
  households.sort((a, b) => order.indexOf(String(a._id)) - order.indexOf(String(b._id)))
  res.json(households.map((h) => ({ id: String(h._id), name: h.name, memberCount: h.members.length })))
})

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(publicHousehold(await createHousehold(req.user, req.body.name)))
})

export const invitePreview = asyncHandler(async (req, res) => {
  const code = String(req.params.inviteCode ?? '').toUpperCase()
  const household = await Household.findOne({ inviteCode: code })
  if (!household) throw ApiError.notFound('That invite link does not match a household.')
  const linked = await User.find({ _id: { $in: household.members.map((m) => m._id) } }).select('_id').lean()
  const claimed = new Set(linked.map((user) => String(user._id)))
  res.json({ id: String(household._id), name: household.name, members: household.members.filter((m) => m.status === 'active' && !claimed.has(String(m._id))).map((m) => ({ id: String(m._id), name: m.name })) })
})

export const join = asyncHandler(async (req, res) => {
  const household = await Household.findOne({ inviteCode: req.body.inviteCode.toUpperCase() })
  if (!household) throw ApiError.notFound('That invite code doesn’t match any household.')
  if (household.members.id(req.user._id)) throw ApiError.conflict('You’re already in this household.')
  if (req.body.memberId && !household.members.id(req.body.memberId)) throw ApiError.notFound('That household member is no longer available.')
  if (req.body.memberId && await User.exists({ _id: req.body.memberId })) throw ApiError.conflict('That member identity is already linked to an account.')
  if (household.members.length >= MAX_MEMBERS) throw ApiError.invalid(`A household can have up to ${MAX_MEMBERS} members.`)
  res.json(publicHousehold(await joinHousehold(req.user, household, req.body.memberId)))
})

export const switchCurrent = asyncHandler(async (req, res) => {
  const { householdId } = req.body
  if (!req.user.householdIds.some((id) => id.equals(householdId))) throw ApiError.forbidden()
  req.user.currentHouseholdId = new mongoose.Types.ObjectId(householdId)
  await req.user.save()
  res.json(publicUser(req.user))
})

export const getCurrent = asyncHandler(async (req, res) => {
  // Upgrade older household invite codes on first access so every active group uses four digits.
  if (!/^\d{4}$/.test(req.household.inviteCode)) {
    req.household.inviteCode = await uniqueInviteCode()
    await req.household.save()
  }
  res.json(publicHousehold(req.household))
})

export const rename = asyncHandler(async (req, res) => {
  req.household.name = req.body.name
  await req.household.save()
  res.json(publicHousehold(req.household))
})

export const regenerateCode = asyncHandler(async (req, res) => {
  req.household.inviteCode = await uniqueInviteCode(req.household.name)
  await req.household.save()
  res.json(publicHousehold(req.household))
})

export const members = (req, res) => res.json(req.household.members.map(publicMember))

export const invite = asyncHandler(async (req, res) => {
  const { name, email } = req.body
  const h = req.household
  if (h.members.length >= MAX_MEMBERS) throw ApiError.invalid(`A household can have up to ${MAX_MEMBERS} members.`)
  if (email && h.members.some((m) => m.email === email)) throw ApiError.conflict('That person is already in the household.')
  h.members.push({ name, email: email || undefined, role: 'member', status: 'invited', tone: nextTone(h) })
  await h.save()
  res.status(201).json(publicMember(h.members[h.members.length - 1]))
})

export const leave = asyncHandler(async (req, res) => {
  const user = await removeMemberFromHousehold(req.household, req.user._id)
  res.json(publicUser(user ?? req.user))
})

export const removeMember = asyncHandler(async (req, res) => {
  const { memberId } = req.params
  if (!mongoose.isValidObjectId(memberId) || !req.household.members.id(memberId)) throw ApiError.notFound('Member not found')
  if (String(memberId) === String(req.user._id)) throw ApiError.badRequest('Use “Leave household” to remove yourself.')
  await removeMemberFromHousehold(req.household, memberId)
  res.json({ ok: true })
})
