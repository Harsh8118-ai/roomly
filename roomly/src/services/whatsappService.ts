import type { WhatsAppActivity, WhatsAppLinkCode, WhatsAppPreview, WhatsAppStatus } from '@/types'
import { api } from './api/client'

export type WhatsAppContext = 'dm' | 'group'

export const whatsappService = {
  getStatus: () => api.get<WhatsAppStatus>('/whatsapp/status'),
  createLinkCode: () => api.post<WhatsAppLinkCode>('/whatsapp/link-code'),
  unlinkMe: () => api.delete<{ ok: true }>('/whatsapp/link'),
  createGroup: () => api.post<WhatsAppStatus>('/whatsapp/group'),
  deleteGroup: () => api.delete<WhatsAppStatus>('/whatsapp/group'),
  resetInviteLink: () => api.post<WhatsAppStatus>('/whatsapp/group/invite-link'),
  updateSettings: (input: { autoReply: boolean }) => api.patch<WhatsAppStatus>('/whatsapp/settings', input),
  getActivity: (limit = 10) => api.get<WhatsAppActivity[]>('/whatsapp/activity', { limit }),
  /** Same parser the bot uses — powers the "Try it" box. */
  preview: (text: string, context: WhatsAppContext = 'dm') => api.post<WhatsAppPreview>('/whatsapp/parse', { text, context }),
  /** Development only: pretend a message arrived from a linked member. */
  simulate: (input: { as: string; text: string; context?: WhatsAppContext }) =>
    api.post<{ outcome: string; replies: string[] }>('/whatsapp/simulate', input),
}
