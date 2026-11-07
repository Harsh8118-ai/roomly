import { useState } from 'react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Bug, Copy, LogOut, Monitor, Moon, RotateCcw, Sun, UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsSection } from '@/components/common/SettingsSection'
import { WhatsAppSection } from '@/components/whatsapp/WhatsAppSection'
import { PasswordInput } from '@/components/common/PasswordInput'
import { InviteDialog } from '@/components/members/InviteDialog'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Field'
import { Switch } from '@/components/ui/Switch'
import { householdNameSchema, passwordSchema, profileSchema, type HouseholdNameValues, type PasswordValues, type ProfileValues } from '@/schemas'
import { authService } from '@/services/authService'
import { householdService } from '@/services/householdService'
import { useHousehold, useMembers } from '@/hooks/queries'
import { usePreferences } from '@/hooks/usePreferences'
import { useAuth, ME_KEY } from '@/store/AuthProvider'
import { useTheme, type ThemePref } from '@/store/ThemeProvider'
import { useToast } from '@/store/ToastProvider'
import { config } from '@/app/config'
import { mockControls } from '@/mock/server'
import { copyToClipboard } from '@/utils/clipboard'
import { friendlyError } from '@/utils/errors'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/utils/cn'

const SECTIONS = [['profile', 'Profile'], ['household', 'Household'], ['whatsapp', 'WhatsApp'], ['appearance', 'Appearance'], ['notifications', 'Notifications'], ['security', 'Security']]
const THEME_OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun }, { value: 'dark', label: 'Dark', icon: Moon }, { value: 'system', label: 'System', icon: Monitor },
]

function ProfileSection() {
  const { user, setUser } = useAuth()
  const { byId } = useMembers()
  const qc = useQueryClient()
  const toast = useToast()
  const me = user ? byId(user.id) : null
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), values: { name: user?.name ?? '', email: user?.email ?? '' } })

  const save = handleSubmit(async (v) => {
    setBusy(true)
    try { setUser(await authService.updateProfile(v)); await qc.invalidateQueries({ queryKey: ['hh'] }); reset(v); toast.success('Profile updated') }
    catch (e) { toast.error(friendlyError(e)) } finally { setBusy(false) }
  })
  const setTone = async (tone: number) => {
    try { await authService.updateProfile({ tone }); await qc.invalidateQueries({ queryKey: ['hh'] }) } catch (e) { toast.error(friendlyError(e)) }
  }

  return (
    <SettingsSection id="profile" title="Profile">
      <div className="mb-6 flex items-center gap-4">
        {me && <Avatar person={{ name: user?.name ?? me.name, tone: me.tone }} size="xl" />}
        <div>
          <p className="mb-2 text-sm font-medium">Avatar colour</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Avatar colour">
            {[1, 2, 3, 4, 5, 6].map((t) => (
              <button key={t} role="radio" aria-checked={me?.tone === t} aria-label={`Colour ${t}`} onClick={() => setTone(t)}
                className={cn('h-7 w-7 rounded-full ring-offset-2 ring-offset-surface transition-all hover:scale-110', me?.tone === t && 'ring-2 ring-fg')} style={{ background: `rgb(var(--tone-${t}-bg))`, boxShadow: `inset 0 0 0 2px rgb(var(--tone-${t}-fg) / .35)` }} />
            ))}
          </div>
        </div>
      </div>
      <form onSubmit={save} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input label="Name" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <Input label="Google account" type="email" disabled hint="Managed by Google sign-in." {...register('email')} />
        <div className="sm:col-span-2"><Button type="submit" disabled={!isDirty} loading={busy} loadingText="Saving…">Save changes</Button></div>
      </form>
    </SettingsSection>
  )
}

function HouseholdSection() {
  const { household, members } = useMembers()
  const { user, setUser } = useAuth()
  const { data: hh } = useHousehold()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const [invite, setInvite] = useState(false)
  const [leave, setLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const isAdmin = members.find((m) => m.id === user?.id)?.role === 'admin'
  const { register, handleSubmit, formState: { errors, isDirty }, reset } = useForm<HouseholdNameValues>({ resolver: zodResolver(householdNameSchema), values: { name: hh?.name ?? '' } })
  const [busy, setBusy] = useState(false)

  const rename = handleSubmit(async (v) => {
    setBusy(true)
    try { await householdService.rename(v.name); await qc.invalidateQueries({ queryKey: ['hh'] }); await qc.invalidateQueries({ queryKey: ['households'] }); reset(v); toast.success('Household renamed') }
    catch (e) { toast.error(friendlyError(e)) } finally { setBusy(false) }
  })
  const copy = async () => { if (household && await copyToClipboard(household.inviteCode)) toast.success('Invite code copied') }
  const doLeave = async () => {
    setLeaving(true)
    try {
      const u = await householdService.leave(); qc.clear(); setUser(u); qc.setQueryData(ME_KEY, u)
      toast.success('You left the household'); navigate(u.currentHouseholdId ? ROUTES.dashboard : ROUTES.onboarding, { replace: true })
    } catch (e) { toast.error(friendlyError(e)); setLeaving(false) }
  }

  return (
    <SettingsSection id="household" title="Household">
      <form onSubmit={rename} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input className="flex-1" label="Household name" disabled={!isAdmin} hint={isAdmin ? undefined : 'Only admins can rename the household.'} error={errors.name?.message} {...register('name')} />
        {isAdmin && <Button type="submit" disabled={!isDirty} loading={busy} loadingText="Saving…" className="sm:mb-0">Rename</Button>}
      </form>

      <div className="mt-6 rounded-lg bg-surface-2 p-4">
        <p className="text-[13px] text-muted">Invite code</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="tnum font-mono text-lg font-semibold tracking-wider">{household?.inviteCode ?? '—'}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Copy size={14} />} onClick={copy}>Copy</Button>
            <Button variant="secondary" size="sm" leftIcon={<UserPlus size={14} />} onClick={() => setInvite(true)}>Invite</Button>
          </div>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-line" aria-label="Members">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            <Avatar person={m} size="sm" /><span className="flex-1 text-sm font-medium">{m.name}</span>
            {m.status === 'invited' && <Badge tone="warning">Invited</Badge>}<Badge tone={m.role === 'admin' ? 'accent' : 'neutral'}>{m.role === 'admin' ? 'Admin' : 'Member'}</Badge>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-5">
        <div><p className="text-sm font-medium">Leave household</p><p className="t-small text-muted">You’ll lose access to its expenses and settlement.</p></div>
        <Button variant="secondary" className="text-danger hover:bg-danger-soft" onClick={() => setLeave(true)}>Leave</Button>
      </div>
      <InviteDialog open={invite} onClose={() => setInvite(false)} />
      <ConfirmDialog open={leave} onClose={() => setLeave(false)} onConfirm={doLeave} loading={leaving} destructive title={`Leave ${hh?.name ?? 'this household'}?`}
        description={isAdmin && members.length > 1 ? 'You’re an admin. Your housemates will keep the household, but you won’t be able to rejoin without a new invite.' : 'You won’t be able to rejoin without a new invite.'} confirmLabel="Leave household" />
    </SettingsSection>
  )
}

