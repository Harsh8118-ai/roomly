import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Copy, Link2, Users } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { householdService } from '@/services/householdService'
import { authService } from '@/services/authService'
import { useAuth } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'
import { friendlyError } from '@/utils/errors'
import { copyToClipboard } from '@/utils/clipboard'
import { ROUTES } from '@/constants/routes'

export function OnboardingPage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const [name, setName] = useState('')
  const [code, setCode] = useState(params.get('join') ?? '')
  const [mode, setMode] = useState<'create' | 'join'>(params.get('join') ? 'join' : 'create')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteGroup, setInviteGroup] = useState<{ id: string; name: string; members: { id: string; name: string }[] } | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const inviteLink = inviteCode ? `${window.location.origin}/?join=${inviteCode}` : ''

  useEffect(() => { if (params.get('join')) { setMode('join'); setCode(params.get('join')!.replace(/\D/g, '').slice(0, 4)) } }, [params])

  useEffect(() => {
    let active = true
    if (mode === 'join' && /^\\d{4}$/.test(code)) {
      householdService.previewInvite(code).then((group) => {
        if (active) { setInviteGroup(group); setSelectedMemberId('') }
      }).catch(() => { if (active) setInviteGroup(null) })
    } else setInviteGroup(null)
    return () => { active = false }
  }, [mode, code])

  const refreshUser = async () => { const updated = await authService.getCurrentUser(); setUser(updated) }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const household = mode === 'create'
        ? await householdService.create(name.trim())
        : await householdService.join(code.trim(), selectedMemberId || undefined)
      setInviteCode(household.inviteCode)
      await refreshUser()
      toast.success(mode === 'create' ? 'Your group is ready' : 'You joined the group')
      navigate(ROUTES.dashboard, { replace: true })
    } catch (e) { setError(friendlyError(e)) } finally { setBusy(false) }
  }
  const copyInvite = async () => {
    const value = inviteLink || (inviteCode ? `${window.location.origin}/?join=${inviteCode}` : '')
    if (value && await copyToClipboard(value)) toast.success('Invite link copied')
  }

  return <div className="flex min-h-dvh flex-col bg-bg">
    <header className="px-5 py-5 sm:px-10"><Logo /></header>
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-16">
      <div className="mb-7 grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent-strong"><Users size={22} /></div>
      <h1 className="t-large">{user ? `Hi ${user.name.split(' ')[0]}, let's get started.` : 'Set up your group.'}</h1>
      <p className="mt-2 text-muted">Create a shared space for expenses, or join one with a four-digit code.</p>
      <div className="mt-7 grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-1">
        <button type="button" onClick={() => { setMode('create'); setError('') }} className={`rounded-md py-2.5 text-sm font-medium ${mode === 'create' ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}>Create group</button>
        <button type="button" onClick={() => { setMode('join'); setError('') }} className={`rounded-md py-2.5 text-sm font-medium ${mode === 'join' ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}>Join group</button>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && <p role="alert" className="rounded-md bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        {mode === 'create'
          ? <Input label="Group name" placeholder="Flat 302" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={40} />
          : <Input label="4-digit invite code" placeholder="0427" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} required pattern="\d{4}" maxLength={4} />}
          {inviteGroup && <div className="rounded-lg border border-line p-3">
            <p className="text-sm font-semibold">Join {inviteGroup.name}</p>
            <p className="mt-1 text-xs text-muted">Choose an existing identity or join as a new member.</p>
            <label className="mt-3 flex items-center gap-2 rounded-md p-2 text-sm hover:bg-surface-2"><input type="radio" name="memberIdentity" checked={!selectedMemberId} onChange={() => setSelectedMemberId('')} /> Join as a new member ({user?.name})</label>
            {inviteGroup.members.map((member) => <label key={member.id} className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-surface-2"><input type="radio" name="memberIdentity" checked={selectedMemberId === member.id} onChange={() => setSelectedMemberId(member.id)} /> Join as {member.name}</label>)}
          </div>}
        <Button type="submit" fullWidth size="lg" loading={busy} loadingText={mode === 'create' ? 'Creating group…' : 'Joining group…'}>
          {mode === 'create' ? 'Create group' : 'Join group'}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs text-muted">You can invite everyone else from the Group tab after setup.</p>
      {inviteCode && <div className="mt-6 rounded-lg border border-line p-4">
        <p className="text-sm font-medium">Invite your group</p>
        <p className="mt-1 font-mono text-2xl tracking-widest">{inviteCode}</p>
        <Button className="mt-3" variant="secondary" fullWidth leftIcon={<Link2 size={16} />} onClick={copyInvite}>Copy invite link</Button>
      </div>}
    </main>
  </div>
}
