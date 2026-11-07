import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Copy, UserPlus } from 'lucide-react'
import { ResponsiveDialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { inviteSchema, type InviteValues } from '@/schemas'
import { householdService } from '@/services/householdService'
import { useHousehold } from '@/hooks/queries'
import { useAuth } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'
import { copyToClipboard } from '@/utils/clipboard'
import { friendlyError } from '@/utils/errors'

export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: household } = useHousehold()
  const { user } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { name: '', email: '' } })

  const submit = handleSubmit(async (v) => {
    setBusy(true); setError('')
    try {
      await householdService.inviteMember({ name: v.name, email: v.email || undefined })
      await qc.invalidateQueries({ queryKey: ['hh', user?.currentHouseholdId] })
      toast.success('Housemate added', `${v.name} can now be part of the split.`)
      reset(); onClose()
    } catch (e) { setError(friendlyError(e)) } finally { setBusy(false) }
  })

  const copy = async () => { if (household && await copyToClipboard(household.inviteCode)) toast.success('Invite code copied') }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Invite your housemates" description="Add someone to split with, or share your invite code.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <p role="alert" className="rounded-md bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{error}</p>}
        <Input label="Name" placeholder="Aman" data-autofocus error={errors.name?.message} {...register('name')} />
        <Input label="Email" optional type="email" placeholder="aman@example.com" error={errors.email?.message} {...register('email')} />
        <Button type="submit" fullWidth loading={busy} loadingText="Adding…" leftIcon={<UserPlus size={16} />}>Add housemate</Button>
      </form>
      {household && (
        <div className="mt-6 rounded-lg bg-surface-2 p-4">
          <p className="text-[13px] text-muted">Or share your invite code</p>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <span className="tnum font-mono text-lg font-semibold tracking-wider">{household.inviteCode}</span>
            <Button variant="secondary" size="sm" leftIcon={<Copy size={14} />} onClick={copy}>Copy</Button>
          </div>
        </div>
      )}
    </ResponsiveDialog>
  )
}
