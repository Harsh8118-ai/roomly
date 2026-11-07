import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { formatINR, pluralize } from '@/utils/format'
import { monthLabel } from '@/utils/date'
import type { MonthKey } from '@/types'

const COLORS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5']

/** Quiet celebration: a check that springs in plus a one-shot burst of confetti. */
export function AllSettled({ month, total, members, expenses }: { month: MonthKey; total: number; members: number; expenses: number }) {
  const pieces = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    id: i, x: (Math.random() - 0.5) * 340, y: -60 - Math.random() * 90, r: Math.random() * 540 - 270,
    c: COLORS[i % COLORS.length], w: 5 + Math.random() * 5, d: 0.9 + Math.random() * 0.7, delay: Math.random() * 0.15,
  })), [])
  const name = monthLabel(month, { year: false })

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden px-6 py-12 text-center" aria-live="polite">
      <div className="pointer-events-none absolute left-1/2 top-24" aria-hidden>
        {pieces.map((p) => (
          <motion.span key={p.id} className="absolute rounded-[2px]" style={{ width: p.w, height: p.w * 1.6, background: `rgb(var(${p.c}))` }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
            animate={{ x: p.x, y: [0, p.y, 220], opacity: [1, 1, 0], rotate: p.r, scale: 1 }} transition={{ duration: p.d + 0.9, delay: p.delay, ease: 'easeOut', times: [0, 0.35, 1] }} />
        ))}
      </div>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-strong text-on-accent"><Check size={32} strokeWidth={2.5} /></motion.div>
      <h2 className="t-large mt-6">All settled.</h2>
      <p className="mt-2 text-muted">{name} is officially squared up.</p>
      <p className="tnum mt-6 text-lg font-semibold">{formatINR(total)} <span className="font-normal text-muted">spent together</span></p>
      <p className="t-small mt-1 text-muted">{pluralize(members, 'member')} · {pluralize(expenses, 'expense')}</p>
    </motion.section>
  )
}
