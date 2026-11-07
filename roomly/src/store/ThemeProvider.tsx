import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { config } from '@/app/config'

export type ThemePref = 'system' | 'light' | 'dark'
interface ThemeCtx { pref: ThemePref; resolved: 'light' | 'dark'; setPref: (p: ThemePref) => void }
const Ctx = createContext<ThemeCtx | null>(null)

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches
const readPref = (): ThemePref => (localStorage.getItem(config.themeKey) as ThemePref) || 'system'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref)
  const [sysDark, setSysDark] = useState(systemDark)
  const resolved = pref === 'system' ? (sysDark ? 'dark' : 'light') : pref

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSysDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => { document.documentElement.dataset.theme = resolved }, [resolved])

  const setPref = useCallback((p: ThemePref) => {
    localStorage.setItem(config.themeKey, p)
    setPrefState(p)
  }, [])

  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useTheme = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme must be used inside ThemeProvider')
  return v
}
