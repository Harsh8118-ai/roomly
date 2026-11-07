import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  googleId: { type: String, unique: true, sparse: true, index: true },
  avatarUrl: { type: String },
  passwordHash: { type: String, select: false },
  householdIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Household' }],
  currentHouseholdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', default: null },
  tokenVersion: { type: Number, default: 0 },
}, { timestamps: true })

export const User = mongoose.model('User', userSchema)
