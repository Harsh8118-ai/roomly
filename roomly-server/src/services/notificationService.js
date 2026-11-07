import { Notification } from '../models/Notification.js'
import { firstName, formatINR } from '../utils/format.js'
import { monthName } from '../utils/date.js'

const nameOf = (household, id) => household.members.id(id)?.name ?? 'Someone'
const activeUserIds = (household) => household.members.filter((m) => m.status === 'active').map((m) => String(m._id))

async function notify(household, userIds, { type, title, href }) {
  const ids = [...new Set(userIds)]
  if (!ids.length) return
  await Notification.insertMany(ids.map((userId) => ({ userId, householdId: household._id, type, title, href })))
}

export function notifyExpenseAdded(household, actor, expense) {
  const others = activeUserIds(household).filter((id) => id !== String(actor._id))
  return notify(household, others, {
    type: 'expense', href: '/app/expenses',
    title: `${firstName(actor.name)} added ${formatINR(expense.amount)} for ${expense.title.toLowerCase()}.`,
  })
}

export function notifyPayment(household, actor, tx) {
  const actorId = String(actor._id)
  const payer = firstName(nameOf(household, tx.from))
  const title = actorId === tx.from
    ? `${payer} marked ${formatINR(tx.amount)} as paid to you.`
    : `${firstName(actor.name)} confirmed ${payer}'s ${formatINR(tx.amount)} payment.`
  const targets = actorId === tx.from ? [tx.to] : actorId === tx.to ? [tx.from] : [tx.from, tx.to]
  return notify(household, targets.filter((id) => id !== actorId && activeUserIds(household).includes(id)), { type: 'settlement', href: '/app/settlement', title })
}

export function notifyAllSettled(household, month) {
  return notify(household, activeUserIds(household), { type: 'settled', href: `/app/history/${month}`, title: `All members have settled ${monthName(month)}.` })
}
