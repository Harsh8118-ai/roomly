import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { SkeletonChart } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/EmptyState'
import { useExpenses } from '@/hooks/queries'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { addDays, currentMonth, formatDate, parseISODate, todayISO } from '@/utils/date'
import { formatINR, sum } from '@/utils/format'

type Range = '7d' | '30d' | 'month'
const TABS: { value: Range; label: string }[] = [{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'month', label: 'Month' }]

interface Point { date: string; amount: number; running: number }

function ChartTooltip({ active, payload, cumulative }: { active?: boolean; payload?: { payload: Point }[]; cumulative: boolean }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-elevated px-3 py-2 shadow-md">
      <p className="t-micro text-muted">{formatDate(p.date)}</p>
      <p className="tnum text-sm font-semibold">{formatINR(cumulative ? p.running : p.amount)}</p>
      {cumulative && <p className="t-micro tnum text-muted">{formatINR(p.amount)} that day</p>}
    </div>
  )
}

export function SpendingChart() {
  const [range, setRange] = useState<Range>('30d')
  const isMobile = !useMediaQuery('(min-width: 640px)')
  const today = todayISO()
  const from = range === '7d' ? addDays(today, -6) : range === '30d' ? addDays(today, -29) : `${currentMonth()}-01`
  const { data, isPending, isError, refetch } = useExpenses({ from, to: today })

  const cumulative = range === 'month'
  const points = useMemo<Point[]>(() => {
    if (!data) return []
    const days = Math.round((parseISODate(today).getTime() - parseISODate(from).getTime()) / 86_400_000) + 1
    let running = 0
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i)
      const amount = sum(data.filter((e) => e.date === date).map((e) => e.amount))
      running += amount
      return { date, amount, running }
    })
  }, [data, from, today])

  const total = sum(points.map((p) => p.amount))
  const tickEvery = isMobile ? (range === '7d' ? 2 : 9) : range === '7d' ? 1 : range === '30d' ? 4 : 3

  return (
    <Card className="p-5">
      <CardHeader
        title="Spending over time"
        subtitle={isPending ? ' ' : `${formatINR(total)} ${cumulative ? 'so far this month' : `in the last ${range === '7d' ? '7' : '30'} days`}`}
        action={<Tabs tabs={TABS} value={range} onChange={setRange} label="Time range" size="sm" />}
      />
      <div className="-mx-1 mt-5 h-52 sm:h-60" role="img" aria-label="Area chart of household spending over time">
        {isError ? <ErrorState title="Couldn’t load the chart" onRetry={refetch} className="border-0" />
          : isPending ? <SkeletonChart className="border-0 p-0" /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, left: isMobile ? -28 : -12, bottom: 0 }}>
              <defs>
                <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="3 4" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} interval={tickEvery - 1} tickMargin={10} tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }}
                tickFormatter={(d: string) => parseISODate(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} />
              <YAxis tickLine={false} axisLine={false} width={isMobile ? 44 : 52} tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }}
                tickFormatter={(v: number) => (v >= 1000 ? `₹${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `₹${v}`)} tickCount={isMobile ? 4 : 5} />
              <Tooltip cursor={{ stroke: 'rgb(var(--line-strong))', strokeWidth: 1 }} content={<ChartTooltip cumulative={cumulative} />} />
              <Area type={cumulative ? 'monotone' : 'monotone'} dataKey={cumulative ? 'running' : 'amount'} stroke="rgb(var(--accent-strong))" strokeWidth={2}
                fill="url(#spendFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: 'rgb(var(--surface))', fill: 'rgb(var(--accent-strong))' }} animationDuration={700} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
