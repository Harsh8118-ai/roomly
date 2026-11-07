import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { currentMonth, monthLabel, shiftMonth } from '@/utils/date'
import type { MonthKey } from '@/types'

export function MonthSelector({ month, onChange, min }: { month: MonthKey; onChange: (m: MonthKey) => void; min?: MonthKey }) {
  const atMax = month >= currentMonth()
  const atMin = !!min && month <= min
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-line bg-surface p-0.5" role="group" aria-label="Month">
      <IconButton label="Previous month" size="sm" onClick={() => onChange(shiftMonth(month, -1))} disabled={atMin}><ChevronLeft size={16} /></IconButton>
      <div className="relative h-8 w-[8.5rem] overflow-hidden text-center" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={month} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}
            className="absolute inset-0 flex items-center justify-center text-sm font-medium">{monthLabel(month)}</motion.span>
        </AnimatePresence>
      </div>
      <IconButton label="Next month" size="sm" onClick={() => onChange(shiftMonth(month, 1))} disabled={atMax}><ChevronRight size={16} /></IconButton>
    </div>
  )
}
