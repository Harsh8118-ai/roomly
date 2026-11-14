import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/store/AuthProvider'
import { ROUTES } from '@/constants/routes'
import { FullScreenLoader } from '@/components/layout/RouteGuards'
export function EntryRoute() {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullScreenLoader />
  const join = new URLSearchParams(location.search).get('join')
  if (!user) return <Navigate to={ROUTES.login} replace state={{ from: join ? `/onboarding?join=${encodeURIComponent(join)}` : ROUTES.dashboard }} />
  if (join) return <Navigate to={`/onboarding?join=${encodeURIComponent(join)}`} replace />
  if (!user.currentHouseholdId) return <Navigate to={ROUTES.onboarding} replace />
  return <Navigate to={ROUTES.dashboard} replace />
}
