import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import type { Expense, ExpenseInput, ExpenseQuery, Member, MonthKey } from '@/types'
import { useAuth } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'
import { expenseService } from '@/services/expenseService'
import { householdService } from '@/services/householdService'
import { settlementService } from '@/services/settlementService'
import { notificationService } from '@/services/notificationService'
import { friendlyError } from '@/utils/errors'

/** Every household-scoped query key starts with the household id, so switching households can't leak data. */
function useKey() {
  const { user } = useAuth()
  return user?.currentHouseholdId ?? 'none'
}
const enabledFor = (hid: string) => hid !== 'none'

export function useHousehold() {
  const hid = useKey()
  return useQuery({ queryKey: ['hh', hid, 'household'], queryFn: householdService.getHousehold, enabled: enabledFor(hid) })
}

export function useHouseholds() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['households', user?.householdIds.join(',')], queryFn: householdService.list, enabled: !!user })
}

/** Members plus a lookup helper that never returns undefined. */
export function useMembers() {
  const { data: household, ...rest } = useHousehold()
  const members: Member[] = household?.members ?? []
  const byId = (id: string): Member =>
    members.find((m) => m.id === id) ?? { id, name: 'Former member', role: 'member', status: 'active', tone: 6, joinedAt: '' }
  return { members, byId, household, ...rest }
}

export function useExpenses(query: ExpenseQuery = {}) {
  const hid = useKey()
  return useQuery({
    queryKey: ['hh', hid, 'expenses', query],
    queryFn: () => expenseService.getExpenses(query),
    enabled: enabledFor(hid),
    placeholderData: keepPreviousData,
  })
}

export function useExpense(id: string | undefined) {
  const hid = useKey()
  return useQuery({ queryKey: ['hh', hid, 'expense', id], queryFn: () => expenseService.getExpense(id!), enabled: !!id && enabledFor(hid), retry: false })
}

export function useSettlement(month: MonthKey) {
  const hid = useKey()
  return useQuery({ queryKey: ['hh', hid, 'settlement', month], queryFn: () => settlementService.getSettlement(month), enabled: enabledFor(hid) })
}

export function useSummary(month: MonthKey) {
  const hid = useKey()
  return useQuery({ queryKey: ['hh', hid, 'summary', month], queryFn: () => settlementService.getMonthlySummary(month), enabled: enabledFor(hid) })
}

export function useMonths() {
  const hid = useKey()
  return useQuery({ queryKey: ['hh', hid, 'months'], queryFn: settlementService.getMonths, enabled: enabledFor(hid) })
}

export function useNotifications() {
  const hid = useKey()
  return useQuery({ queryKey: ['hh', hid, 'notifications'], queryFn: notificationService.getNotifications, enabled: enabledFor(hid), refetchInterval: 60_000 })
}

/* ----------------------------- mutations ----------------------------- */

/** Anything that changes money invalidates every derived number in the app. */
function useInvalidateMoney() {
  const qc = useQueryClient()
  const hid = useKey()
  return () => {
    for (const k of ['expenses', 'expense', 'settlement', 'summary', 'months', 'notifications']) {
      qc.invalidateQueries({ queryKey: ['hh', hid, k] })
    }
  }
}

export function useCreateExpense() {
  const invalidate = useInvalidateMoney()
  const toast = useToast()
  return useMutation({
    mutationFn: (input: ExpenseInput) => expenseService.createExpense(input),
    onSuccess: () => { invalidate(); toast.success('Expense added') },
  })
}

export function useUpdateExpense() {
  const invalidate = useInvalidateMoney()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ExpenseInput> }) => expenseService.updateExpense(id, input),
    onSuccess: () => { invalidate(); toast.success('Expense updated') },
  })
}

export function useDeleteExpense() {
  const invalidate = useInvalidateMoney()
  const toast = useToast()
  const qc = useQueryClient()
  const hid = useKey()
  return useMutation({
    mutationFn: (expense: Expense) => expenseService.deleteExpense(expense.id),
    onSuccess: (_d, expense) => {
      qc.removeQueries({ queryKey: ['hh', hid, 'expense', expense.id] })
      invalidate()
      toast.show({
        title: 'Expense deleted', description: expense.title,
        action: { label: 'Undo', onClick: () => expenseService.restoreExpense(expense).then(invalidate).catch((e) => toast.error(friendlyError(e))) },
      })
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
}

export function usePayTransaction(month: MonthKey) {
  const invalidate = useInvalidateMoney()
  const toast = useToast()
  return useMutation({
    mutationFn: (txId: string) => settlementService.markSettlementPaid(month, txId),
    onSuccess: () => { invalidate(); toast.success('Marked as paid') },
    onError: (e) => toast.error(friendlyError(e)),
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  const hid = useKey()
  return useMutation({
    mutationFn: (id: string) => notificationService.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hh', hid, 'notifications'] }),
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  const hid = useKey()
  return useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hh', hid, 'notifications'] }),
  })
}
