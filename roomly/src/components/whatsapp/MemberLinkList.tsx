import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { useMembers } from '@/hooks/queries'
import type { WhatsAppStatus } from '@/types'

export function MemberLinkList({ status, userId }: { status: WhatsAppStatus; userId: string }) {
  const { byId } = useMembers()
  const linked = status.members.filter((m) => m.linked).length
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between"><h3 className="text-sm font-semibold">Who can text expenses</h3><span className="t-small tnum text-muted">{linked} of {status.members.length} linked</span></div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {status.members.map((m) => {
          const person = byId(m.memberId)
          return (
            <li key={m.memberId} className="flex items-center gap-3 px-3.5 py-2.5">
              <Avatar person={person} size="sm" />
              <span className="flex-1 text-sm font-medium">{person.name}{m.memberId === userId && <span className="ml-1.5 text-xs font-normal text-muted">you</span>}</span>
              {m.linked ? <Badge tone="success" dot>Linked</Badge> : <Badge>Not linked</Badge>}
            </li>
          )
        })}
      </ul>
      {linked < status.members.length && <p className="t-small mt-2 text-muted">Each person links their own number in their Settings, so Roomly knows who paid.</p>}
    </div>
  )
}
