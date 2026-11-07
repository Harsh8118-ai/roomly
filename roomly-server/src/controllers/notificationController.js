import mongoose from 'mongoose'
import { Notification } from '../models/Notification.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { publicNotification } from '../utils/serializers.js'

const scope = (req) => ({ userId: req.user._id, householdId: req.household._id })

export const list = asyncHandler(async (req, res) => {
  const docs = await Notification.find(scope(req)).sort({ createdAt: -1 }).limit(50).lean()
  res.json(docs.map(publicNotification))
})

export const markRead = asyncHandler(async (req, res) => {
  if (mongoose.isValidObjectId(req.params.id)) await Notification.updateOne({ _id: req.params.id, ...scope(req) }, { read: true })
  res.json({ ok: true })
})

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ ...scope(req), read: false }, { read: true })
  res.json({ ok: true })
})
