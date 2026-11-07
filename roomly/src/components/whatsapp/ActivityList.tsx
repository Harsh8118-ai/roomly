import { Link } from 'react-router-dom'
import { Link2, MessageCircle, Undo2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMembers } from '@/hooks/queries'
import { useWhatsAppActivity } from '@/hooks/whatsapp'
import { ROUTES } from '@/constants/routes'
import { timeAgo } from '@/utils/date'
import { formatINR } from '@/utils/format'

export function ActivityList() {
  const { data, isPending } = useWhatsAppActivity(8)
  const { byId } = useMembers()
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Recent from WhatsApp</h3>
      {isPending ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        : !data?.length ? <p className="rounded-xl border border-dashed border-line-strong p-5 text-center text-sm text-muted">Nothing yet. Expenses texted to Roomly will show up here.</p>
        : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {data.map((a) => {
              const who = a.memberId ? byId(a.memberId) : null
              const Icon = a.outcome === 'undo' ? Undo2 : a.outcome === 'link' ? Link2 : MessageCircle
              const body = (
                <>
                  {who ? <Avatar person={who} size="sm" /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-2"><Icon size={14} /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm"><span className="font-medium">{who?.name.split(' ')[0] ?? 'Someone'}</span>{' '}
                      <span className="text-muted">{a.outcome === 'expense' ? `texted “${a.text}”` : a.outcome === 'undo' ? `undid “${a.text}”` : 'linked their number'}</span></span>
                    <span className="t-micro text-muted">{timeAgo(a.at)} · {a.via === 'group' ? 'Group' : 'Direct message'}</span>
                  </span>
                  {a.amount !== undefined && <span className={`tnum text-sm font-semibold ${a.outcome === 'undo' ? 'text-muted line-through' : ''}`}>{formatINR(a.amount)}</span>}
                </>
              )
              const cls = 'flex items-center gap-3 px-3.5 py-2.5'
              return <li key={a.id}>{a.expenseId && a.outcome === 'expense' ? <Link to={ROUTES.expense(a.expenseId)} className={`${cls} transition-colors hover:bg-surface-2/60`}>{body}</Link> : <div className={cls}>{body}</div>}</li>
            })}
          </ul>
        )}
    </div>
  )
}
