import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribeToEvents } from '@/services/eventsService'
import { useAuth } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'
import { useMembers } from '@/hooks/queries'
import { CATEGORY_MAP } from '@/constants/categories'
import { formatINR, firstName } from '@/utils/format'
import type { LiveEvent } from '@/types'

const MONEY_KEYS = ['expenses', 'expense', 'settlement', 'summary', 'months', 'notifications']

/**
 * Keeps every open screen current: when a housemate adds an expense — in the app or
 * from WhatsApp — the relevant queries refresh and a quiet toast says what happened.
 */
export function useLiveUpdates() {
  const qc = useQueryClient()
  const toast = useToast()
  const { user } = useAuth()
  const { byId } = useMembers()
  const hid = user?.currentHouseholdId
  const me = user?.id
  const lookup = useRef(byId)
  lookup.current = byId

  useEffect(() => {
    if (!hid) return
    const refresh = (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: ['hh', hid, k] }))

    const onEvent = (e: LiveEvent) => {
      if (e.type === 'whatsapp.updated') return refresh(['whatsapp', 'household'])
      if (e.type === 'settlement.updated') return refresh(['settlement', 'summary', 'months', 'notifications'])
      refresh(MONEY_KEYS)
      if (e.type === 'expense.created' && e.amount && (e.by !== me || e.source === 'whatsapp')) {
        const who = e.by && e.by !== me ? firstName(lookup.current(e.by).name) : 'You'
        const cat = e.category ? CATEGORY_MAP[e.category]?.label : ''
        toast.show({
          title: `${who} added ${formatINR(e.amount)}${e.title ? ` · ${e.title}` : ''}`,
          description: [cat, e.source === 'whatsapp' ? 'via WhatsApp' : ''].filter(Boolean).join(' · ') || undefined,
        })
      }
      if (e.type === 'expense.deleted' && e.source === 'whatsapp') toast.info('A WhatsApp expense was removed', e.title)
    }
    return subscribeToEvents(onEvent)
  }, [hid, me, qc, toast])
}
