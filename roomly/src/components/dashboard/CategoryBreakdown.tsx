import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { CATEGORY_MAP, chartColor } from '@/constants/categories'
import { ROUTES } from '@/constants/routes'
import { formatINR, formatPercent } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { CategoryTotal } from '@/types'

export function CategoryBreakdown({ data, total, loading, linkMonth }: { data?: CategoryTotal[]; total: number; loading?: boolean; linkMonth?: string }) {
  const [active, setActive] = useState<string | null>(null)

  // Top 5 get their own colour; everything after is folded into the quiet tail.
  const rows = (data ?? []).map((d, i) => ({ ...d, color: chartColor(i) }))

  return (
    <Card className="p-5">
      <CardHeader title="Where the money goes" subtitle={loading ? ' ' : `${rows.length} categories this month`} />
      {loading || !data ? (
        <div className="mt-6 space-y-4"><Skeleton className="h-3 w-full" />{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      ) : (
        <>
          <div className="mt-5 flex h-2.5 w-full gap-[3px] overflow-hidden rounded-full" role="img" aria-label="Category share bar">
            {rows.map((r, i) => (
              <motion.div key={r.category} onMouseEnter={() => setActive(r.category)} onMouseLeave={() => setActive(null)}
                initial={{ flexGrow: 0 }} animate={{ flexGrow: r.total }} transition={{ delay: i * 0.04, type: 'spring', stiffness: 120, damping: 22 }}
                className={cn('h-full rounded-full transition-opacity', active && active !== r.category && 'opacity-35')} style={{ background: r.color, flexBasis: 0 }} />
            ))}
          </div>
          <ul className="mt-4 divide-y divide-line">
            {rows.map((r) => (
              <li key={r.category}>
                <Link
                  to={`${ROUTES.expenses}?categories=${r.category}${linkMonth ? `&month=${linkMonth}` : ''}`}
                  onMouseEnter={() => setActive(r.category)} onMouseLeave={() => setActive(null)}
                  className={cn('flex items-center gap-3 rounded-md px-1 py-2.5 transition-colors hover:bg-surface-2/60', active && active !== r.category && 'opacity-60')}
                >
                  <CategoryIcon category={r.category} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium"><span className="h-2 w-2 rounded-full" style={{ background: r.color }} aria-hidden />{CATEGORY_MAP[r.category].label}</span>
                  </span>
                  <span className="tnum t-small text-muted">{formatPercent(total ? (r.total / total) * 100 : 0, 0)}</span>
                  <span className="tnum w-20 text-right text-sm font-semibold">{formatINR(r.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