function SecuritySection() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })
  const change = handleSubmit(async (v) => {
    setBusy(true)
    try { await authService.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword }); reset(); toast.success('Password updated') }
    catch (e) { toast.error(friendlyError(e)) } finally { setBusy(false) }
  })
  return (
    <SettingsSection id="security" title="Security">
      <form onSubmit={change} noValidate className="grid max-w-md gap-4">
        <PasswordInput label="Current password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
        <PasswordInput label="New password" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
        <PasswordInput label="Confirm new password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <div><Button type="submit" variant="secondary" loading={busy} loadingText="Updating…">Change password</Button></div>
      </form>
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-line pt-5">
        <div><p className="text-sm font-medium">Log out</p><p className="t-small text-muted">Sign out of Roomly on this device.</p></div>
        <Button variant="secondary" leftIcon={<LogOut size={15} />} onClick={async () => { await logout(); navigate(ROUTES.login) }}>Log out</Button>
      </div>
    </SettingsSection>
  )
}

function DemoTools() {
  const toast = useToast()
  const [failing, setFailing] = useState(mockControls.isFailing())
  const [confirm, setConfirm] = useState(false)
  return (
    <SettingsSection id="demo" title="Demo tools" description="Only visible while running on the built-in mock API.">
      <Switch checked={failing} onChange={(v) => { mockControls.setFailing(v); setFailing(v); toast.info(v ? 'Server errors on' : 'Server errors off', v ? 'Reload any page to see the error states.' : undefined) }}
        label="Simulate server errors" description="Make every request fail so you can review the error states." />
      <div className="mt-2 flex items-center justify-between gap-4 border-t border-line pt-4">
        <div><p className="flex items-center gap-2 text-sm font-medium"><Bug size={14} />Reset demo data</p><p className="t-small text-muted">Restores Casa 4, October 2026 and signs you out.</p></div>
        <Button variant="secondary" leftIcon={<RotateCcw size={14} />} onClick={() => setConfirm(true)}>Reset</Button>
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} destructive title="Reset all demo data?" description="Every expense, payment and account you created will be replaced with the original demo." confirmLabel="Reset demo"
        onConfirm={() => { mockControls.setFailing(false); mockControls.reset(); localStorage.removeItem(config.tokenKey); window.location.href = ROUTES.login }} />
    </SettingsSection>
  )
}

export function SettingsPage() {
  const { pref, setPref } = useTheme()
  const [prefs, update] = usePreferences()
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
    return () => clearTimeout(t)
  }, [hash])

  return (
    <>
      <PageHeader title="Settings" description="Your profile, household and preferences." />
      <div className="grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-24 space-y-0.5">
            {SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`} className="block rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg">{label}</a></li>)}
          </ul>
        </nav>
        <div className="max-w-2xl space-y-8">
          <ProfileSection />
          <HouseholdSection />
          <WhatsAppSection />
          <SettingsSection id="appearance" title="Appearance" description="Roomly follows your device by default.">
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
              {THEME_OPTIONS.map((t) => (
                <button key={t.value} role="radio" aria-checked={pref === t.value} onClick={() => setPref(t.value)}
                  className={cn('flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-all', pref === t.value ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-muted hover:border-line-strong hover:text-fg')}>
                  <t.icon size={20} strokeWidth={1.75} />{t.label}
                </button>
              ))}
            </div>
          </SettingsSection>
          <SettingsSection id="notifications" title="Notifications" description="Choose what Roomly tells you about.">
            <div className="divide-y divide-line">
              <Switch checked={prefs.expenseAdded} onChange={(v) => update({ expenseAdded: v })} label="Expense added" description="When a housemate records a purchase." />
              <Switch checked={prefs.settlementReminder} onChange={(v) => update({ settlementReminder: v })} label="Settlement reminder" description="A nudge near the end of the month if you owe." />
              <Switch checked={prefs.monthlySummary} onChange={(v) => update({ monthlySummary: v })} label="Monthly summary" description="Your Roomly Wrapped, the day a month closes." />
            </div>
          </SettingsSection>
          <SecuritySection />
          {config.useMock && <DemoTools />}
        </div>
      </div>
    </>
  )
}
