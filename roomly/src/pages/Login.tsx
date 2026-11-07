import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Sparkles } from 'lucide-react'
import { AuthLayout } from '@/components/common/AuthLayout'
import { PasswordInput } from '@/components/common/PasswordInput'
import { SubmitButton, type SubmitPhase } from '@/components/common/SubmitButton'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { loginSchema, type LoginValues } from '@/schemas'
import { useAuth } from '@/store/AuthProvider'
import { ApiError, friendlyError } from '@/utils/errors'
import { ROUTES } from '@/constants/routes'
import { config } from '@/app/config'

export function LoginPage() {
  const { login, loginAsDemo } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from
  const [phase, setPhase] = useState<SubmitPhase>('idle')
  const [error, setError] = useState('')
  const [demoLoading, setDemoLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const finish = (user: { currentHouseholdId: string | null }) => {
    setPhase('success')
    setTimeout(() => navigate(user.currentHouseholdId ? from ?? ROUTES.dashboard : ROUTES.onboarding, { replace: true }), 450)
  }

  const onSubmit = handleSubmit(async (v) => {
    setError(''); setPhase('loading')
    try { finish(await login(v.email, v.password)) } catch (e) { setPhase('idle'); setError(e instanceof ApiError && e.status === 401 ? e.message : friendlyError(e)) }
  })

  const demo = async () => {
    setError(''); setDemoLoading(true)
    try { finish(await loginAsDemo()) } catch (e) { setError(e instanceof ApiError && e.status === 401 ? e.message : friendlyError(e)); setDemoLoading(false) }
  }

  return (
    <AuthLayout
      title="Welcome back" subtitle="Sign in to see where your household stands."
      footer={<>New to Roomly? <Link to={ROUTES.register} className="font-medium text-fg underline-offset-4 hover:underline">Create an account</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && <p role="alert" className="rounded-md bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <Input label="Email" type="email" autoComplete="email" placeholder="rahul@roomly.app" error={errors.email?.message} {...register('email')} />
        <div>
          <PasswordInput label="Password" autoComplete="current-password" placeholder="Your password" error={errors.password?.message} {...register('password')} />
          <div className="mt-2 text-right"><Link to={ROUTES.forgotPassword} className="text-[13px] text-muted underline-offset-4 hover:text-fg hover:underline">Forgot password?</Link></div>
        </div>
        <SubmitButton phase={phase} idle="Sign in" loading="Signing in…" />
      </form>
      {config.useMock && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-subtle"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
          <Button variant="secondary" size="lg" fullWidth onClick={demo} loading={demoLoading} loadingText="Opening Casa 4…" leftIcon={<Sparkles size={16} />}>Explore the demo household</Button>
          <p className="mt-3 text-center text-xs text-muted">Demo login: {config.demoCredentials.email} / {config.demoCredentials.password}</p>
        </>
      )}
    </AuthLayout>
  )
}
