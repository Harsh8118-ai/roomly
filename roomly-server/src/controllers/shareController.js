import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { ShareLink } from '../models/ShareLink.js'
import { Expense } from '../models/Expense.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { CATEGORY_LABEL } from '../constants.js'
import { env } from '../config/env.js'

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

export const createShare = asyncHandler(async (req, res) => {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresInDays = Number(req.body?.expiresInDays ?? 30)
  if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) throw ApiError.invalid('Share links can expire between 1 and 365 days.')
  const link = await ShareLink.create({
    householdId: req.household._id, tokenHash: hashToken(token), createdBy: req.user._id,
    expiresAt: new Date(Date.now() + expiresInDays * 86400000),
    showMemberBreakdown: req.body?.showMemberBreakdown === true,
  })
  res.status(201).json({ id: String(link._id), url: `${env.CLIENT_URL}/share/${token}`, expiresAt: link.expiresAt, showMemberBreakdown: link.showMemberBreakdown })
})

export const listShares = asyncHandler(async (req, res) => {
  const links = await ShareLink.find({ householdId: req.household._id }).sort({ createdAt: -1 }).limit(30).lean()
  res.json(links.map((link) => ({ id: String(link._id), createdAt: link.createdAt, expiresAt: link.expiresAt, revoked: !!link.revokedAt, showMemberBreakdown: link.showMemberBreakdown })))
})

export const revokeShare = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Share link not found.')
  const link = await ShareLink.findOne({ _id: req.params.id, householdId: req.household._id })
  if (!link) throw ApiError.notFound('Share link not found.')
  link.revokedAt = new Date()
  await link.save()
  res.json({ ok: true })
})

export const publicDashboard = asyncHandler(async (req, res) => {
  const token = String(req.params.token ?? '')
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw ApiError.notFound('This dashboard link is unavailable.')
  const link = await ShareLink.findOne({ tokenHash: hashToken(token), revokedAt: null }).lean()
  if (!link || (link.expiresAt && link.expiresAt <= new Date())) throw ApiError.notFound('This dashboard link has expired or been revoked.')
  const expenses = await Expense.find({ householdId: link.householdId }).sort({ date: -1 }).limit(5000).lean()
  const household = await mongoose.model('Household').findById(link.householdId).lean()
  if (!household) throw ApiError.notFound('This dashboard is unavailable.')
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const byCategory = Object.entries(expenses.reduce((out, expense) => {
    out[expense.category] = (out[expense.category] ?? 0) + expense.amount
    return out
  }, {})).map(([category, amount]) => ({ category, label: CATEGORY_LABEL[category] ?? category, amount }))
  const response = {
    household: household.name, total, expenseCount: expenses.length,
    byCategory, generatedAt: new Date().toISOString(),
    ...(link.showMemberBreakdown ? { members: household.members.map((member) => ({
      name: member.name,
      paid: expenses.filter((expense) => String(expense.paidBy) === String(member._id)).reduce((sum, expense) => sum + expense.amount, 0),
    })) } : {}),
  }
  res.setHeader('Cache-Control', 'no-store')
  res.json(response)
})
