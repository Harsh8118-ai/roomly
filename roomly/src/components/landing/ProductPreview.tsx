import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Carrot, Milk, ShoppingBasket, Zap, type LucideIcon } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { formatINR, formatSigned } from '@/utils/format'
import { cn } from '@/utils/cn'

/** A self-contained, scripted mini-app: add an expense → total, balances and settlement all move. */
const PEOPLE = [
  { id: 'r', name: 'Rahul', tone: 1 }, { id: 'a', name: 'Aman', tone: 2 }, { id: 'v', name: 'Vikas', tone: 4 }, { id: 'k', name: 'Kunal', tone: 5 },
]
interface Step { title: string; amount: number; by: string; icon: LucideIcon }
const SCRIPT: Step[] = [
  { title: 'Vegetables', amount: 450, by: 'a', icon: Carrot },
  { title: 'Amul milk', amount: 130, by: 'v', icon: Milk },
  { title: 'Weekly groceries', amount: 1850, by: 'r', icon: ShoppingBasket },
  { title: 'Gas refill', amount: 1130, by: 'k', icon: Zap },
]
const BASE = { r: 3390, a: 3750, v: 4190, k: 3550 } as Record<string, number>

export function ProductPreview({ className }: { className?: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x + 1) % (SCRIPT.length + 1)), 2800)
    return () => clearInterval(t)
  }, [])

  const added = SCRIPT.slice(0, n)
  const paid = { ...BASE }
  added.forEach((s) => (paid[s.by] += s.amount))
  const total = Object.values(paid).reduce((a, b) => a + b, 0)
  const share = total / 4
  const rows = [...added].reverse()

  return (
    <div className={cn('relative', className)} aria-label="Product preview: adding an expense updates the household total and everyone's balance" role="img">
      <div className="card overflow-hidden shadow-lg">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <span className="text-sm font-medium">Casa 4 · October</span>
          <span className="flex -space-x-1.5">{PEOPLE.map((p) => <Avatar key={p.id} person={p} size="xs" ring />)}</span>
        </div>
        <div className="px-5 pb-5 pt-5">
          <p className="text-[13px] text-muted">Household spending</p>
          <AnimatedNumber value={total} format={formatINR} duration={0.7} className="t-money-xl mt-1 block !text-[2.25rem]" />

          <div className="mt-5 grid grid-cols-2 gap-2">
            {PEOPLE.map((p) => {
              const bal = paid[p.id] - share
              return (
                <div key={p.id} className="flex items-center gap-2.5 rounded-lg bg-surface-2/70 px-3 py-2.5">
                  <Avatar person={p} size="sm" />
                  <span className="flex-1 text-[13px] font-medium">{p.name}</span>
                  <AnimatedNumber value={bal} format={formatSigned} duration={0.7} className={cn('tnum text-[13px] font-semibold', bal > 0 ? 'text-success' : bal < 0 ? 'text-danger' : '')} />
                </div>
              )
            })}
          </div>

          <div className="mt-5 min-h-[7.25rem] space-y-1.5">
            <AnimatePresence initial={false} mode="popLayout">
              {rows.slice(0, 2).map((s, idx) => {
                const person = PEOPLE.find((p) => p.id === s.by)!
                return (
                  <motion.div key={s.title} layout initial={{ opacity: 0, y: -14, scale: 0.97 }} animate={{ opacity: 1 - idx * 0.15, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-2"><s.icon size={16} strokeWidth={1.75} /></span>
                    <span className="flex-1 text-sm"><span className="font-medium">{s.title}</span><span className="block text-xs text-muted">{person.name} · Just now</span></span>
                    <span className="tnum text-sm font-semibold">{formatINR(s.amount)}</span>
                  </motion.div>
                )
              })}
            </AnimatePresence>
            {rows.length === 0 && <p className="pt-9 text-center text-sm text-muted">Add an expense to see it ripple through.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
