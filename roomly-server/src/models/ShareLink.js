import mongoose from 'mongoose'

const shareLinkSchema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  showMemberBreakdown: { type: Boolean, default: false },
}, { timestamps: true })

shareLinkSchema.index({ householdId: 1, createdAt: -1 })
export const ShareLink = mongoose.model('ShareLink', shareLinkSchema)
