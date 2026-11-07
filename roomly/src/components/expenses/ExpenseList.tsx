import { motion } from 'framer-motion'
import { useAuth } from '@/store/AuthProvider'
import { useMembers } from '@/hooks/queries'
import { formatDate } from '@/utils/date'
import { Money } from '@/components/ui/Money'
import { sum } from '@/utils/format'
import type { Expense } from '@/types'
import { ExpenseRow } from './ExpenseRow'

export function ExpenseList({ expenses, grouped }: { expenses: Expense[]; grouped?: boolean }) {
  const { user } = useAuth()
  const { byId } = useMembers()

  if (!grouped) {
    return (
      <div className="card divide-y divide-line overflow-hidden">
        {expenses.map((e, i) => (
          <motion.div key={e.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.25 }}>
            <ExpenseRow expense={e} payer={byId(e.paidBy)} isMe={e.paidBy === user?.id} />
          </motion.div>
        ))}
      </div>
    )
  }

  const groups = expenses.reduce<{ date: string; items: Expense[] }[]>((acc, e) => {
    const last = acc[acc.length - 1]
    if (last?.date === e.date) last.items.push(e); else acc.push({ date: e.date, items: [e] })
    return acc
  }, [])

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.date} aria-label={formatDate(g.date)}>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="text-[13px] font-medium text-muted">{formatDate(g.date)}</h3>
            <Money value={sum(g.items.map((i) => i.amount))} className="text-[13px] text-muted" />
          </div>
          <div className="card divide-y divide-line overflow-hidden">
            {g.items.map((e) => <ExpenseRow key={e.id} expense={e} payer={byId(e.paidBy)} isMe={e.paidBy === user?.id} hideDate />)}
          </div>
        </section>
      ))}
    </div>
  )
}
