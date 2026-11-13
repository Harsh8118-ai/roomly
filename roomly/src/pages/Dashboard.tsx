import { useSearchParams } from 'react-router-dom'
import { SummaryGrid } from '@/components/dashboard/SummaryGrid'
import { MonthSelector } from '@/components/common/MonthSelector'
import { RecentExpenses } from '@/components/dashboard/RecentExpenses'
import { SettlementCard } from '@/components/dashboard/SettlementCard'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { ErrorState } from '@/components/ui/EmptyState'
import { useSettlement, useSummary } from '@/hooks/queries'
import { useAuth } from '@/store/AuthProvider'
import { currentMonth, shiftMonth } from '@/utils/date'

export function DashboardPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const month = params.get('month') ?? currentMonth()
  const setMonth = (value: string) => setParams((prev) => { const next = new URLSearchParams(prev); if (value === currentMonth()) next.delete('month'); else next.set('month', value); return next }, { replace: true })
  const summary = useSummary(month)
  const previous = useSummary(shiftMonth(month, -1))
  const settlement = useSettlement(month)
  if (!user) return null

  if (summary.isError || settlement.isError) {
    return <ErrorState title="Something went wrong." description="We couldn’t load your group overview." onRetry={() => { summary.refetch(); settlement.refetch() }} />
  }
  const loading = summary.isPending || settlement.isPending

  return (
    <div className="space-y-5 md:space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><DashboardHeader month={month} /><MonthSelector month={month} onChange={setMonth} /></div>
      <SummaryGrid month={month} summary={summary.data} settlement={settlement.data} userId={user.id} previousTotal={previous.data?.total} loading={loading} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)] md:gap-6">
        <RecentExpenses userId={user.id} month={month} />
        <SettlementCard settlement={settlement.data} userId={user.id} month={month} loading={loading} />
      </div>
    </div>
  )
}
