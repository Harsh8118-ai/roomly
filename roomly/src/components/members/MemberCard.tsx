import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Crown } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Money } from '@/components/ui/Money'
import { ROUTES } from '@/constants/routes'
import { formatINR, pluralize } from '@/utils/format'
import type { Member } from '@/types'

interface Props { member: Member; contribution: number; count: number; balance: number; isMe?: boolean; index?: number }

export function MemberCard({ member, contribution, count, balance, isMe, index = 0 }: Props) {
  return (
    <motion.li initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Link to={ROUTES.member(member.id)} className="card card-hover block p-5">
        <div className="flex items-start gap-4">
          <Avatar person={member} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="truncate text-base font-semibold">{member.name}</h3>
              {isMe && <span className="text-xs text-muted">you</span>}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {member.role === 'admin' ? <Badge tone="accent"><Crown size={11} />Admin</Badge> : <Badge>Member</Badge>}
              {member.status === 'invited' && <Badge tone="warning">Invited</Badge>}
            </div>
          </div>
          <div className="text-right">
            <p className="t-micro text-muted">Balance</p>
            <Money value={balance} signed className="text-lg font-semibold" />
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
          <div><dt className="t-micro text-muted">This month</dt><dd className="tnum mt-0.5 text-[15px] font-semibold">{formatINR(contribution)}</dd></div>
          <div><dt className="t-micro text-muted">Purchases</dt><dd className="mt-0.5 text-[15px] font-semibold">{pluralize(count, 'expense')}</dd></div>
        </dl>
      </Link>
    </motion.li>
  )
}
