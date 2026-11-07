import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AuthLayout } from '@/components/common/AuthLayout'
import { PasswordInput } from '@/components/common/PasswordInput'
import { SubmitButton, type SubmitPhase } from '@/components/common/SubmitButton'
import { Input } from '@/components/ui/Field'
import { registerSchema, type RegisterValues } from '@/schemas'
import { useAuth } from '@/store/AuthProvider'
import { friendlyError } from '@/utils/errors'
import { ROUTES } from '@/constants/routes'

export function RegisterPage() {
  const { register: signUp } = useAuth()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<SubmitPhase>('idle')
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  const onSubmit = handleSubmit(async (v) => {
    setError(''); setPhase('loading')
    try { await signUp(v); setPhase('success'); setTimeout(() => navigate(ROUTES.onboarding, { replace: true }), 450) }
    catch (e) { setPhase('idle'); setError(friendlyError(e)) }
  })

  return (
    <AuthLayout
      title="Create your account" subtitle="It takes a minute. Your housemates can join after."
      footer={<>Already have an account? <Link to={ROUTES.login} className="font-medium text-fg underline-offset-4 hover:underline">Sign in</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error && <p role="alert" className="rounded-md bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <Input label="Your name" autoComplete="name" placeholder="Rahul Sharma" error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Password" autoComplete="new-password" placeholder="At least 8 characters" hint="Use 8 or more characters." error={errors.password?.message} {...register('password')} />
        <SubmitButton phase={phase} idle="Create account" loading="Creating account…" />
        <p className="text-center text-xs text-muted">By continuing you agree to Roomly’s terms and privacy policy.</p>
      </form>
    </AuthLayout>
  )
}
