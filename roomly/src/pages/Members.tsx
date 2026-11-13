import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MemberCard } from '@/components/members/MemberCard'
import { MonthSelector } from '@/components/common/MonthSelector'
import { InviteDialog } from '@/components/members/InviteDialog'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMembers, useSettlement, useSummary } from '@/hooks/queries'
import { useAuth } from '@/store/AuthProvider'
import { currentMonth, monthLabel } from '@/utils/date'

export function MembersPage() {
  const [month, setMonth] = useState(currentMonth())
  const { user } = useAuth()
  const { members, isPending, isError, refetch } = useMembers()
  const summary = useSummary(month)
  const settlement = useSettlement(month)
  const [invite, setInvite] = useState(false)

  return (
    <>
      <PageHeader title="Group" description={`${members.length || ''} people sharing the home · ${monthLabel(month)}`}
        actions={<><MonthSelector month={month} onChange={setMonth} /><Button variant="secondary" leftIcon={<UserPlus size={16} />} onClick={() => setInvite(true)}>Invite</Button></>} />
      {isError ? <ErrorState description="We couldn’t load your housemates." onRetry={refetch} />
        : isPending || summary.isPending || settlement.isPending
          ? <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>
          : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {members.map((m, i) => {
                const t = summary.data?.byMember.find((x) => x.memberId === m.id)
                const b = settlement.data?.members.find((x) => x.memberId === m.id)
                return <MemberCard key={m.id} member={m} contribution={t?.total ?? 0} count={t?.count ?? 0} balance={b?.balance ?? 0} isMe={m.id === user?.id} index={i} />
              })}
            </ul>
          )}
      <InviteDialog open={invite} onClose={() => setInvite(false)} />
    </>
  )
}
