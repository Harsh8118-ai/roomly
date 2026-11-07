import { Link } from 'react-router-dom'
import { Receipt } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import { ExpenseRow } from '@/components/expenses/ExpenseRow'
import { useExpenses, useMembers } from '@/hooks/queries'
import { useComposer } from '@/store/ComposerProvider'
import { currentMonth } from '@/utils/date'
import { ROUTES } from '@/constants/routes'

export function RecentExpenses({ userId }: { userId: string }) {
  const { data, isPending, isError, refetch } = useExpenses({ month: currentMonth() })
  const { byId } = useMembers()
  const { openNew } = useComposer()
  const recent = data?.slice(0, 7)

  return (
    <section aria-labelledby="recent-h">
      <CardHeader className="mb-3 px-1" title="Recent expenses" action={<Link to={ROUTES.expenses} className="text-[13px] font-medium text-accent-strong hover:underline">View all expenses</Link>} />
      <span id="recent-h" className="sr-only">Recent expenses</span>
      {isError ? <ErrorState title="Something went wrong." description="We couldn’t load your household expenses." onRetry={refetch} />
        : isPending ? <SkeletonList rows={5} />
        : recent && recent.length > 0 ? (
          <Card className="divide-y divide-line overflow-hidden">
            {recent.map((e) => <ExpenseRow key={e.id} expense={e} payer={byId(e.paidBy)} isMe={e.paidBy === userId} />)}
          </Card>
        ) : (
          <Card><EmptyState icon={Receipt} title="No expenses yet." description="Your household hasn’t recorded any expenses this month. Add your first expense to get started."
            action={<Button onClick={openNew}>Add expense</Button>} /></Card>
        )}
    </section>
  )
}
