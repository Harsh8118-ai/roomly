import type { AuthSession, User } from '@/types'
import { api, tokenStore } from './api/client'

export const authService = {
  async login(email: string, password: string) {
    const session = await api.post<AuthSession>('/auth/login', { email, password })
    tokenStore.set(session.token)
    return session.user
  },
  async register(input: { name: string; email: string; password: string }) {
    const session = await api.post<AuthSession>('/auth/register', input)
    tokenStore.set(session.token)
    return session.user
  },
  async logout() {
    try { await api.post('/auth/logout') } finally { tokenStore.clear() }
  },
  forgotPassword: (email: string) => api.post<{ ok: true }>('/auth/forgot-password', { email }),
  getCurrentUser: () => api.get<User>('/auth/me'),
  updateProfile: (input: { name?: string; email?: string; tone?: number }) => api.patch<User>('/auth/me', input),
  changePassword: (input: { currentPassword: string; newPassword: string }) => api.post<{ ok: true }>('/auth/change-password', input),
  hasToken: () => !!tokenStore.get(),
}
