import mongoose from 'mongoose'

/**
 * A recorded payment for one simplified transaction. The transaction itself is
 * derived from expenses on every request; this just remembers that it was paid.
 * If expenses change and the amount no longer matches, the payment stops counting.
 */
const schema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, required: true },
  month: { type: String, required: true },
  txId: { type: String, required: true },
  amount: { type: Number, required: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt: { type: Date, default: Date.now },
})
schema.index({ householdId: 1, txId: 1 }, { unique: true })
schema.index({ householdId: 1, month: 1 })

export const SettlementPayment = mongoose.model('SettlementPayment', schema)
