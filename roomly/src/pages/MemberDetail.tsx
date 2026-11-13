import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Receipt } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthSelector } from '@/components/common/MonthSelector'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import { Money } from '@/components/ui/Money'
import { useExpenses, useMembers } from '@/hooks/queries'
import { currentMonth, monthLabel } from '@/utils/date'
import { sum, pluralize } from '@/utils/format'
import { ROUTES } from '@/constants/routes'

export function MemberDetailPage() {
  const { id = '' } = useParams()
  const [month, setMonth] = useState(currentMonth())
  const { members, byId, isPending: membersPending } = useMembers()
  const member = byId(id)
  const query = useExpenses({ month, members: [id] })
  const expenses = query.data ?? []
  const total = sum(expenses.map((expense) => expense.amount))

  return <>
    <PageHeader title={member.name} description={`Expenses paid by this member · ${monthLabel(month)}`}
      actions={<><MonthSelector month={month} onChange={setMonth} /><Link to={ROUTES.members} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft size={15} /> Group</Link></>} />
    {membersPending || query.isPending ? <SkeletonList rows={6} />
      : query.isError ? <ErrorState description="We couldn’t load this member’s expenses." onRetry={query.refetch} />
      : <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card p-5"><p className="text-sm text-muted">Total paid</p><Money value={total} className="mt-2 block text-2xl font-semibold" /></div>
          <div className="card p-5"><p className="text-sm text-muted">Expenses</p><p className="tnum mt-2 text-2xl font-semibold">{expenses.length}</p></div>
        </div>
        {expenses.length ? <>
          <p className="px-1 text-sm text-muted">{pluralize(expenses.length, 'expense')} paid by {member.name}</p>
          <ExpenseList expenses={expenses} grouped />
        </> : <div className="card"><EmptyState icon={Receipt} title="No expenses for this month" description={`${member.name} hasn’t paid for any recorded expenses in ${monthLabel(month)}.`} /></div>}
      </section>}
  </>
}
