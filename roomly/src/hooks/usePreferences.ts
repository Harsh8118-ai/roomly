import { useCallback, useState } from 'react'

export interface Preferences { expenseAdded: boolean; settlementReminder: boolean; monthlySummary: boolean }
const KEY = 'roomly.prefs'
const DEFAULTS: Preferences = { expenseAdded: true, settlementReminder: true, monthlySummary: false }

/** Notification preferences, persisted locally until the backend has a preferences endpoint. */
export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return DEFAULTS }
  })
  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((p) => { const next = { ...p, ...patch }; localStorage.setItem(KEY, JSON.stringify(next)); return next })
  }, [])
  return [prefs, update] as const
}
