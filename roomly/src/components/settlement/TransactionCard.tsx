import { AnimatePresence, motion } from 'framer-motion'
import { Check, Clock } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatINR } from '@/utils/format'
import { formatTimestamp } from '@/utils/date'
import { cn } from '@/utils/cn'
import type { Member, SettlementTransaction } from '@/types'

interface Props {
  tx: SettlementTransaction
  from: Member
  to: Member
  canMark: boolean
  marking?: boolean
  onMark: () => void
  youAreFrom?: boolean
  youAreTo?: boolean
}

/** One payment, drawn as a line of money flowing from the person who owes to the person who's owed. */
export function TransactionCard({ tx, from, to, canMark, marking, onMark, youAreFrom, youAreTo }: Props) {
  const settled = tx.status === 'settled'
  const name = (m: Member, you?: boolean) => (you ? 'You' : m.name.split(' ')[0])
  return (
    <motion.li layout className={cn('card overflow-hidden p-4 transition-colors sm:p-5', settled && 'bg-surface-2/50')}>
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-20">
          <Avatar person={from} size="lg" />
          <span className="max-w-full truncate text-[13px] font-medium">{name(from, youAreFrom)}</span>
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col items-center">
          <motion.span key={tx.amount} initial={{ scale: 0.9 }} animate={{ scale: 1 }}
            className={cn('tnum z-10 rounded-full border px-3 py-1 text-sm font-semibold', settled ? 'border-success/30 bg-success-soft text-success' : 'border-line-strong bg-surface')}>
            {formatINR(tx.amount)}
          </motion.span>
          <div className="relative mt-2 h-px w-full bg-line-strong" aria-hidden>
            {!settled && (
              <motion.span className="absolute -top-[2px] h-[5px] w-[5px] rounded-full bg-accent-strong" initial={{ left: '0%' }} animate={{ left: '100%' }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }} />
            )}
            <span className="absolute -right-px -top-[3.5px] h-2 w-2 rotate-45 border-r border-t border-line-strong" />
          </div>
        </div>

        <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-20">
          <Avatar person={to} size="lg" />
          <span className="max-w-full truncate text-[13px] font-medium">{name(to, youAreTo)}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
        <AnimatePresence mode="wait" initial={false}>
          {settled ? (
            <motion.div key="s" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm">
              <Badge tone="success"><Check size={12} />Settled</Badge>
              {tx.settledAt && <span className="t-small text-muted">{formatTimestamp(tx.settledAt)}</span>}
            </motion.div>
          ) : (
            <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Badge tone="warning"><Clock size={12} />Pending</Badge></motion.div>
          )}
        </AnimatePresence>
        {!settled && (canMark
          ? <Button size="sm" variant="secondary" onClick={onMark} loading={marking} loadingText="Saving…" leftIcon={<Check size={14} />}>Mark as paid</Button>
          : <span className="t-small text-muted">Waiting on {name(from)}</span>)}
      </div>
    </motion.li>
  )
}
