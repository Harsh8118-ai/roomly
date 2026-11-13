import mongoose from 'mongoose'

const importedMessageSchema = new mongoose.Schema({
  householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatImport', required: true },
  fingerprint: { type: String, required: true },
  sender: { type: String, required: true, maxlength: 120 },
  senderMemberId: { type: mongoose.Schema.Types.ObjectId, default: null },
  sentAt: { type: Date, required: true },
  // Keep message text only when it needs human review. Non-expense messages retain a fingerprint only.
  text: { type: String, maxlength: 1000 },
  parsed: {
    amount: Number,
    title: String,
    category: String,
    confidence: { type: String, enum: ['high', 'medium'] },
    dayOffset: Number,
  },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'ignored'], default: 'ignored' },
  expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
}, { timestamps: true })

importedMessageSchema.index({ householdId: 1, fingerprint: 1 }, { unique: true })
importedMessageSchema.index({ importId: 1, status: 1 })
export const ImportedMessage = mongoose.model('ImportedMessage', importedMessageSchema)
