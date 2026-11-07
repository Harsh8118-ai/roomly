import type { Expense, ExpenseInput, ExpenseQuery } from '@/types'
import { api } from './api/client'

export const expenseService = {
  getExpenses: (q: ExpenseQuery = {}) =>
    api.get<Expense[]>('/expenses', { ...q, members: q.members, categories: q.categories }),
  getExpense: (id: string) => api.get<Expense>(`/expenses/${id}`),
  createExpense: (input: ExpenseInput) => api.post<Expense>('/expenses', input),
  updateExpense: (id: string, input: Partial<ExpenseInput>) => api.patch<Expense>(`/expenses/${id}`, input),
  deleteExpense: (id: string) => api.delete<Expense>(`/expenses/${id}`),
  restoreExpense: (expense: Expense) => api.post<Expense>(`/expenses/${expense.id}/restore`, expense),

  /** Swap this body for a presigned S3/Cloudinary upload when the backend exists. */
  async uploadReceipt(file: File, onProgress?: (pct: number) => void): Promise<string> {
    if (file.size > 5 * 1024 * 1024) throw new Error('Receipts can be up to 5 MB.')
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 60))
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('We couldn’t read that file.'))
      reader.readAsDataURL(file)
    })
    for (const pct of [70, 85, 100]) { await new Promise((r) => setTimeout(r, 140)); onProgress?.(pct) }
    const { url } = await api.post<{ url: string }>('/uploads/receipts', { dataUrl, name: file.name })
    return url
  },
}
