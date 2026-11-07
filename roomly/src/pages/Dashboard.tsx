import { SummaryGrid } from '@/components/dashboard/SummaryGrid'
import { SpendingChart } from '@/components/dashboard/SpendingChart'
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown'
import { ContributionSection } from '@/components/dashboard/ContributionSection'
import { SettlementCard } from '@/components/dashboard/SettlementCard'
import { RecentExpenses } from '@/components/dashboard/RecentExpenses'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { WhatsAppNudge } from '@/components/whatsapp/WhatsAppNudge'
import { ErrorState } from '@/components/ui/EmptyState'
import { useSettlement, useSummary } from '@/hooks/queries'
import { useAuth } from '@/store/AuthProvider'
import { currentMonth, shiftMonth } from '@/utils/date'

export function DashboardPage() {
  const { user } = useAuth()
  const month = currentMonth()
  const summary = useSummary(month)
  const prev = useSummary(shiftMonth(month, -1))
  const settlement = useSettlement(month)
  if (!user) return null

  if (summary.isError || settlement.isError) {
    return <ErrorState title="Something went wrong." description="We couldn’t load your household overview." onRetry={() => { summary.refetch(); settlement.refetch() }} />
  }
  const loading = summary.isPending || settlement.isPending

  return (
    <div className="space-y-6 md:space-y-8">
      <DashboardHeader month={month} />
      <WhatsAppNudge />
      <SummaryGrid month={month} summary={summary.data} settlement={settlement.data} userId={user.id} previousTotal={prev.data?.total} loading={loading} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:gap-6">
        <div className="space-y-4 md:space-y-6">
          <SpendingChart />
          <RecentExpenses userId={user.id} />
        </div>
        <div className="space-y-4 md:space-y-6">
          <SettlementCard settlement={settlement.data} userId={user.id} loading={loading} />
          <ContributionSection data={summary.data?.byMember} loading={loading} userId={user.id} />
          <CategoryBreakdown data={summary.data?.byCategory} total={summary.data?.total ?? 0} loading={loading} />
        </div>
      </div>
    </div>
  )
}
