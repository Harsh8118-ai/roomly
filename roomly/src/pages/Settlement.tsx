import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Receipt, Sparkles } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthSelector } from '@/components/common/MonthSelector'
import { AllSettled } from '@/components/settlement/AllSettled'
import { MemberBalanceCard } from '@/components/settlement/MemberBalanceCard'
import { TransactionCard } from '@/components/settlement/TransactionCard'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { ROUTES } from '@/constants/routes'
import { useMembers, usePayTransaction, useSettlement } from '@/hooks/queries'
import { useAuth } from '@/store/AuthProvider'
import { useComposer } from '@/store/ComposerProvider'
import { currentMonth, monthLabel } from '@/utils/date'
import { formatINR, pluralize } from '@/utils/format'

export function SettlementPage() {
  const [month, setMonth] = useState(currentMonth())
  const { user } = useAuth()
  const { byId, members } = useMembers()
  const { openNew } = useComposer()
  const { data: s, isPending, isError, refetch } = useSettlement(month)
  const pay = usePayTransaction(month)
  const [payingId, setPayingId] = useState<string | null>(null)
  const isAdmin = members.find((m) => m.id === user?.id)?.role === 'admin'

  const header = (
    <PageHeader title="Settlement" description={`${monthLabel(month)} · Who owes whom`}
      actions={<><MonthSelector month={month} onChange={setMonth} />
        <Link to={ROUTES.report(month)} className="text-[13px] font-medium text-accent-strong hover:underline">Full report</Link></>} />
  )

  if (isError) return <>{header}<ErrorState description="We couldn’t load the settlement." onRetry={refetch} /></>
  if (isPending) return <>{header}<div className="space-y-4"><SkeletonCard lines={3} /><div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div></div></>
  if (s.status === 'empty') {
    return <>{header}<Card><EmptyState icon={Receipt} title="Nothing to settle yet." description={`No expenses were recorded in ${monthLabel(month)}. Add one and the math happens automatically.`}
      action={month === currentMonth() ? <Button onClick={openNew}>Add expense</Button> : undefined} /></Card></>
  }

  const pending = s.transactions.filter((t) => t.status === 'pending')
  const settledCount = s.transactions.length - pending.length

  return (
    <>
      {header}
      <Card variant="primary" className="mb-6 grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:p-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <p className="text-[13px] text-muted">Household total</p>
          <AnimatedNumber value={s.total} format={formatINR} className="t-money-xl mt-1 block !text-[2.5rem]" />
        </div>
        <div><p className="text-[13px] text-muted">Fair share</p><p className="tnum mt-1 text-xl font-semibold">{formatINR(s.fairShare)}<span className="ml-1 text-sm font-normal text-muted">/person</span></p></div>
        <div>
          <p className="text-[13px] text-muted">Status</p>
          <div className="mt-1.5">{s.status === 'settled' ? <Badge tone="success" dot>Settled</Badge> : <Badge tone="warning" dot>{pluralize(pending.length, 'payment')} pending</Badge>}</div>
        </div>
      </Card>

      {s.status === 'settled' && (
        <div className="mb-8"><AllSettled month={month} total={s.total} members={s.members.length} expenses={s.expenseCount} /></div>
      )}

      <section aria-labelledby="bal-h">
        <h2 id="bal-h" className="t-section mb-3">Each person’s balance</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {s.members.map((m, i) => <MemberBalanceCard key={m.memberId} member={byId(m.memberId)} data={m} isMe={m.memberId === user?.id} index={i} />)}
        </ul>
      </section>

      {s.transactions.length > 0 && (
        <section aria-labelledby="tx-h" className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="tx-h" className="t-section">Who pays whom</h2>
            <span className="t-small text-muted">{settledCount} of {s.transactions.length} paid · fewest possible payments</span>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            <AnimatePresence initial={false}>
              {s.transactions.map((t) => (
                <TransactionCard key={t.id} tx={t} from={byId(t.from)} to={byId(t.to)} youAreFrom={t.from === user?.id} youAreTo={t.to === user?.id}
                  canMark={t.from === user?.id || t.to === user?.id || !!isAdmin} marking={pay.isPending && payingId === t.id}
                  onMark={() => { setPayingId(t.id); pay.mutate(t.id) }} />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {s.transactions.length === 0 && s.status !== 'settled' && (
        <Card variant="insight" className="mt-8 flex items-center gap-3 p-5"><Sparkles size={18} className="text-accent-strong" /><p className="text-sm">Everyone paid exactly their share. No payments needed.</p></Card>
      )}
    </>
  )
}
