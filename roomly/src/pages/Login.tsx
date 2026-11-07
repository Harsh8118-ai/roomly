import { useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/common/AuthLayout'
import { Button } from '@/components/ui/Button'
import { config } from '@/app/config'
import { tokenStore } from '@/services/api/client'

export function LoginPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as { from?: string } | null
  const next = state?.from || new URLSearchParams(location.search).get('next') || '/'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const startGoogle = () => {
    if (config.useMock) {
      tokenStore.set('mock.m_rahul')
      window.location.assign(safeNext)
      return
    }
    window.location.assign(`${config.apiUrl}/api/auth/google?next=${encodeURIComponent(safeNext)}`)
  }
  return <AuthLayout title="Welcome to Roomly" subtitle="Sign in securely with your Google account.">
    <Button fullWidth size="lg" variant="secondary" onClick={startGoogle}><span className="mr-2 text-base font-semibold">G</span> Continue with Google</Button>
    <p className="mt-5 text-center text-xs text-muted">Your Google account securely identifies you. Your household data stays in Roomly.</p>
    {config.useMock && <p className="mt-3 text-center text-xs text-muted">Preview mode: this uses the local demo household. Configure Google OAuth for real sign-in.</p>}
  </AuthLayout>
}
