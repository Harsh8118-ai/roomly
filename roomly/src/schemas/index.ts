import { z } from 'zod'
import { CATEGORIES } from '@/constants/categories'

const email = z.string().trim().min(1, 'Enter your email').email('That email doesn’t look right')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name'),
  email,
  password: z.string().min(8, 'Use at least 8 characters'),
})
export type RegisterValues = z.infer<typeof registerSchema>

export const forgotSchema = z.object({ email })
export type ForgotValues = z.infer<typeof forgotSchema>

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords don’t match' })
export type PasswordValues = z.infer<typeof passwordSchema>

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Tell us your name'),
  email,
})
export type ProfileValues = z.infer<typeof profileSchema>

export const householdNameSchema = z.object({ name: z.string().trim().min(2, 'Give it a name, like “Casa 4”').max(40, 'Keep it under 40 characters') })
export type HouseholdNameValues = z.infer<typeof householdNameSchema>

export const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Add a name'),
  email: z.string().trim().refine((v) => v === '' || /^\S+@\S+\.\S+$/.test(v), 'That email doesn’t look right'),
})
export type InviteValues = z.infer<typeof inviteSchema>

const categoryIds = CATEGORIES.map((c) => c.id) as [string, ...string[]]

/** Amount is held as a string in the form (so "450." etc. can be typed) and parsed on submit. */
export const expenseSchema = z.object({
  amount: z
    .string()
    .min(1, 'Enter an amount')
    .refine((v) => !Number.isNaN(Number(v.replace(/,/g, ''))), 'Numbers only')
    .refine((v) => Number(v.replace(/,/g, '')) > 0, 'Amount must be more than ₹0')
    .refine((v) => Number(v.replace(/,/g, '')) <= 10_000_000, 'That’s a lot — double-check the amount'),
  title: z.string().trim().min(1, 'What did you buy?').max(80, 'Keep it under 80 characters'),
  category: z.enum(categoryIds, { message: 'Pick a category' }),
  paidBy: z.string().min(1, 'Who paid?'),
  splitType: z.enum(['equal', 'custom']).default('equal'),
  splits: z.array(z.object({ memberId: z.string().min(1), amount: z.number().int().nonnegative() })).max(12).default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a valid date'),
  note: z.string().max(240, 'Keep notes under 240 characters').optional(),
  receiptUrl: z.string().optional(),
}).refine((v) => v.splitType !== 'custom' || v.splits.reduce((sum, split) => sum + split.amount, 0) === Math.round(Number(v.amount.replace(/,/g, ''))), { path: ['splits'], message: 'Split amounts must add up to the expense total.' })
export type ExpenseFormValues = z.infer<typeof expenseSchema>
