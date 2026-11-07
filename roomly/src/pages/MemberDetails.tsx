import { useParams } from 'react-router-dom'
import { Crown, Receipt } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ExpenseRow } from '@/components/expenses/ExpenseRow'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import { Skeleton } from '@/components/ui/Skeleton'
import { CATEGORY_MAP } from '@/constants/categories'
import { ROUTES } from '@/constants/routes'
import { useExpenses, useMembers, useSettlement } from '@/hooks/queries'
import { useAuth } from '@/store/AuthProvider'
import { currentMonth, monthLabel } from '@/utils/date'
import { formatINR, sum } from '@/utils/format'
import { LinkButton } from '@/components/ui/Button'
import type { CategoryId } from '@/types'

export function MemberDetailsPage() {
  const { id = '' } = useParams()
  const month = currentMonth()
  const { user } = useAuth()
  const { members, isPending: mp, byId } = useMembers()
  const expenses = useExpenses({ month, members: [id] })
  const settlement = useSettlement(month)
  const back = { to: ROUTES.members, label: 'Members' }

  if (mp) return <div className="space-y-4"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
  const member = members.find((m) => m.id === id)
  if (!member) return <><PageHeader title="Member" back={back} /><ErrorState title="Member not found." description="They may have left the household." /></>

  const list = expenses.data ?? []
  const total = sum(list.map((e) => e.amount))
  const byCat = list.reduce<Record<string, number>>((a, e) => ({ ...a, [e.category]: (a[e.category] ?? 0) + e.amount }), {})
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]?.[0] as CategoryId | undefined
  const balance = settlement.data?.members.find((m) => m.memberId === id)?.balance ?? 0

  const stats = [
    { label: 'Contributed', value: <span className="tnum">{formatINR(total)}</span> },
    { label: 'Purchases', value: list.length },
    { label: 'Average expense', value: <span className="tnum">{formatINR(list.length ? total / list.length : 0)}</span> },
    { label: 'Top category', value: top ? <span className="inline-flex items-center gap-2"><CategoryIcon category={top} size="sm" />{CATEGORY_MAP[top].label}</span> : '—' },
    { label: 'Balance', value: <Money value={balance} signed /> },
  ]

  return (
    <>
      <PageHeader title={member.name} back={back} />
      <Card variant="primary" className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:p-7">
        <Avatar person={member} size="xl" />
        <div className="text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h2 className="text-xl font-semibold">{member.name}</h2>
            {member.role === 'admin' && <Badge tone="accent"><Crown size={11} />Admin</Badge>}
            {member.id === user?.id && <Badge>You</Badge>}
            {member.status === 'invited' && <Badge tone="warning">Invited</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">{member.email ?? 'No email added'} · {monthLabel(month)}</p>
          {byId(id).id && <LinkButton to={`${ROUTES.expenses}?members=${id}`} variant="secondary" size="sm" className="mt-3">See all their expenses</LinkButton>}
        </div>
      </Card>

      <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 last:col-span-2 md:last:col-span-1">
            <dt className="t-micro text-muted">{s.label}</dt>
            <dd className="mt-1.5 text-base font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8" aria-labelledby="mr">
        <CardHeader className="mb-3 px-1" title="Recent expenses" subtitle={`Paid by ${member.name.split(' ')[0]} in ${monthLabel(month, { year: false })}`} />
        <span id="mr" className="sr-only">Recent expenses</span>
        {expenses.isPending ? <Skeleton className="h-64 rounded-xl" /> : list.length === 0 ? (
          <Card><EmptyState icon={Receipt} title="No expenses yet." description={`${member.name.split(' ')[0]} hasn’t paid for anything this month.`} compact /></Card>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">{list.slice(0, 10).map((e) => <ExpenseRow key={e.id} expense={e} payer={member} isMe={e.paidBy === user?.id} />)}</Card>
        )}
      </section>
    </>
  )
}
