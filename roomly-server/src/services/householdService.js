import { Household } from '../models/Household.js'
import { User } from '../models/User.js'
import { Expense } from '../models/Expense.js'
import { SettlementPayment } from '../models/SettlementPayment.js'
import { Notification } from '../models/Notification.js'
import { AVATAR_TONES } from '../constants.js'
import { randomToken } from './tokenService.js'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function randomCode(name) {
  const prefix = name.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4).padEnd(4, 'X')
  const bytes = randomToken(4)
  const suffix = [...bytes].slice(0, 4).map((c) => CODE_ALPHABET[parseInt(c, 16) % CODE_ALPHABET.length]).join('')
  return `${prefix}-${suffix}`
}

export async function uniqueInviteCode(name) {
  for (let i = 0; i < 8; i++) {
    const code = randomCode(name)
    if (!(await Household.exists({ inviteCode: code }))) return code
  }
  return `${randomCode(name)}${randomToken(1).toUpperCase()}`
}

export const nextTone = (household) => AVATAR_TONES[household.members.length % AVATAR_TONES.length]

export async function createHousehold(user, name) {
  const household = await Household.create({
    name, inviteCode: await uniqueInviteCode(name), createdBy: user._id,
    members: [{ _id: user._id, name: user.name, email: user.email, role: 'admin', status: 'active', tone: 1 }],
  })
  user.householdIds.push(household._id)
  user.currentHouseholdId = household._id
  await user.save()
  return household
}

/**
 * Joins by invite code. If the household already has an invited placeholder
 * with the same email, the newcomer takes it over — their id replaces the
 * placeholder id on every expense so history stays attached to them.
 */
export async function joinHousehold(user, household) {
  const placeholder = household.members.find((m) => m.status === 'invited' && m.email && m.email === user.email)
  if (placeholder) {
    const oldId = placeholder._id
    const { role, tone, joinedAt } = placeholder
    household.members.pull(oldId)
    household.members.push({ _id: user._id, name: user.name, email: user.email, role, status: 'active', tone, joinedAt })
    await household.save()
    await Expense.updateMany({ householdId: household._id, paidBy: oldId }, { $set: { paidBy: user._id } })
  } else {
    household.members.push({ _id: user._id, name: user.name, email: user.email, role: 'member', status: 'active', tone: nextTone(household) })
    await household.save()
  }
  if (!user.householdIds.some((id) => id.equals(household._id))) user.householdIds.push(household._id)
  user.currentHouseholdId = household._id
  await user.save()
  return household
}

/** Detaches a person from a household and tidies up (admin hand-over, empty household cleanup). */
export async function removeMemberFromHousehold(household, memberId) {
  const member = household.members.id(memberId)
  const wasAdmin = member?.role === 'admin'
  household.members.pull(memberId)

  if (household.members.length === 0) {
    await Promise.all([
      Expense.deleteMany({ householdId: household._id }),
      SettlementPayment.deleteMany({ householdId: household._id }),
      Notification.deleteMany({ householdId: household._id }),
      Household.deleteOne({ _id: household._id }),
    ])
  } else {
    if (wasAdmin && !household.members.some((m) => m.role === 'admin')) {
      const next = household.members.find((m) => m.status === 'active') ?? household.members[0]
      next.role = 'admin'
    }
    await household.save()
  }

  const user = await User.findById(memberId)
  if (user) {
    user.householdIds.pull(household._id)
    if (user.currentHouseholdId?.equals(household._id)) user.currentHouseholdId = user.householdIds[0] ?? null
    await user.save()
  }
  return user
}

/** Keeps the denormalised member copy (name/email/tone) in sync with the user profile. */
export async function syncMemberProfile(userId, patch) {
  const households = await Household.find({ 'members._id': userId })
  await Promise.all(households.map((h) => {
    const m = h.members.id(userId)
    if (!m) return null
    if (patch.name !== undefined) m.name = patch.name
    if (patch.email !== undefined) m.email = patch.email
    if (patch.tone !== undefined) m.tone = patch.tone
    return h.save()
  }))
}
