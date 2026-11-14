import { randomInt } from 'node:crypto'
import { Household } from '../models/Household.js'
import { User } from '../models/User.js'
import { Expense } from '../models/Expense.js'
import { SettlementPayment } from '../models/SettlementPayment.js'
import { Notification } from '../models/Notification.js'
import { ImportedMessage } from '../models/ImportedMessage.js'
import { AVATAR_TONES } from '../constants.js'

export async function uniqueInviteCode() {
  for (let i = 0; i < 40; i++) {
    const code = String(randomInt(0, 10000)).padStart(4, '0')
    if (!(await Household.exists({ inviteCode: code }))) return code
  }
  throw new Error('Could not allocate an invite code. Try again.')
}
export const nextTone = (household) => AVATAR_TONES[household.members.length % AVATAR_TONES.length]
export async function createHousehold(user, name) {
  const household = await Household.create({
    name, inviteCode: await uniqueInviteCode(), createdBy: user._id,
    members: [{ _id: user._id, name: user.name, email: user.email, role: 'admin', status: 'active', tone: 1 }],
  })
  user.householdIds.push(household._id); user.currentHouseholdId = household._id
  await user.save()
  return household
}
export async function joinHousehold(user, household, selectedMemberId, joinAsNew = false) {
  const placeholder = household.members.find((m) => m.status === 'invited' && m.email && m.email === user.email)
  const selected = selectedMemberId ? household.members.id(selectedMemberId) : (joinAsNew ? null : placeholder)
  if (selected) {
    const oldId = selected._id
    const { role, tone, joinedAt, name } = selected
    household.members.pull(oldId)
    household.members.push({ _id: user._id, name, email: user.email, role, status: 'active', tone, joinedAt })
    await household.save()
    if (String(oldId) !== String(user._id)) {
      await Expense.updateMany({ householdId: household._id, paidBy: oldId }, { $set: { paidBy: user._id } })
      await Expense.updateMany({ householdId: household._id, 'splits.memberId': oldId }, [{ $set: { splits: { $map: { input: '$splits', as: 'split', in: { $mergeObjects: ['$$split', { memberId: { $cond: [{ $eq: ['$$split.memberId', oldId] }, user._id, '$$split.memberId'] } }] } } } } }])
      await ImportedMessage.updateMany({ householdId: household._id, senderMemberId: oldId }, { $set: { senderMemberId: user._id } })
      // Settlement transaction IDs are derived from member IDs; clear stale acknowledgements after identity reassignment.
      await SettlementPayment.deleteMany({ householdId: household._id })
    }
  } else {
    household.members.push({ _id: user._id, name: user.name, email: user.email, role: 'member', status: 'active', tone: nextTone(household) })
    await household.save()
  }
  if (!user.householdIds.some((id) => id.equals(household._id))) user.householdIds.push(household._id)
  user.currentHouseholdId = household._id
  await user.save()
  return household
}
export async function removeMemberFromHousehold(household, memberId) {
  const member = household.members.id(memberId); const wasAdmin = member?.role === 'admin'
  household.members.pull(memberId)
  if (!household.members.length) {
    await Promise.all([Expense.deleteMany({ householdId: household._id }), SettlementPayment.deleteMany({ householdId: household._id }), Notification.deleteMany({ householdId: household._id }), Household.deleteOne({ _id: household._id })])
  } else {
    if (wasAdmin && !household.members.some((m) => m.role === 'admin')) (household.members.find((m) => m.status === 'active') ?? household.members[0]).role = 'admin'
    await household.save()
  }
  const user = await User.findById(memberId)
  if (user) { user.householdIds.pull(household._id); if (user.currentHouseholdId?.equals(household._id)) user.currentHouseholdId = user.householdIds[0] ?? null; await user.save() }
  return user
}
export async function syncMemberProfile(userId, patch) {
  const households = await Household.find({ 'members._id': userId })
  await Promise.all(households.map((h) => {
    const m = h.members.id(userId); if (!m) return null
    if (patch.name !== undefined) m.name = patch.name
    if (patch.email !== undefined) m.email = patch.email
    if (patch.tone !== undefined) m.tone = patch.tone
    return h.save()
  }))
}
