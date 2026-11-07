import { Link } from 'react-router-dom'
import { ArrowRight, PartyPopper, Scale } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Button } from '@/components/ui/Button'
import { useMembers } from '@/hooks/queries'
import { formatINR } from '@/utils/format'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/utils/cn'
import type { Settlement } from '@/types'

/** The most important card: your standing, and exactly why. */
export function SettlementCard({ settlement, userId, loading }: { settlement?: Settlement; userId: string; loading?: boolean }) {
  const { byId } = useMembers()

  if (loading || !settlement) {
    return <div className="card space-y-4 p-6"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-10 w-1/2" /><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>
  }

  const mine = settlement.members.find((m) => m.memberId === userId)
  const balance = mine?.balance ?? 0
  const myTx = settlement.transactions.filter((t) => (t.from === userId || t.to === userId) && t.status === 'pending')
  const allSettled = settlement.status === 'settled'
  const state = allSettled || (balance === 0) ? 'settled' : balance > 0 ? 'receive' : 'owe'

  const theme = {
    receive: { box: 'border-success/25 bg-success-soft', chip: 'bg-success/15 text-success', amount: 'text-success' },
    owe: { box: 'border-danger/25 bg-danger-soft', chip: 'bg-danger/15 text-danger', amount: 'text-danger' },
    settled: { box: 'border-accent/25 bg-accent-soft', chip: 'bg-accent/20 text-accent-strong', amount: 'text-fg' },
  }[state]

  const headline = state === 'receive' ? 'You should receive' : state === 'owe' ? 'You owe' : allSettled ? 'All settled' : 'You’re all square'

  return (
    <div className={cn('rounded-xl border p-5 sm:p-6', theme.box)}>
      <div className="flex items-center gap-2.5">
        <span className={cn('grid h-8 w-8 place-items-center rounded-md', theme.chip)}>{state === 'settled' ? <PartyPopper size={16} /> : <Scale size={16} />}</span>
        <span className="text-[13px] font-medium text-muted">Settlement</span>
      </div>
      <p className="mt-5 text-sm text-muted">{headline}</p>
      <AnimatedNumber value={Math.abs(balance)} format={formatINR} className={cn('t-money-xl mt-1 block', theme.amount)} />

      <ul className="mt-5 space-y-1.5 text-sm">
        {state === 'settled' && <li className="text-muted">{allSettled ? 'Everyone’s squared up for this month.' : 'You’re even — nothing to pay or collect.'}</li>}
        {myTx.map((t) => {
          const incoming = t.to === userId
          const other = byId(incoming ? t.from : t.to)
          return (
            <li key={t.id} className="flex items-center justify-between gap-3">
              <span><strong className="font-medium">{other.name.split(' ')[0]}</strong> {incoming ? 'owes you' : 'is owed by you'}</span>
              <span className="tnum font-semibold">{formatINR(t.amount)}</span>
            </li>
          )
        })}
        {state !== 'settled' && myTx.length === 0 && <li className="text-muted">Waiting on payments between other housemates.</li>}
      </ul>
      <Link to={ROUTES.settlement} className="mt-6 block">
        <Button variant={state === 'settled' ? 'secondary' : 'dark'} fullWidth rightIcon={<ArrowRight size={16} />} tabIndex={-1}>View settlement</Button>
      </Link>
    </div>
  )
}
