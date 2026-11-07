import { SettlementPayment } from '../models/SettlementPayment.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { publicExpense } from '../utils/serializers.js'
import { buildSummary, getSettlement, isMonthClosed, listMonths } from '../services/settlementService.js'
import { notifyAllSettled, notifyPayment } from '../services/notificationService.js'
import { publish } from '../services/events.js'

export const settlement = asyncHandler(async (req, res) => res.json(await getSettlement(req.household, req.params.month)))

export const summary = asyncHandler(async (req, res) => {
  const s = await buildSummary(req.household, req.params.month)
  res.json({ ...s, topExpenses: s.topExpenses.map(publicExpense) })
})

export const months = asyncHandler(async (req, res) => res.json(await listMonths(req.household)))

/** Only the payer, the receiver or an admin can record a payment. */
function assertCanRecord(req, tx) {
  const me = String(req.user._id)
  if (req.member.role === 'admin' || me === tx.from || me === tx.to) return
  throw ApiError.forbidden('Only the people involved, or an admin, can mark this as paid.')
}

export const markPaid = asyncHandler(async (req, res) => {
  const { month, tx: txId } = req.params
  const household = req.household
  const before = await getSettlement(household, month)
  if (await isMonthClosed(household, month)) throw ApiError.conflict('This month is already settled.')
  const tx = before.transactions.find((t) => t.id === txId)
  if (!tx) throw ApiError.notFound('Payment not found')
  assertCanRecord(req, tx)

  if (tx.status === 'pending') {
    await SettlementPayment.findOneAndUpdate(
      { householdId: household._id, txId },
      { $set: { month, amount: tx.amount, paidBy: req.user._id, paidAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    const after = await getSettlement(household, month)
    await notifyPayment(household, req.user, tx).catch((e) => console.error('[notify]', e.message))
    if (after.status === 'settled') await notifyAllSettled(household, month).catch((e) => console.error('[notify]', e.message))
    publish(household._id, { type: 'settlement.updated', by: String(req.user._id) })
    return res.json(after)
  }
  res.json(before) // already paid — idempotent
})

export const markUnpaid = asyncHandler(async (req, res) => {
  const { month, tx: txId } = req.params
  const household = req.household
  if (await isMonthClosed(household, month)) throw ApiError.conflict('This month is already settled.')
  const tx = (await getSettlement(household, month)).transactions.find((t) => t.id === txId)
  if (!tx) throw ApiError.notFound('Payment not found')
  assertCanRecord(req, tx)
  await SettlementPayment.deleteOne({ householdId: household._id, txId })
  publish(household._id, { type: 'settlement.updated', by: String(req.user._id) })
  res.json(await getSettlement(household, month))
})
