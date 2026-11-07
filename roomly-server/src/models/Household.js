import mongoose from 'mongoose'
const memberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, trim: true, lowercase: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  status: { type: String, enum: ['active', 'invited'], default: 'active' },
  tone: { type: Number, min: 1, max: 6, default: 6 },
  joinedAt: { type: Date, default: Date.now },
})
const householdSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
  // New groups receive four-digit codes. No schema regex so existing legacy codes remain readable.
  inviteCode: { type: String, required: true, unique: true, uppercase: true, index: true },
  currency: { type: String, default: 'INR' },
  members: [memberSchema],
  whatsappAutoReply: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })
householdSchema.index({ 'members._id': 1 })
export const Household = mongoose.model('Household', householdSchema)
