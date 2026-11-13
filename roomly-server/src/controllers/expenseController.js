import mongoose from 'mongoose'
import { Expense } from '../models/Expense.js'
import { ApiError } from '../utils/ApiError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { publicExpense } from '../utils/serializers.js'
import { CATEGORY_LABEL } from '../constants.js'
import { addDays, monthOf, todayISO } from '../utils/date.js'
import { expenseBody } from '../validators/schemas.js'
import { isMonthClosed } from '../services/settlementService.js'
import { notifyExpenseAdded } from '../services/notificationService.js'
import { publish } from '../services/events.js'

const CLOSED_MSG = 'This month is already settled and can’t be edited.'

async function findExpense(req) {
  const { id } = req.params
  const expense = mongoose.isValidObjectId(id) ? await Expense.findOne({ _id: id, householdId: req.household._id }) : null
  if (!expense) throw ApiError.notFound('Expense not found')
  return expense
}

/** Anyone can add. Changing or removing needs you to be the payer, the person who added it, or an admin. */
function assertCanModify(req, expense) {
  const me = String(req.user._id)
  if (req.member.role === 'admin' || String(expense.paidBy) === me || String(expense.createdBy) === me) return
  throw ApiError.forbidden('Only the person who paid, or an admin, can change this expense.')
}

function assertValidTarget(req, { paidBy, date, amount, splitType = 'equal', splits = [] }) {
  if (!req.household.members.id(paidBy)) throw ApiError.invalid('Pick who paid.')
  if (date > addDays(todayISO(), 1)) throw ApiError.invalid('That date is in the future.')
  if (splitType === 'custom') {
    if (!splits.length) throw ApiError.invalid('Add at least one member to the custom split.')
    const ids = splits.map((split) => String(split.memberId))
    if (new Set(ids).size !== ids.length || ids.some((id) => !req.household.members.id(id))) throw ApiError.invalid('Choose each household member only once in the split.')
    if (splits.reduce((sum, split) => sum + split.amount, 0) !== amount) throw ApiError.invalid('Custom split amounts must add up to the expense total.')
  } else if (splits.length) throw ApiError.invalid('Remove custom allocations or choose a custom split.')
}

export const list = asyncHandler(async (req, res) => {
  const { month, q, members, categories, from, to, minAmount, maxAmount } = req.query
  const filter = { householdId: req.household._id }
  const date = {}
  if (month) { date.$gte = `${month}-01`; date.$lte = `${month}-31` }
  if (from) date.$gte = date.$gte && date.$gte > from ? date.$gte : from
  if (to) date.$lte = date.$lte && date.$lte < to ? date.$lte : to
  if (Object.keys(date).length) filter.date = date
  if (members.length) filter.paidBy = { $in: members }
  if (categories.length) filter.category = { $in: categories }
  if (minAmount !== undefined || maxAmount !== undefined) {
    filter.amount = { ...(minAmount !== undefined && { $gte: minAmount }), ...(maxAmount !== undefined && { $lte: maxAmount }) }
  }
  let docs = await Expense.find(filter).sort({ date: -1, createdAt: -1 }).limit(5000).lean()

  if (q) {
    // Matches title, category, person and note; light stemming so "grocery" finds "Groceries".
    const names = new Map(req.household.members.map((m) => [String(m._id), m.name.toLowerCase()]))
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean)
    docs = docs.filter((e) => {
      const hay = `${e.title} ${CATEGORY_LABEL[e.category]} ${names.get(String(e.paidBy)) ?? ''} ${e.note ?? ''}`.toLowerCase()
      return tokens.every((t) => hay.includes(t) || (t.length > 3 && hay.includes(t.replace(/(ies|es|y|s)$/, ''))))
    })
  }
  res.json(docs.map(publicExpense))
})

export const get = asyncHandler(async (req, res) => res.json(publicExpense(await findExpense(req))))

export const create = asyncHandler(async (req, res) => {
  const input = req.body
  assertValidTarget(req, input)
  if (await isMonthClosed(req.household, monthOf(input.date))) throw ApiError.conflict(CLOSED_MSG)
  const expense = await Expense.create({ ...input, householdId: req.household._id, createdBy: req.user._id })
  await notifyExpenseAdded(req.household, req.user, expense).catch((e) => console.error('[notify]', e.message))
  publish(req.household._id, { type: 'expense.created', id: String(expense._id), by: String(req.user._id), source: 'web', title: expense.title, amount: expense.amount, category: expense.category })
  res.status(201).json(publicExpense(expense))
})

export const update = asyncHandler(async (req, res) => {
  const expense = await findExpense(req)
  assertCanModify(req, expense)
  const current = publicExpense(expense)
  // Re-validate the merged result so a partial update can't produce an invalid expense.
  const merged = expenseBody.parse({ ...current, ...req.body })
  assertValidTarget(req, merged)
  for (const month of new Set([monthOf(expense.date), monthOf(merged.date)])) {
    if (await isMonthClosed(req.household, month)) throw ApiError.conflict(CLOSED_MSG)
  }
  expense.set({ ...merged, note: merged.note ?? undefined, receiptUrl: merged.receiptUrl ?? undefined })
  if (!merged.note) expense.note = undefined
  if (!merged.receiptUrl) expense.receiptUrl = undefined
  await expense.save()
  publish(req.household._id, { type: 'expense.updated', id: String(expense._id), by: String(req.user._id), source: expense.source })
  res.json(publicExpense(expense))
})

export const remove = asyncHandler(async (req, res) => {
  const expense = await findExpense(req)
  assertCanModify(req, expense)
  if (await isMonthClosed(req.household, monthOf(expense.date))) throw ApiError.conflict(CLOSED_MSG)
  await expense.deleteOne()
  publish(req.household._id, { type: 'expense.deleted', id: String(expense._id), by: String(req.user._id), source: expense.source })
  res.json(publicExpense(expense))
})

/** Undo for delete: re-creates the expense with its original id and timestamps. */
export const restore = asyncHandler(async (req, res) => {
  const { id, createdAt, ...rest } = req.body
  if (String(req.params.id) !== String(id)) throw ApiError.badRequest()
  const input = expenseBody.parse(rest)
  const existing = await Expense.findOne({ _id: id, householdId: req.household._id })
  if (existing) return res.json(publicExpense(existing))
  if (await Expense.exists({ _id: id })) throw ApiError.forbidden()
  assertValidTarget(req, input)
  const me = String(req.user._id)
  if (req.member.role !== 'admin' && input.paidBy !== me) throw ApiError.forbidden('Only the person who paid, or an admin, can restore this expense.')
  if (await isMonthClosed(req.household, monthOf(input.date))) throw ApiError.conflict(CLOSED_MSG)
  const when = createdAt && !Number.isNaN(Date.parse(createdAt)) ? new Date(createdAt) : undefined
  const expense = await Expense.create({ _id: id, ...input, householdId: req.household._id, createdBy: req.user._id, ...(when && { createdAt: when }) })
  publish(req.household._id, { type: 'expense.created', id: String(expense._id), by: String(req.user._id), source: expense.source })
  res.status(201).json(publicExpense(expense))
})
