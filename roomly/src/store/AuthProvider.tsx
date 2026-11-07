import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from '@/types'
import { authService } from '@/services/authService'
import { UNAUTHORIZED_EVENT } from '@/services/api/client'
import { config } from '@/app/config'

interface AuthCtx {
  user: User | null
  status: 'loading' | 'authed' | 'anon'
  login: (email: string, password: string) => Promise<User>
  register: (v: { name: string; email: string; password: string }) => Promise<User>
  loginAsDemo: () => Promise<User>
  logout: () => Promise<void>
  setUser: (u: User) => void
}
const Ctx = createContext<AuthCtx | null>(null)
export const ME_KEY = ['me'] as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { data: user, isPending } = useQuery({
    queryKey: ME_KEY,
    queryFn: () => (authService.hasToken() ? authService.getCurrentUser() : Promise.resolve(null)),
    staleTime: Infinity,
    retry: false,
  })

  const setUser = useCallback((u: User | null) => qc.setQueryData(ME_KEY, u), [qc])

  const login = useCallback(async (email: string, password: string) => {
    const u = await authService.login(email, password)
    qc.clear(); setUser(u); return u
  }, [qc, setUser])

  const register = useCallback(async (v: { name: string; email: string; password: string }) => {
    const u = await authService.register(v)
    qc.clear(); setUser(u); return u
  }, [qc, setUser])

  const loginAsDemo = useCallback(() => login(config.demoCredentials.email, config.demoCredentials.password), [login])

  const logout = useCallback(async () => {
    await authService.logout().catch(() => undefined)
    qc.clear(); qc.setQueryData(ME_KEY, null)
  }, [qc])

  // Any 401 from the API drops the session; route guards then redirect to /login.
  useEffect(() => {
    const on = () => { qc.clear(); qc.setQueryData(ME_KEY, null) }
    window.addEventListener(UNAUTHORIZED_EVENT, on)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, on)
  }, [qc])

  const value = useMemo<AuthCtx>(() => ({
    user: user ?? null,
    status: isPending ? 'loading' : user ? 'authed' : 'anon',
    login, register, loginAsDemo, logout, setUser,
  }), [user, isPending, login, register, loginAsDemo, logout, setUser])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
