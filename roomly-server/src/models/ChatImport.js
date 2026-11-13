import mongoose from 'mongoose'

const chatImportSchema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename: { type: String, required: true, maxlength: 180 },
  status: { type: String, enum: ['review', 'completed'], default: 'review' },
  stats: {
    total: { type: Number, default: 0 },
    newMessages: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 },
    candidates: { type: Number, default: 0 },
    ignored: { type: Number, default: 0 },
    approved: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
    unmatched: { type: Number, default: 0 },
  },
}, { timestamps: true })

chatImportSchema.index({ householdId: 1, createdAt: -1 })
export const ChatImport = mongoose.model('ChatImport', chatImportSchema)
