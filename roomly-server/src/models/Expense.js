import mongoose from 'mongoose'
import { CATEGORY_IDS } from '../constants.js'

const expenseSchema = new mongoose.Schema(
  {
    householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    /** Whole rupees. */
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    category: { type: String, enum: CATEGORY_IDS, required: true },
    paidBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    /** Calendar date as "YYYY-MM-DD" (sorts and range-queries correctly as a string). */
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    note: { type: String, trim: true, maxlength: 240 },
    receiptUrl: { type: String, maxlength: 2048 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    splitType: { type: String, enum: ['equal', 'custom'], default: 'equal' },
    splits: [{
      memberId: { type: mongoose.Schema.Types.ObjectId, required: true },
      amount: { type: Number, required: true, min: 0, validate: Number.isInteger },
    }],
    /** Where it was recorded. */
    source: { type: String, enum: ['web', 'whatsapp'], default: 'web' },
    /** WhatsApp message id — guarantees a retried webhook can't create a duplicate. */
    whatsappMessageId: { type: String },
  },
  { timestamps: true },
)

expenseSchema.index({ householdId: 1, date: -1 })
expenseSchema.index({ householdId: 1, paidBy: 1, date: -1 })
// Sparse: only WhatsApp-sourced expenses carry the field, and each message may produce at most one expense.
expenseSchema.index({ whatsappMessageId: 1 }, { unique: true, sparse: true })

export const Expense = mongoose.model('Expense', expenseSchema)
