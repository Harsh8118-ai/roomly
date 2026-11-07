import { Navigate } from 'react-router-dom'
import { useAuth } from '@/store/AuthProvider'
import { ROUTES } from '@/constants/routes'
import { FullScreenLoader } from '@/components/layout/RouteGuards'

/**
 * Roomly is a private utility, not a public marketing site.
 * Signed-in users go straight to their group dashboard; everyone else signs in.
 */
export function EntryRoute() {
  const { status, user } = useAuth()

  if (status === 'loading') return <FullScreenLoader />
  if (!user) return <Navigate to={ROUTES.login} replace />
  if (!user.currentHouseholdId) return <Navigate to={ROUTES.onboarding} replace />
  return <Navigate to={ROUTES.dashboard} replace />
}
