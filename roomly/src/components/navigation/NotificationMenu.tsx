import { Bell, CheckCheck, PartyPopper, Receipt, Scale, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Dropdown } from '@/components/ui/Dropdown'
import { IconButton } from '@/components/ui/IconButton'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMarkAllRead, useMarkNotificationRead, useNotifications } from '@/hooks/queries'
import type { AppNotification } from '@/types'
import { timeAgo } from '@/utils/date'
import { cn } from '@/utils/cn'

const ICONS = { expense: Receipt, owe: Wallet, settlement: Scale, settled: PartyPopper }

export function NotificationItem({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  const Icon = ICONS[n.type]
  return (
    <button onClick={() => onOpen(n)} className="flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:outline-none">
      <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md', n.read ? 'bg-surface-2 text-muted' : 'bg-accent-soft text-accent-strong')}><Icon size={15} aria-hidden /></span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm leading-snug', !n.read && 'font-medium')}>{n.title}</span>
        <span className="t-micro text-muted">{timeAgo(n.createdAt)}</span>
      </span>
      {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-strong" aria-label="Unread" />}
    </button>
  )
}

export function NotificationMenu() {
  const { data, isPending } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllRead()
  const navigate = useNavigate()
  const unread = data?.filter((n) => !n.read).length ?? 0

  return (
    <Dropdown
      role="dialog" label="Notifications" panelClassName="w-[min(92vw,380px)] p-0"
      trigger={({ toggle, props }) => (
        <span className="relative inline-flex">
          <IconButton label={unread ? `Notifications, ${unread} unread` : 'Notifications'} onClick={toggle} {...props}><Bell size={19} /></IconButton>
          {unread > 0 && <span className="pointer-events-none absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-strong ring-2 ring-bg" />}
        </span>
      )}
    >
      {({ close }) => (
        <div>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unread > 0 && (
              <button onClick={() => markAll.mutate()} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-strong hover:underline"><CheckCheck size={14} />Mark all read</button>
            )}
          </div>
          <div className="max-h-[min(70vh,420px)] overflow-y-auto p-1.5">
            {isPending && Array.from({ length: 3 }).map((_, i) => <div key={i} className="flex gap-3 p-2.5"><Skeleton className="h-8 w-8" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-4/5" /><Skeleton className="h-3 w-1/4" /></div></div>)}
            {data?.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">You’re all caught up.</p>}
            {data?.map((n) => (
              <NotificationItem key={n.id} n={n} onOpen={(x) => { if (!x.read) markRead.mutate(x.id); close(); navigate(x.href) }} />
            ))}
          </div>
        </div>
      )}
    </Dropdown>
  )
}
