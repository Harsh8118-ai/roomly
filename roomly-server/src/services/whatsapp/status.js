import { WhatsappLink } from '../../models/Whatsapp.js'
import { env } from '../../config/env.js'
import { currentGroup, groupsAvailable } from './groups.js'
import { maskPhone } from './linking.js'

/** Everything the Settings → WhatsApp screen needs, shaped for the frontend. */
export async function buildStatus({ user, household, member }) {
  const [links, group] = await Promise.all([
    WhatsappLink.find({ userId: { $in: household.members.map((m) => m._id) } }).lean(),
    currentGroup(household._id),
  ])
  const mine = links.find((l) => String(l.userId) === String(user._id))
  return {
    configured: env.whatsapp.enabled,
    simulator: env.whatsapp.simulator,
    botNumber: env.whatsapp.displayNumber ?? null,
    groupsAvailable: groupsAvailable(),
    isAdmin: member.role === 'admin',
    autoReply: household.whatsappAutoReply,
    me: mine ? { linked: true, phoneMasked: maskPhone(mine.waId), linkedAt: mine.linkedAt.toISOString() } : { linked: false },
    group: group ? {
      status: group.status, subject: group.subject, ...(group.inviteLink ? { inviteLink: group.inviteLink } : {}),
      joinedCount: group.joinedWaIds.length, ...(group.error ? { error: group.error } : {}),
    } : null,
    members: household.members.map((m) => ({ memberId: String(m._id), linked: links.some((l) => String(l.userId) === String(m._id)) })),
  }
}
