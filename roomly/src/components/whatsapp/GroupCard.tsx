import { useState } from 'react'
import { Copy, ExternalLink, Info, Link2Off, RefreshCw, Share2, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { ProgressBar } from '@/components/ui/Progress'
import { Spinner } from '@/components/ui/Spinner'
import { useCreateWhatsAppGroup, useDeleteWhatsAppGroup, useResetInviteLink } from '@/hooks/whatsapp'
import { useToast } from '@/store/ToastProvider'
import { copyToClipboard } from '@/utils/clipboard'
import type { WhatsAppStatus } from '@/types'

export function GroupCard({ status, memberCount }: { status: WhatsAppStatus; memberCount: number }) {
  const toast = useToast()
  const create = useCreateWhatsAppGroup()
  const del = useDeleteWhatsAppGroup()
  const reset = useResetInviteLink()
  const [confirm, setConfirm] = useState<'delete' | 'reset' | null>(null)
  const g = status.group
  const active = g?.status === 'active'
  const creating = g?.status === 'creating' || create.isPending

  const copy = async () => { if (g?.inviteLink && await copyToClipboard(g.inviteLink)) toast.success('Invite link copied') }
  const share = async () => {
    if (!g?.inviteLink) return
    if (navigator.share) { try { await navigator.share({ title: g.subject, text: 'Join our household on WhatsApp', url: g.inviteLink }); return } catch { /* cancelled */ } }
    copy()
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-md bg-surface-2"><Users size={17} strokeWidth={1.75} /></span><h3 className="font-semibold">Household group</h3></div>
        {active && <Badge tone="success" dot>Active</Badge>}
        {g?.status === 'suspended' && <Badge tone="warning" dot>Suspended</Badge>}
      </div>

      {!status.groupsAvailable ? (
        <div className="mt-3 flex flex-1 flex-col gap-3">
          <p className="text-sm text-muted">Text expenses to a shared WhatsApp group, so nobody has to remember to open an app.</p>
          <p className="flex gap-2 rounded-lg bg-surface-2 p-3 text-[13px] text-muted"><Info size={15} className="mt-0.5 shrink-0" />Groups need a WhatsApp number with an Official Business Account, so this is switched off here. Messaging the bot works without it.</p>
        </div>
      ) : creating ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center" role="status"><Spinner size={22} className="text-accent-strong" /><p className="text-sm font-medium">Creating your group…</p><p className="t-small text-muted">This takes a few seconds.</p></div>
      ) : active && g ? (
        <div className="mt-3 flex flex-1 flex-col gap-3">
          <p className="text-sm text-muted">Housemates join with this link. Anyone who’s linked their number can text expenses in the group.</p>
          <div className="flex items-center gap-2 rounded-md border border-line bg-surface-2/60 p-1.5 pl-3">
            <span className="min-w-0 flex-1 truncate font-mono text-[13px]" title={g.inviteLink}>{g.inviteLink?.replace('https://', '')}</span>
            <Button size="sm" variant="secondary" leftIcon={<Copy size={13} />} onClick={copy}>Copy</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={g.inviteLink} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-3 text-[13px] font-medium shadow-xs transition-colors hover:bg-surface-2"><ExternalLink size={13} />Open</a>
            <Button size="sm" variant="secondary" leftIcon={<Share2 size={13} />} onClick={share}>Share</Button>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-[13px]"><span className="text-muted">Joined</span><span className="tnum font-medium">{g.joinedCount} of {memberCount}</span></div>
            <ProgressBar value={g.joinedCount} max={Math.max(1, memberCount)} label="Housemates in the group" />
          </div>
          <p className="t-micro text-muted">Roomly reads messages in this group to find expenses. Anything that doesn’t look like one is ignored and never stored. Groups hold up to 8 people.</p>
          {status.isAdmin && (
            <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3">
              <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={13} />} onClick={() => setConfirm('reset')}>Reset link</Button>
              <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" leftIcon={<Trash2 size={13} />} onClick={() => setConfirm('delete')}>Delete group</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-1 flex-col gap-3">
          <p className="text-sm text-muted">Roomly creates a WhatsApp group for your household. Housemates join with an invite link, then text expenses right there.</p>
          {g?.status === 'failed' && <p role="alert" className="flex gap-2 rounded-lg bg-danger-soft p-3 text-[13px] text-danger"><Link2Off size={15} className="mt-0.5 shrink-0" />{g.error ?? 'We couldn’t create the group. Try again.'}</p>}
          <div className="mt-auto">
            {status.isAdmin
              ? <Button onClick={() => create.mutate()} loading={create.isPending} loadingText="Creating…" leftIcon={<Users size={15} />}>{g?.status === 'failed' ? 'Try again' : 'Create group'}</Button>
              : <p className="text-sm text-muted">Ask an admin to create it.</p>}
          </div>
        </div>
      )}

      <ConfirmDialog open={confirm === 'delete'} onClose={() => setConfirm(null)} destructive loading={del.isPending} title="Delete the WhatsApp group?"
        description="Everyone is removed from the group and Roomly stops reading it. Expenses already recorded stay."
        confirmLabel="Delete group" onConfirm={() => del.mutate(undefined, { onSettled: () => setConfirm(null) })} />
      <ConfirmDialog open={confirm === 'reset'} onClose={() => setConfirm(null)} loading={reset.isPending} title="Reset the invite link?"
        description="The current link stops working straight away. People already in the group stay." confirmLabel="Reset link"
        onConfirm={() => reset.mutate(undefined, { onSettled: () => setConfirm(null) })} />
    </div>
  )
}
