import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { FullScreenLoader } from '@/components/layout/RouteGuards'
import { authService } from '@/services/authService'
import { tokenStore } from '@/services/api/client'
import { ME_KEY } from '@/store/AuthProvider'
import { ROUTES } from '@/constants/routes'

export function AuthCallback() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const qc = useQueryClient()
  const [failed, setFailed] = useState(false)
  const [failureMessage, setFailureMessage] = useState('Sign-in could not be completed.')
  // Keep the fragment token across React StrictMode's development effect replay.
  const tokenRef = useRef<string | null>(new URLSearchParams(window.location.hash.slice(1)).get('token'))
  useEffect(() => {
    let active = true
    const token = tokenRef.current
    if (!token) { setFailed(true); return }
    tokenStore.set(token)
    authService.getCurrentUser().then((user) => {
      if (!active) return
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
      tokenRef.current = null
      qc.setQueryData(ME_KEY, user)
      const next = params.get('next') || (user.currentHouseholdId ? ROUTES.dashboard : ROUTES.onboarding)
      navigate(next.startsWith('/') && !next.startsWith('//') ? next : ROUTES.dashboard, { replace: true })
    }).catch((error: unknown) => {
      if (!active) return
      tokenStore.clear()
      setFailureMessage(error instanceof Error ? error.message : 'Could not verify your Roomly session.')
      setFailed(true)
    })
    return () => { active = false }
  }, [navigate, params, qc])
  if (failed) return <div className="grid min-h-dvh place-items-center p-6 text-center"><div><p className="font-semibold">Sign-in could not be completed.</p><p className="mt-2 max-w-sm text-sm text-muted">{failureMessage}</p><a className="mt-3 inline-block underline" href="/login">Try again</a></div></div>
  return <FullScreenLoader />
}
