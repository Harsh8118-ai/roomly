import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Check, Copy, Plus, Receipt, Scale, Users, X } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { householdNameSchema, inviteSchema, type HouseholdNameValues, type InviteValues } from '@/schemas'
import { householdService } from '@/services/householdService'
import { authService } from '@/services/authService'
import { useAuth } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'
import { friendlyError } from '@/utils/errors'
import { copyToClipboard } from '@/utils/clipboard'
import { firstName } from '@/utils/format'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/utils/cn'
import type { Household, Member } from '@/types'

const STEPS = ['Welcome', 'Household', 'Invite', 'Done']

const slide = {
  enter: (d: number) => ({ opacity: 0, x: d * 36 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -36 }),
}

export function OnboardingPage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const [[step, dir], setStep] = useState<[number, number]>([params.get('new') ? 1 : 0, 1])
  const [household, setHousehold] = useState<Household | null>(null)
  const [invited, setInvited] = useState<Member[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const go = (to: number) => setStep(([s]) => [to, to > s ? 1 : -1])

  const nameForm = useForm<HouseholdNameValues>({ resolver: zodResolver(householdNameSchema), defaultValues: { name: '' } })
  const inviteForm = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { name: '', email: '' } })

  const createHousehold = nameForm.handleSubmit(async ({ name }) => {
    setBusy(true); setError('')
    try {
      const h = await householdService.create(name)
      setHousehold(h); setUser(await authService.getCurrentUser()); go(2)
    } catch (e) { setError(friendlyError(e)) } finally { setBusy(false) }
  })

  const invite = inviteForm.handleSubmit(async (v) => {
    setBusy(true); setError('')
    try {
      const m = await householdService.inviteMember({ name: v.name, email: v.email || undefined })
      setInvited((l) => [...l, m]); inviteForm.reset()
    } catch (e) { setError(friendlyError(e)) } finally { setBusy(false) }
  })

  const copyCode = async () => { if (household && await copyToClipboard(household.inviteCode)) toast.success('Invite code copied') }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <Logo />
        {user?.currentHouseholdId && step < 3 && (
          <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.dashboard)}>Cancel</Button>
        )}
      </header>

      <div className="mx-auto w-full max-w-md px-5">
        <ol className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
          {STEPS.map((s, i) => (
            <li key={s} className="h-1 flex-1 overflow-hidden rounded-full bg-line-strong">
              <motion.div className="h-full bg-accent-strong" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} transition={{ duration: 0.4, ease: 'easeOut' }} />
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted" aria-hidden>Step {step + 1} of {STEPS.length}</p>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-16">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22, ease: 'easeOut' }}>
            {step === 0 && (
              <section>
                <h1 className="t-large">Welcome{user ? `, ${firstName(user.name)}` : ''}.</h1>
                <p className="mt-3 text-muted">Roomly keeps shared living simple. Here’s how it works:</p>
                <ul className="mt-8 space-y-5">
                  {[
                    { i: Users, t: 'Set up your household', d: 'Name it and invite the people you live with.' },
                    { i: Receipt, t: 'Log what you buy', d: 'Groceries, gas, Wi-Fi — add it in seconds, right at the shop.' },
                    { i: Scale, t: 'Settle up once a month', d: 'Roomly works out who owes whom, with the fewest payments.' },
                  ].map(({ i: I, t, d }) => (
                    <li key={t} className="flex gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-strong"><I size={18} /></span>
                      <div><p className="font-medium">{t}</p><p className="text-sm text-muted">{d}</p></div>
                    </li>
                  ))}
                </ul>
                <Button size="lg" fullWidth className="mt-10" rightIcon={<ArrowRight size={16} />} onClick={() => go(1)}>Get started</Button>
              </section>
            )}

            {step === 1 && (
              <form onSubmit={createHousehold} noValidate>
                <h1 className="t-large">Name your household.</h1>
                <p className="mt-3 text-muted">Whatever you call home — a flat number, a nickname, a joke only you get.</p>
                <div className="mt-8 space-y-4">
                  {error && <p role="alert" className="rounded-md bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</p>}
                  <Input label="Household name" placeholder="Casa 4" autoFocus error={nameForm.formState.errors.name?.message} {...nameForm.register('name')} />
                  <div className="flex flex-wrap gap-2">
                    {['Casa 4', 'Flat 302', 'The Den'].map((s) => (
                      <button key={s} type="button" onClick={() => nameForm.setValue('name', s, { shouldValidate: true })} className="rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-fg">{s}</button>
                    ))}
                  </div>
                </div>
                <div className="mt-10 flex gap-3">
                  <Button variant="secondary" size="lg" onClick={() => go(0)} aria-label="Back"><ArrowLeft size={16} /></Button>
                  <Button type="submit" size="lg" fullWidth loading={busy} loadingText="Creating…">Create household</Button>
                </div>
              </form>
            )}

            {step === 2 && (
              <section>
                <h1 className="t-large">Invite your housemates.</h1>
                <p className="mt-3 text-muted">Add them now, or share the invite code later. You can skip this.</p>
                <form onSubmit={invite} noValidate className="mt-8 space-y-3">
                  {error && <p role="alert" className="rounded-md bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</p>}
                  <Input label="Name" placeholder="Aman" error={inviteForm.formState.errors.name?.message} {...inviteForm.register('name')} />
                  <Input label="Email" optional type="email" placeholder="aman@example.com" error={inviteForm.formState.errors.email?.message} {...inviteForm.register('email')} />
                  <Button type="submit" variant="secondary" fullWidth loading={busy} leftIcon={<Plus size={16} />}>Add housemate</Button>
                </form>
                {invited.length > 0 && (
                  <ul className="mt-6 space-y-2" aria-label="Invited housemates">
                    <AnimatePresence initial={false}>
                      {invited.map((m) => (
                        <motion.li key={m.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5">
                            <Avatar person={m} /><span className="flex-1 text-sm font-medium">{m.name}</span>
                            <span className="text-xs text-muted">Invited</span>
                            <button onClick={() => setInvited((l) => l.filter((x) => x.id !== m.id))} aria-label={`Remove ${m.name} from list`} className="rounded-sm p-1 text-subtle hover:text-fg"><X size={14} /></button>
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
                <div className="mt-10 flex gap-3">
                  <Button variant="ghost" size="lg" onClick={() => go(3)}>{invited.length ? 'Skip the rest' : 'Skip for now'}</Button>
                  <Button size="lg" fullWidth rightIcon={<ArrowRight size={16} />} onClick={() => go(3)}>{invited.length ? 'Continue' : 'Continue without inviting'}</Button>
                </div>
              </section>
            )}

            {step === 3 && household && (
              <section className="text-center">
                <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                  className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-accent-strong text-on-accent"><Check size={30} strokeWidth={2.5} /></motion.div>
                <h1 className="t-large">{household.name} is ready.</h1>
                <p className="mt-3 text-muted">Add your first expense and watch the numbers come alive.</p>
                <div className="card mt-8 p-4 text-left">
                  <p className="text-[13px] text-muted">Invite code</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="tnum font-mono text-xl font-semibold tracking-wider">{household.inviteCode}</span>
                    <Button variant="secondary" size="sm" leftIcon={<Copy size={14} />} onClick={copyCode}>Copy</Button>
                  </div>
                  {invited.length > 0 && <p className="mt-3 border-t border-line pt-3 text-sm text-muted">{invited.length} housemate{invited.length > 1 ? 's' : ''} added: {invited.map((m) => firstName(m.name)).join(', ')}</p>}
                </div>
                <Button size="lg" fullWidth className={cn('mt-8')} onClick={() => navigate(ROUTES.dashboard, { replace: true })}>Go to dashboard</Button>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
