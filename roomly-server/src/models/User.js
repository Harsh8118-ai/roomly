import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    householdIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Household' }],
    currentHouseholdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', default: null },
    /** Bumped on password change/reset so older JWTs stop working. */
    tokenVersion: { type: Number, default: 0 },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true },
)

export const User = mongoose.model('User', userSchema)
