import mongoose from 'mongoose'
import { z } from 'zod'
import { CATEGORY_IDS } from '../constants.js'
import { isISODate, isMonthKey } from '../utils/date.js'

const email = z.string({ error: 'Enter your email' }).trim().toLowerCase().email('That email doesn’t look right').max(120)
const password = z.string({ error: 'Enter a password' }).min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer')
const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id')

export const registerBody = z.object({
  name: z.string({ error: 'Tell us your name' }).trim().min(2, 'Tell us your name').max(60),
  email,
  password,
})
export const loginBody = z.object({ email, password: z.string().min(1, 'Enter your password').max(200) })
export const forgotBody = z.object({ email })
export const resetBody = z.object({ token: z.string().min(10).max(200), password })
export const changePasswordBody = z.object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: password })
export const profileBody = z.object({
  name: z.string().trim().min(2, 'Name can’t be empty').max(60).optional(),
  email: email.optional(),
  tone: z.number().int().min(1).max(6).optional(),
})

export const householdNameBody = z.object({ name: z.string({ error: 'Give your household a name.' }).trim().min(2, 'Give your household a name.').max(40, 'Keep the name under 40 characters.') })
export const switchBody = z.object({ householdId: objectId })
export const joinBody = z.object({ inviteCode: z.string().trim().regex(/^\d{4}$/, 'Enter the four-digit invite code') })
export const inviteBody = z.object({
  name: z.string({ error: 'Add a name for your housemate.' }).trim().min(1, 'Add a name for your housemate.').max(60),
  email: z.union([z.literal(''), email]).optional(),
})

const money = z.number({ error: 'Amount must be a number.' })
  .refine((n) => Number.isFinite(n) && Math.round(n) >= 1, 'Amount must be more than ₹0.')
  .refine((n) => n <= 10_000_000, 'That’s a lot — double-check the amount.')
  .transform((n) => Math.round(n))

export const expenseBody = z.object({
  title: z.string({ error: 'Add a short description.' }).trim().min(1, 'Add a short description.').max(80, 'Keep the description under 80 characters.'),
  amount: money,
  category: z.enum(CATEGORY_IDS, { error: 'Pick a category.' }),
  paidBy: objectId.refine(Boolean, 'Pick who paid.'),
  date: z.string({ error: 'Pick a valid date.' }).refine(isISODate, 'Pick a valid date.'),
  note: z.string().trim().max(240, 'Keep notes under 240 characters.').optional().nullable().transform((v) => v || undefined),
  receiptUrl: z.string().max(2048).regex(/^https?:\/\//, 'Receipt link isn’t valid.').optional().nullable().transform((v) => v || undefined),
})
export const expensePatchBody = expenseBody.partial()
/** Undo-delete: the client re-sends the expense it just deleted. */
export const restoreBody = expenseBody.extend({
  id: objectId, createdAt: z.string().optional(),
}).passthrough()

const csv = z.string().optional().transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []))
export const expenseQuery = z.object({
  month: z.string().refine(isMonthKey).optional(),
  q: z.string().trim().max(80).optional(),
  members: csv.transform((a) => a.filter((id) => mongoose.isValidObjectId(id))),
  categories: csv.transform((a) => a.filter((c) => CATEGORY_IDS.includes(c))),
  from: z.string().refine(isISODate).optional(),
  to: z.string().refine(isISODate).optional(),
  minAmount: z.coerce.number().nonnegative().optional(),
  maxAmount: z.coerce.number().nonnegative().optional(),
}).passthrough()

export const whatsappSettingsBody = z.object({ autoReply: z.boolean({ error: 'Choose on or off.' }) })
export const whatsappParseBody = z.object({ text: z.string().max(500), context: z.enum(['dm', 'group']).optional() })
export const whatsappSimulateBody = z.object({ as: objectId, text: z.string().min(1).max(500), context: z.enum(['dm', 'group']).optional() })

export const monthParam = z.object({ month: z.string().refine(isMonthKey, 'That month doesn’t exist.') }).passthrough()
export const idParam = z.object({ id: z.string() }).passthrough()
export const receiptBody = z.object({ dataUrl: z.string().min(20), name: z.string().max(200).optional() })
