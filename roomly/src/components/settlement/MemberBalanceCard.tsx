import { motion } from 'framer-motion'
import { Avatar } from '@/components/ui/Avatar'
import { Money } from '@/components/ui/Money'
import { formatINR } from '@/utils/format'
import { cn } from '@/utils/cn'
import type { Member, MemberSettlement } from '@/types'

export function MemberBalanceCard({ member, data, isMe, index = 0 }: { member: Member; data: MemberSettlement; isMe?: boolean; index?: number }) {
  const pct = data.share ? Math.min(100, (data.paid / data.share) * 100) : 0
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className={cn('card p-4 sm:p-5', isMe && 'ring-1 ring-accent/40')}>
      <div className="flex items-center gap-3">
        <Avatar person={member} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-tight">{member.name.split(' ')[0]}{isMe && <span className="ml-1.5 text-xs font-normal text-muted">you</span>}</p>
          <p className="t-small text-muted">{data.balance > 0 ? 'Should receive' : data.balance < 0 ? 'Owes' : 'Even'}</p>
        </div>
        <Money value={data.balance} signed className="text-xl font-semibold tracking-tight" />
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <motion.div className={cn('h-full rounded-full', data.balance >= 0 ? 'bg-success' : 'bg-danger/70')} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 100, damping: 22, delay: 0.1 + index * 0.05 }} />
      </div>
      <dl className="mt-3 flex justify-between text-sm">
        <div><dt className="t-micro text-muted">Paid</dt><dd className="tnum font-medium">{formatINR(data.paid)}</dd></div>
        <div className="text-right"><dt className="t-micro text-muted">Fair share</dt><dd className="tnum font-medium">{formatINR(data.share)}</dd></div>
      </dl>
    </motion.li>
  )
}
