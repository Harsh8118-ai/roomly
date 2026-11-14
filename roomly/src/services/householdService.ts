import type { Household, HouseholdSummary, Member, User } from '@/types'
import { api } from './api/client'
export const householdService = {
  list: () => api.get<HouseholdSummary[]>('/households'),
  getHousehold: () => api.get<Household>('/households/current'),
  create: (name: string) => api.post<Household>('/households', { name }),
  previewInvite: (inviteCode: string) => api.get<{ id: string; name: string; members: { id: string; name: string }[] }>(`/households/invite/${inviteCode}`),
  join: (inviteCode: string, memberId?: string) => api.post<Household>('/households/join', { inviteCode, memberId }),
  rename: (name: string) => api.patch<Household>('/households/current', { name }),
  switchTo: (householdId: string) => api.put<User>('/households/current', { householdId }),
  getMembers: () => api.get<Member[]>('/households/current/members'),
  inviteMember: (input: { name: string; email?: string }) => api.post<Member>('/households/current/invites', input),
  leave: () => api.delete<User>('/households/current/members/me'),
}
