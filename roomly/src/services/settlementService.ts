import type { MonthKey, MonthListItem, MonthlySummary, Settlement } from '@/types'
import { api } from './api/client'

export const settlementService = {
  getSettlement: (month: MonthKey) => api.get<Settlement>(`/settlements/${month}`),
  markSettlementPaid: (month: MonthKey, transactionId: string) =>
    api.post<Settlement>(`/settlements/${month}/transactions/${encodeURIComponent(transactionId)}/pay`),
  getMonthlySummary: (month: MonthKey) => api.get<MonthlySummary>(`/summaries/${month}`),
  getMonths: () => api.get<MonthListItem[]>('/months'),
}
