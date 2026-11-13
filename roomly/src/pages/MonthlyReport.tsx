import { Link, useParams } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown'
import { TrendChart } from '@/components/history/TrendChart'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import { Skeleton } from '@/components/ui/Skeleton'
import { LinkButton } from '@/components/ui/Button'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { ROUTES } from '@/constants/routes'
import { useMembers, useSettlement, useSummary } from '@/hooks/queries'
import { formatDate, monthLabel } from '@/utils/date'
import { formatINR, pluralize } from '@/utils/format'
import { Receipt } from 'lucide-react'

export function MonthlyReportPage({ wrapped = false }: { wrapped?: boolean }) {
  const { month = '' } = useParams()
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
  const summary = useSummary(valid ? month : '2000-01')
  const settlement = useSettlement(valid ? month : '2000-01')
  const { byId } = useMembers()
  const back = { to: ROUTES.history, label: 'History' }

  if (!valid) return <><PageHeader title={wrapped ? 'Roomly Wrapped' : 'Report'} back={back} /><ErrorState title="That month doesn’t exist." description="Pick a month from your history." /></>
  if (summary.isError || settlement.isError) return <><PageHeader title={wrapped ? `${monthLabel(month)} Wrapped` : monthLabel(month)} back={back} /><ErrorState description="We couldn’t load this report." onRetry={() => { summary.refetch(); settlement.refetch() }} /></>
  if (summary.isPending || settlement.isPending) return <><PageHeader title={monthLabel(month)} back={back} /><div className="space-y-4"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-64 rounded-xl" /></div></>

  const s = summary.data; const st = settlement.data
  if (s.expenseCount === 0) return <><PageHeader title={monthLabel(month)} back={back} /><Card><EmptyState icon={Receipt} title="No expenses yet." description={`Nothing was recorded in ${monthLabel(month)}.`} /></Card></>

  return (
    <>
      <PageHeader
        title={wrapped ? `${monthLabel(month)} Wrapped` : `${monthLabel(month)} report`} back={back}
        description={<span className="inline-flex items-center gap-2">{pluralize(s.expenseCount, 'expense')} {st.status === 'settled' ? <Badge tone="success" dot>Settled</Badge> : <Badge tone="warning" dot>Open</Badge>}</span>}
        actions={wrapped ? <LinkButton to={ROUTES.report(month)} variant="secondary">View full report</LinkButton> : <LinkButton to={ROUTES.wrapped(month)} variant="secondary" leftIcon={<Sparkles size={15} />}>Watch Wrapped</LinkButton>}
      />

      <Card variant="primary" className="grid gap-6 p-6 sm:grid-cols-3">
        <div className="sm:col-span-1"><p className="text-[13px] text-muted">Total spending</p><AnimatedNumber value={s.total} format={formatINR} className="t-money-xl mt-1 block !text-[2.5rem]" /></div>
        <div><p className="text-[13px] text-muted">Fair share</p><p className="tnum mt-1 text-xl font-semibold">{formatINR(st.fairShare)}<span className="ml-1 text-sm font-normal text-muted">/person</span></p></div>
        <div><p className="text-[13px] text-muted">Average expense</p><p className="tnum mt-1 text-xl font-semibold">{formatINR(s.total / s.expenseCount)}</p></div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="p-5 pb-3"><CardHeader title="Contributions" subtitle="What each person paid vs. their share" /></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead><tr className="border-y border-line bg-surface-2/50 text-left text-xs text-muted">
                <th className="px-5 py-2 font-medium">Member</th><th className="px-2 py-2 text-right font-medium">Paid</th><th className="px-2 py-2 text-right font-medium">Share</th><th className="px-5 py-2 text-right font-medium">Balance</th></tr></thead>
              <tbody className="divide-y divide-line">
                {st.members.map((m) => (
                  <tr key={m.memberId}>
                    <td className="px-5 py-3"><span className="flex items-center gap-2.5"><Avatar person={byId(m.memberId)} size="sm" /><Link to={ROUTES.member(m.memberId)} className="font-medium hover:underline">{byId(m.memberId).name.split(' ')[0]}</Link></span></td>
                    <td className="tnum px-2 py-3 text-right">{formatINR(m.paid)}</td>
                    <td className="tnum px-2 py-3 text-right text-muted">{formatINR(m.share)}</td>
                    <td className="px-5 py-3 text-right font-semibold"><Money value={m.balance} signed /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <CardHeader title="Settlement" subtitle={st.transactions.length ? 'Payments to square up' : 'No payments were needed'} />
          <ul className="mt-4 space-y-2.5">
            {st.transactions.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-lg bg-surface-2/60 p-3">
                <Avatar person={byId(t.from)} size="sm" />
                <span className="flex-1 text-sm"><strong className="font-medium">{byId(t.from).name.split(' ')[0]}</strong> paid <strong className="font-medium">{byId(t.to).name.split(' ')[0]}</strong></span>
                <span className="tnum text-sm font-semibold">{formatINR(t.amount)}</span>
                <Badge tone={t.status === 'settled' ? 'success' : 'warning'}>{t.status === 'settled' ? 'Settled' : 'Pending'}</Badge>
              </li>
            ))}
          </ul>
          <LinkButton to={ROUTES.settlement} variant="ghost" size="sm" className="mt-3">Open settlement</LinkButton>
        </Card>

        <CategoryBreakdown data={s.byCategory} total={s.total} linkMonth={month} />
        <TrendChart data={s.trend} />
      </div>

      <section className="mt-8" aria-labelledby="top-h">
        <h2 id="top-h" className="t-section mb-3 px-1">Biggest expenses</h2>
        <Card className="divide-y divide-line overflow-hidden">
          {s.topExpenses.map((e, i) => (
            <Link key={e.id} to={ROUTES.expense(e.id)} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-2/70">
              <span className="tnum w-5 text-center text-sm text-subtle">{i + 1}</span>
              <CategoryIcon category={e.category} size="sm" />
              <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium">{e.title}</span><span className="t-small text-muted">{byId(e.paidBy).name.split(' ')[0]} · {formatDate(e.date)}</span></span>
              <Money value={e.amount} className="font-semibold" />
            </Link>
          ))}
        </Card>
      </section>
    </>
  )
}
