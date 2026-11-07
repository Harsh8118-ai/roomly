import { WhatsappGroup } from '../../models/Whatsapp.js'
import { ApiError } from '../../utils/ApiError.js'
import { env } from '../../config/env.js'
import { publish } from '../events.js'
import { graph, GraphError } from './client.js'
import { normalizeWaId } from './linking.js'

const STALE_CREATING_MS = 2 * 60_000
const LIVE = ['creating', 'active', 'suspended']

export const groupsAvailable = () => env.whatsapp.groupsEnabled || (env.whatsapp.simulator && !env.whatsapp.configured)
const fakeLink = (id) => `https://chat.whatsapp.com/SIM${String(id).slice(-12)}`

/** The group to show in the UI: latest one that isn't deleted. Stale "creating" groups are failed lazily. */
export async function currentGroup(householdId) {
  const g = await WhatsappGroup.findOne({ householdId, status: { $ne: 'deleted' } }).sort({ createdAt: -1 })
  if (g?.status === 'creating' && Date.now() - g.createdAt.getTime() > STALE_CREATING_MS && env.whatsapp.configured) {
    g.status = 'failed'
    g.error = 'WhatsApp didn’t confirm the group. Try creating it again.'
    await g.save()
  }
  return g
}

function friendlyCreateError(e) {
  console.error(`[whatsapp] group create failed (status ${e.status ?? '?'}, code ${e.code ?? '?'})`)
  if (e instanceof GraphError && [400, 403].includes(e.status)) {
    return 'WhatsApp rejected the request. Groups need an Official Business Account — check your number’s eligibility in Meta Business Manager.'
  }
  return 'WhatsApp couldn’t create the group right now. Try again in a minute.'
}

export async function createGroup({ household, user }) {
  if (!groupsAvailable()) throw ApiError.conflict('WhatsApp groups aren’t enabled on this server.')
  if (await WhatsappGroup.exists({ householdId: household._id, status: { $in: LIVE } })) throw ApiError.conflict('This household already has a WhatsApp group.')

  const subject = `Roomly · ${household.name}`.slice(0, 128)
  const doc = await WhatsappGroup.create({ householdId: household._id, subject, status: 'creating', createdBy: user._id })

  if (!env.whatsapp.configured) { // local simulator: no Meta, so "create" instantly
    Object.assign(doc, { status: 'active', groupId: `SIM-${doc._id}`, inviteLink: fakeLink(doc._id) })
    await doc.save()
    return doc
  }
  try {
    const resp = await graph('POST', `/${env.whatsapp.phoneNumberId}/groups`, {
      messaging_product: 'whatsapp',
      subject,
      description: `Expenses for ${household.name}. Send things like “vegetables 150”.`.slice(0, 2048),
      join_approval_mode: 'auto_approve',
    })
    doc.requestId = resp.request_id
    // Normally the invite link arrives in a webhook; use it immediately if the response already has it.
    if (resp.id && resp.invite_link) Object.assign(doc, { groupId: resp.id, inviteLink: resp.invite_link, status: 'active' })
    await doc.save()
  } catch (e) {
    doc.status = 'failed'
    doc.error = friendlyCreateError(e)
    await doc.save()
  }
  return doc
}

export async function deleteGroup({ household }) {
  const doc = await WhatsappGroup.findOne({ householdId: household._id, status: { $in: [...LIVE, 'failed'] } }).sort({ createdAt: -1 })
  if (!doc) return null
  if (doc.groupId && env.whatsapp.configured) {
    try { await graph('DELETE', `/${doc.groupId}`) } catch (e) {
      if (!(e instanceof GraphError && e.status === 404)) throw new ApiError(502, 'WhatsApp couldn’t delete the group right now. Try again.')
    }
  }
  doc.status = 'deleted'
  await doc.save()
  return doc
}

export async function resetInviteLink({ household }) {
  const doc = await WhatsappGroup.findOne({ householdId: household._id, status: 'active' })
  if (!doc) throw ApiError.conflict('There’s no active WhatsApp group yet.')
  if (env.whatsapp.configured) {
    try {
      const resp = await graph('POST', `/${doc.groupId}/invite_link`, { messaging_product: 'whatsapp' })
      doc.inviteLink = resp.invite_link
    } catch { throw new ApiError(502, 'WhatsApp couldn’t reset the link right now. Try again.') }
  } else doc.inviteLink = `${fakeLink(doc._id)}${Math.floor(Math.random() * 90 + 10)}`
  await doc.save()
  return doc
}

const errText = (errors) => String(errors?.[0]?.error_data?.details ?? errors?.[0]?.message ?? 'WhatsApp couldn’t create the group.').slice(0, 200)

/** Applies Meta's group_* webhooks (creation, joins/leaves, deletion, suspension) to our records. */
export async function applyGroupChange(field, value) {
  for (const g of value?.groups ?? []) {
    let doc = null
    if (field === 'group_lifecycle_update' && g.type === 'group_create') {
      // Only a group that is still waiting for confirmation can receive a creation result.
      doc = (g.request_id && await WhatsappGroup.findOne({ requestId: g.request_id, status: 'creating' }).sort({ createdAt: -1 }))
        || await WhatsappGroup.findOne({ status: 'creating', subject: g.subject }).sort({ createdAt: -1 }) // fallback if request_id wasn't returned
      if (!doc) continue
      if (g.errors?.length) { doc.status = 'failed'; doc.error = errText(g.errors) } else { Object.assign(doc, { status: 'active', groupId: g.group_id, inviteLink: g.invite_link, error: undefined }) }
    } else {
      doc = g.group_id ? await WhatsappGroup.findOne({ groupId: g.group_id }) : null
      if (!doc) continue
      if (field === 'group_lifecycle_update' && g.type === 'group_delete' && !g.errors?.length) doc.status = 'deleted'
      else if (field === 'group_status_update') doc.status = g.type === 'group_suspend' ? 'suspended' : g.type === 'group_suspend_cleared' ? 'active' : doc.status
      else if (field === 'group_participants_update') {
        const wa = (p) => normalizeWaId(p.wa_id ?? p.input)
        if (g.type === 'group_participants_add') for (const p of g.added_participants ?? []) if (wa(p) && !doc.joinedWaIds.includes(wa(p))) doc.joinedWaIds.push(wa(p))
        if (g.type === 'group_participants_remove') doc.joinedWaIds = doc.joinedWaIds.filter((id) => !(g.removed_participants ?? []).some((p) => wa(p) === id))
      }
    }
    await doc.save()
    publish(doc.householdId, { type: 'whatsapp.updated' })
  }
}
