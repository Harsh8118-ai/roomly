import mongoose from 'mongoose'

const { Schema } = mongoose
const ttlEnabled = () => process.env.DISABLE_TTL_INDEX !== 'true'

/** One WhatsApp number ↔ one Roomly user. The number is how we know who sent a message. */
const linkSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  waId: { type: String, required: true, unique: true },
  displayName: { type: String, maxlength: 80 },
  linkedAt: { type: Date, default: Date.now },
})
export const WhatsappLink = mongoose.model('WhatsappLink', linkSchema)

/** Short-lived, single-use proof that the person messaging us owns the account. Only the hash is stored. */
const codeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  codeHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
})
if (ttlEnabled()) codeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 })
export const WhatsappLinkCode = mongoose.model('WhatsappLinkCode', codeSchema)

/** The WhatsApp group Roomly created (via the Groups API) for a household. */
const groupSchema = new Schema({
  householdId: { type: Schema.Types.ObjectId, ref: 'Household', required: true, index: true },
  /** Meta's group id — only known once the creation webhook arrives. */
  groupId: { type: String },
  requestId: { type: String },
  subject: { type: String, required: true, maxlength: 128 },
  status: { type: String, enum: ['creating', 'active', 'failed', 'deleted', 'suspended'], default: 'creating' },
  inviteLink: { type: String },
  error: { type: String, maxlength: 300 },
  joinedWaIds: [{ type: String }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })
groupSchema.index({ groupId: 1 }, { unique: true, sparse: true })
groupSchema.index({ requestId: 1 })
export const WhatsappGroup = mongoose.model('WhatsappGroup', groupSchema)

/**
 * One row per inbound message we've seen. `wamid` is unique, which is what makes
 * Meta's webhook retries safe. Text is kept ONLY for messages that became (or undid)
 * an expense — everything else is stored as an outcome with no content.
 */
const messageSchema = new Schema({
  wamid: { type: String, required: true, unique: true },
  outcome: { type: String, required: true },
  via: { type: String, enum: ['dm', 'group'] },
  householdId: { type: Schema.Types.ObjectId, index: true },
  userId: { type: Schema.Types.ObjectId },
  text: { type: String, maxlength: 80 },
  amount: Number,
  expenseId: Schema.Types.ObjectId,
  createdAt: { type: Date, default: Date.now },
})
messageSchema.index({ householdId: 1, createdAt: -1 })
if (ttlEnabled()) messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 })
export const WhatsappMessage = mongoose.model('WhatsappMessage', messageSchema)
