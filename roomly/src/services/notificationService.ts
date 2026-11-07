import type { AppNotification } from '@/types'
import { api } from './api/client'

export const notificationService = {
  getNotifications: () => api.get<AppNotification[]>('/notifications'),
  markNotificationRead: (id: string) => api.post<{ ok: true }>(`/notifications/${id}/read`),
  markAllRead: () => api.post<{ ok: true }>('/notifications/read-all'),
}
