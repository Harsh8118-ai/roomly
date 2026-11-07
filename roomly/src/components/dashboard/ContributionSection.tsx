import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMembers } from '@/hooks/queries'
import { formatINR } from '@/utils/format'
import { ROUTES } from '@/constants/routes'
import type { MemberTotal } from '@/types'

export function ContributionSection({ data, loading, userId }: { data?: MemberTotal[]; loading?: boolean; userId: string }) {
  const { byId } = useMembers()
  const max = Math.max(1, ...(data ?? []).map((d) => d.total))
  return (
    <Card className="p-5">
      <CardHeader title="Who’s contributed" subtitle="Tap a name to see their purchases" />
      <ul className="mt-4 space-y-1">
        {loading || !data
          ? [0, 1, 2, 3].map((i) => <li key={i} className="flex items-center gap-3 py-2.5"><Skeleton className="h-9 w-9 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-2 w-full" /></div></li>)
          : [...data].sort((a, b) => b.total - a.total).map((d, i) => {
            const m = byId(d.memberId)
            return (
              <li key={d.memberId}>
                <Link to={`${ROUTES.expenses}?members=${d.memberId}`} className="group flex items-center gap-3 rounded-md px-1 py-2.5 transition-colors hover:bg-surface-2/60">
                  <Avatar person={m} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{m.name.split(' ')[0]}{d.memberId === userId && <span className="ml-1.5 text-xs font-normal text-muted">you</span>}</span>
                      <span className="tnum text-sm font-semibold">{formatINR(d.total)}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <motion.div className="h-full rounded-full" style={{ background: `rgb(var(--tone-${m.tone}-fg))`, opacity: 0.75 }} initial={{ width: 0 }} animate={{ width: `${(d.total / max) * 100}%` }} transition={{ delay: 0.1 + i * 0.06, type: 'spring', stiffness: 110, damping: 22 }} />
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </Link>
              </li>
            )
          })}
      </ul>
    </Card>
  )
}
