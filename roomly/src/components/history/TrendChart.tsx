import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatDate, parseISODate } from '@/utils/date'
import { formatINR } from '@/utils/format'
import type { TrendPoint } from '@/types'

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const isMobile = !useMediaQuery('(min-width: 640px)')
  return (
    <Card className="p-5">
      <CardHeader title="Spending trend" subtitle="Daily spend across the month" />
      <div className="-mx-1 mt-5 h-52" role="img" aria-label="Bar chart of daily spending">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: isMobile ? -28 : -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="3 4" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} interval={isMobile ? 6 : 3} tickMargin={10} tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }}
              tickFormatter={(d: string) => parseISODate(d).getDate().toString()} />
            <YAxis tickLine={false} axisLine={false} width={isMobile ? 44 : 52} tickCount={4} tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }}
              tickFormatter={(v: number) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`)} />
            <Tooltip cursor={{ fill: 'rgb(var(--surface-2))' }} content={({ active, payload }) => active && payload?.length ? (
              <div className="rounded-lg border border-line bg-elevated px-3 py-2 shadow-md"><p className="t-micro text-muted">{formatDate((payload[0].payload as TrendPoint).date)}</p><p className="tnum text-sm font-semibold">{formatINR(Number(payload[0].value))}</p></div>
            ) : null} />
            <Bar dataKey="amount" fill="rgb(var(--accent))" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={600} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
