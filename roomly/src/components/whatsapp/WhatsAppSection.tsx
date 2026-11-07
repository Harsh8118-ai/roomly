import { useState } from 'react'
import { Link2Off, MessageCircle, PlugZap } from 'lucide-react'
import { SettingsSection } from '@/components/common/SettingsSection'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { ErrorState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Switch } from '@/components/ui/Switch'
import { useMembers } from '@/hooks/queries'
import { useUnlinkWhatsApp, useWhatsAppSettings, useWhatsAppStatus } from '@/hooks/whatsapp'
import { useAuth } from '@/store/AuthProvider'
import { ActivityList } from './ActivityList'
import { BotCard } from './BotCard'
import { GroupCard } from './GroupCard'
import { LinkWhatsAppDialog } from './LinkWhatsAppDialog'
import { MemberLinkList } from './MemberLinkList'
import { MessagePlayground } from './MessagePlayground'

export function WhatsAppSection() {
  const { user } = useAuth()
  const { data: status, isPending, isError, refetch } = useWhatsAppStatus()
  const { members } = useMembers()
  const settings = useWhatsAppSettings()
  const unlink = useUnlinkWhatsApp()
  const [linking, setLinking] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  return (
    <SettingsSection id="whatsapp" title="WhatsApp" description="Log expenses by texting — the way your house already does.">
      {isError ? <ErrorState title="Couldn’t load WhatsApp settings." onRetry={refetch} className="border-0 py-8" />
        : isPending || !status || !user ? <div className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-52 w-full" /></div>
        : !status.configured ? (
          <div className="flex gap-3 rounded-lg bg-surface-2 p-4"><PlugZap size={18} className="mt-0.5 shrink-0 text-muted" />
            <div><p className="text-sm font-medium">WhatsApp isn’t set up on this server yet.</p>
              <p className="t-small mt-1 text-muted">{status.isAdmin ? 'Add your WhatsApp Cloud API credentials to the server’s environment (see the server README), restart it, and this page comes alive.' : 'Ask an admin to finish the WhatsApp setup.'}</p></div></div>
        ) : (
          <div className="space-y-7">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-soft p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-surface text-accent-strong"><MessageCircle size={19} /></span>
                <div><p className="text-sm font-medium">Your number</p>
                  <p className="t-small text-muted">{status.me.linked ? <>Linked {status.me.phoneMasked && <span className="tnum">· {status.me.phoneMasked}</span>}</> : 'Not linked yet — Roomly can’t tell who’s texting.'}</p></div>
              </div>
              {status.me.linked
                ? <div className="flex items-center gap-2"><Badge tone="success" dot>Linked</Badge><Button size="sm" variant="ghost" leftIcon={<Link2Off size={13} />} onClick={() => setConfirmUnlink(true)}>Unlink</Button></div>
                : <Button onClick={() => setLinking(true)}>Link my number</Button>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <BotCard status={status} onLink={() => setLinking(true)} />
              <GroupCard status={status} memberCount={members.length} />
            </div>

            <MemberLinkList status={status} userId={user.id} />

            <div className="rounded-xl border border-line px-4">
              <Switch checked={status.autoReply} label="Confirm in the group" disabled={!status.isAdmin}
                description={status.isAdmin ? 'Roomly replies “✅ Added ₹150 · Vegetables” in the group after each expense.' : 'Only admins can change this.'}
                onChange={(v) => settings.mutate({ autoReply: v })} />
            </div>

            <MessagePlayground status={status} />
            <ActivityList />
          </div>
        )}

      <LinkWhatsAppDialog open={linking} onClose={() => setLinking(false)} />
      <ConfirmDialog open={confirmUnlink} onClose={() => setConfirmUnlink(false)} loading={unlink.isPending} destructive title="Unlink your number?"
        description="Roomly will stop recognising your WhatsApp messages. You can link again any time." confirmLabel="Unlink"
        onConfirm={() => unlink.mutate(undefined, { onSettled: () => setConfirmUnlink(false) })} />
    </SettingsSection>
  )
}
