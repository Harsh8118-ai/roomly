import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'
import { whatsappService, type WhatsAppContext } from '@/services/whatsappService'
import { friendlyError } from '@/utils/errors'
import type { WhatsAppStatus } from '@/types'

function useHid() {
  const { user } = useAuth()
  return user?.currentHouseholdId ?? 'none'
}

/** `fast` polls every 2.5s — used while waiting for a link to be confirmed. */
export function useWhatsAppStatus(opts: { fast?: boolean } = {}) {
  const hid = useHid()
  return useQuery({
    queryKey: ['hh', hid, 'whatsapp', 'status'],
    queryFn: whatsappService.getStatus,
    enabled: hid !== 'none',
    staleTime: 10_000,
    // Group creation finishes asynchronously on Meta's side, so poll until it settles.
    refetchInterval: (q) => (opts.fast || q.state.data?.group?.status === 'creating' ? 2500 : false),
  })
}

export function useWhatsAppActivity(limit = 8) {
  const hid = useHid()
  return useQuery({ queryKey: ['hh', hid, 'whatsapp', 'activity', limit], queryFn: () => whatsappService.getActivity(limit), enabled: hid !== 'none' })
}

export function useWhatsAppPreview(text: string, context: WhatsAppContext) {
  const hid = useHid()
  return useQuery({
    queryKey: ['hh', hid, 'whatsapp', 'preview', context, text],
    queryFn: () => whatsappService.preview(text, context),
    enabled: hid !== 'none' && text.trim().length > 0,
    staleTime: 60_000,
  })
}

function useWhatsAppMutation<TArgs, TData>(fn: (a: TArgs) => Promise<TData>, success?: string, onData?: (d: TData, qc: ReturnType<typeof useQueryClient>, hid: string) => void) {
  const qc = useQueryClient()
  const hid = useHid()
  const toast = useToast()
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      onData?.(data, qc, hid)
      qc.invalidateQueries({ queryKey: ['hh', hid, 'whatsapp'] })
      if (success) toast.success(success)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
}

const putStatus = (d: unknown, qc: ReturnType<typeof useQueryClient>, hid: string) => qc.setQueryData(['hh', hid, 'whatsapp', 'status'], d as WhatsAppStatus)

export const useCreateLinkCode = () => useWhatsAppMutation(() => whatsappService.createLinkCode())
export const useUnlinkWhatsApp = () => useWhatsAppMutation(() => whatsappService.unlinkMe(), 'WhatsApp number unlinked')
export const useCreateWhatsAppGroup = () => useWhatsAppMutation(() => whatsappService.createGroup(), undefined, putStatus)
export const useDeleteWhatsAppGroup = () => useWhatsAppMutation(() => whatsappService.deleteGroup(), 'WhatsApp group deleted', putStatus)
export const useResetInviteLink = () => useWhatsAppMutation(() => whatsappService.resetInviteLink(), 'Invite link reset — the old one no longer works', putStatus)
export const useWhatsAppSettings = () => useWhatsAppMutation((v: { autoReply: boolean }) => whatsappService.updateSettings(v), undefined, putStatus)
export const useSimulateWhatsApp = () => useWhatsAppMutation((v: { as: string; text: string; context?: WhatsAppContext }) => whatsappService.simulate(v))
