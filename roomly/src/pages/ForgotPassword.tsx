import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { AuthLayout } from '@/components/common/AuthLayout'
import { SubmitButton, type SubmitPhase } from '@/components/common/SubmitButton'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { forgotSchema, type ForgotValues } from '@/schemas'
import { authService } from '@/services/authService'
import { friendlyError } from '@/utils/errors'
import { ROUTES } from '@/constants/routes'

export function ForgotPasswordPage() {
  const [phase, setPhase] = useState<SubmitPhase>('idle')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema) })

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(''); setPhase('loading')
    try { await authService.forgotPassword(email); setSentTo(email); setPhase('idle') }
    catch (e) { setPhase('idle'); setError(friendlyError(e)) }
  })

  return (
    <AuthLayout title="Reset your password" subtitle="We’ll email you a link to choose a new one."
      footer={<Link to={ROUTES.login} className="font-medium text-fg underline-offset-4 hover:underline">Back to sign in</Link>}>
      {sentTo ? (
        <div className="text-center" role="status">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent-strong"><MailCheck size={22} /></div>
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1.5 text-sm text-muted">If there’s an account for {sentTo}, a reset link is on its way.</p>
          <Button variant="secondary" className="mt-6" onClick={() => setSentTo(null)}>Use a different email</Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {error && <p role="alert" className="rounded-md bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</p>}
          <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
          <SubmitButton phase={phase} idle="Send reset link" loading="Sending…" />
        </form>
      )}
    </AuthLayout>
  )
}
