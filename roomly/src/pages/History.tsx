import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarClock, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { ROUTES } from '@/constants/routes'
import { useMonths } from '@/hooks/queries'
import { currentMonth, monthLabel } from '@/utils/date'
import { pluralize } from '@/utils/format'
import { cn } from '@/utils/cn'

export function HistoryPage() {
  const { data, isPending, isError, refetch } = useMonths()
  const months = data?.filter((m) => m.expenseCount > 0 || m.month === currentMonth())

  return (
    <>
      <PageHeader title="History" description="Every month at a glance — tap one for the full report." />
      {isError ? <ErrorState description="We couldn’t load your history." onRetry={refetch} />
        : isPending ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        : !months?.length ? <Card><EmptyState icon={CalendarClock} title="No history yet." description="Once your household records expenses, each month shows up here." /></Card>
        : (
          <ol className="relative space-y-3 pl-7 md:pl-9">
            <span className="absolute bottom-3 left-[7px] top-3 w-px bg-line-strong md:left-[9px]" aria-hidden />
            {months.map((m, i) => {
              const current = m.month === currentMonth()
              return (
                <motion.li key={m.month} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="relative">
                  <span className={cn('absolute -left-7 top-7 h-[15px] w-[15px] rounded-full border-[3px] border-bg md:-left-9 md:h-[19px] md:w-[19px]', m.status === 'settled' ? 'bg-accent-strong' : 'bg-warning')} aria-hidden />
                  <Link to={ROUTES.report(m.month)} className="card card-hover flex items-center gap-4 p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold">{monthLabel(m.month)}</h2>
                        {current && <Badge tone="info">Current</Badge>}
                      </div>
                      <p className="t-small mt-1 text-muted">{pluralize(m.expenseCount, 'expense')}</p>
                    </div>
                    <div className="text-right">
                      <Money value={m.total} className="text-lg font-semibold" />
                      <div className="mt-1.5">{m.status === 'settled' ? <Badge tone="success" dot>Settled</Badge> : m.status === 'open' ? <Badge tone="warning" dot>Open</Badge> : <Badge>No spend</Badge>}</div>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-subtle" aria-hidden />
                  </Link>
                </motion.li>
              )
            })}
          </ol>
        )}
    </>
  )
}
