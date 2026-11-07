import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/AuthProvider'
import { ROUTES } from '@/constants/routes'
import { LogoMark } from '@/components/ui/Logo'

export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" role="status" aria-label="Loading">
      <LogoMark size={36} className="animate-pulse text-fg" />
    </div>
  )
}

/** App pages need a session — and a household (new users are sent to onboarding first). */
export function ProtectedRoute() {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullScreenLoader />
  if (!user) return <Navigate to={ROUTES.login} replace state={{ from: location.pathname + location.search }} />
  if (!user.currentHouseholdId) return <Navigate to={ROUTES.onboarding} replace />
  return <Outlet />
}

/** Onboarding needs a session but not a household. */
export function SessionRoute() {
  const { status, user } = useAuth()
  if (status === 'loading') return <FullScreenLoader />
  if (!user) return <Navigate to={ROUTES.login} replace />
  return <Outlet />
}

/** Login / register bounce signed-in people straight to the app. */
export function PublicOnlyRoute() {
  const { status, user } = useAuth()
  if (status === 'loading') return <FullScreenLoader />
  if (user) return <Navigate to={user.currentHouseholdId ? ROUTES.dashboard : ROUTES.onboarding} replace />
  return <Outlet />
}
