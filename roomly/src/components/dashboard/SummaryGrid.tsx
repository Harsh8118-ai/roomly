import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Check, Home, PiggyBank, Scale } from 'lucide-react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { balanceTone } from '@/components/ui/Money'
import { formatINR, formatPercent, formatSigned } from '@/utils/format'
import { monthLabel } from '@/utils/date'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/utils/cn'
import type { MonthKey, MonthlySummary, Settlement } from '@/types'
import { useMembers } from '@/hooks/queries'

interface Props { month: MonthKey; summary?: MonthlySummary; settlement?: Settlement; userId: string; previousTotal?: number; loading: boolean }

export function SummaryGrid({ month, summary, settlement, userId, previousTotal, loading }: Props) {
  const { members, byId } = useMembers()
  if (loading || !summary || !settlement) {
    return <div className="grid gap-3 sm:grid-cols-3 md:gap-4">{[0, 1, 2].map((i) => <SkeletonCard key={i} />)}</div>
  }
  const mine = summary.byMember.find((m) => m.memberId === userId)?.total ?? 0
  const balance = settlement.members.find((m) => m.memberId === userId)?.balance ?? 0
  const share = summary.total ? (mine / summary.total) * 100 : 0
  const trend = previousTotal ? ((summary.total - previousTotal) / previousTotal) * 100 : null

  const cards = [
    {
      key: 'total', icon: Home, label: 'Household spending', value: summary.total, format: formatINR,
      sub: <>{monthLabel(month, { year: false })} · {summary.expenseCount} expenses
        {trend !== null && <span className="ml-1.5 inline-flex items-center gap-0.5 text-muted">{trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(trend).toFixed(0)}% vs last month</span>}</>,
      to: `${ROUTES.expenses}?month=${month}`, primary: true,
    },
    { key: 'mine', icon: PiggyBank, label: 'Your contribution', value: mine, format: formatINR, sub: <>{formatPercent(share)} of household</>, to: `${ROUTES.member(userId)}?month=${month}` },
    {
      key: 'bal', icon: Scale, label: 'Your balance', value: balance, format: formatSigned, to: ROUTES.settlement, tone: balanceTone(balance),
      sub: balance > 0 ? 'You should receive' : balance < 0 ? 'You owe the household' : <span className="inline-flex items-center gap-1"><Check size={13} />You’re all square</span>,
    },
  ]

  const memberTotals = summary.byMember
    .map((item) => ({ ...item, member: byId(item.memberId) }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 md:gap-4">
        {cards.map((c, i) => (
          <motion.div key={c.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }}>
            <Link
              to={c.to}
              className={cn('group block h-full rounded-xl border border-line p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md', c.primary ? 'bg-fg text-bg border-fg hover:border-fg' : 'bg-surface')}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-[13px] font-medium', c.primary ? 'text-bg/65' : 'text-muted')}>{c.label}</span>
                <span className={cn('grid h-8 w-8 place-items-center rounded-md', c.primary ? 'bg-bg/10 text-bg' : 'bg-surface-2 text-muted')}><c.icon size={16} strokeWidth={1.75} aria-hidden /></span>
              </div>
              <AnimatedNumber value={c.value} format={c.format} className={cn('t-money-xl mt-4 block', !c.primary && c.tone)} />
              <p className={cn('t-small mt-2', c.primary ? 'text-bg/65' : 'text-muted')}>{c.sub}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Member-wise spending</h2>
            <p className="mt-1 text-xs text-muted">Who paid for household expenses this month</p>
          </div>
          <span className="text-xs text-muted">{members.length} members</span>
        </div>
        {memberTotals.length ? <div className="space-y-3">
          {memberTotals.map((item) => {
            const percent = summary.total ? (item.total / summary.total) * 100 : 0
            return <Link key={item.memberId} to={`${ROUTES.member(item.memberId)}?month=${month}`} className="block rounded-lg p-2 -mx-2 transition-colors hover:bg-surface-2">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium">{item.member.name}{item.memberId === userId ? <span className="ml-2 text-xs text-muted">(You)</span> : null}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{formatINR(item.total)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent-strong" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{item.count} {item.count === 1 ? 'expense' : 'expenses'} · {formatPercent(percent)} of household</p>
            </Link>
          })}
        </div> : <p className="text-sm text-muted">No member contributions recorded this month.</p>}
      </section>
    </div>
  )
}
