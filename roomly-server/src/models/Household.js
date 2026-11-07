import mongoose from 'mongoose'

/**
 * Member `_id` equals the User `_id` for people with an account, so the
 * frontend can treat "member id" and "user id" as the same thing. Invited
 * people who haven't joined yet get a fresh ObjectId, replaced when they join.
 */
const memberSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, trim: true, lowercase: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  status: { type: String, enum: ['active', 'invited'], default: 'active' },
  tone: { type: Number, min: 1, max: 6, default: 6 },
  joinedAt: { type: Date, default: Date.now },
})

const householdSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    inviteCode: { type: String, required: true, unique: true, uppercase: true },
    currency: { type: String, default: 'INR' },
    members: [memberSchema],
    /** Post a short confirmation in the WhatsApp group after each expense. */
    whatsappAutoReply: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

householdSchema.index({ 'members._id': 1 })

export const Household = mongoose.model('Household', householdSchema)
