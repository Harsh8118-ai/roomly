import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

export function ProgressBar({ value, max = 100, className, color = 'rgb(var(--accent))', label }: { value: number; max?: number; className?: string; color?: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 24 }} />
    </div>
  )
}
