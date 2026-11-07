import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
  type: { type: String, enum: ['expense', 'owe', 'settlement', 'settled'], required: true },
  title: { type: String, required: true, maxlength: 240 },
  href: { type: String, default: '/app/dashboard' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
})
schema.index({ userId: 1, householdId: 1, createdAt: -1 })
// Old notifications clean themselves up after 90 days (MongoDB TTL index).
// Set DISABLE_TTL_INDEX=true for Mongo-compatible databases that don't implement TTL indexes (e.g. FerretDB).
if (process.env.DISABLE_TTL_INDEX !== 'true') schema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 })

export const Notification = mongoose.model('Notification', schema)
