import { Bot, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { WhatsAppStatus } from '@/types'

function Bubble({ me, children }: { me?: boolean; children: React.ReactNode }) {
  return <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-snug ${me ? 'ml-auto bg-accent-soft text-fg' : 'bg-surface-2'}`}>{children}</div>
}

export function BotCard({ status, onLink }: { status: WhatsAppStatus; onLink: () => void }) {
  const chat = status.botNumber ? `https://wa.me/${status.botNumber}` : null
  return (
    <div className="flex h-full flex-col rounded-xl border border-line p-4">
      <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-md bg-surface-2"><Bot size={17} strokeWidth={1.75} /></span><h3 className="font-semibold">Message Roomly</h3></div>
      <p className="mt-3 text-sm text-muted">Chat with the Roomly number directly. Works anywhere, and there’s no group to manage.</p>
      <div className="my-4 space-y-1.5 rounded-lg border border-line p-3" aria-label="Example chat">
        <Bubble me>vegetables 150rs</Bubble>
        <Bubble>✅ Added ₹150 · Vegetables · Aman</Bubble>
        <Bubble me>balance</Bubble>
        <Bubble>You should receive ₹635 this month.</Bubble>
      </div>
      <div className="mt-auto">
        {status.me.linked
          ? chat ? <a href={chat} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-4 text-sm font-medium shadow-xs transition-colors hover:bg-surface-2"><ExternalLink size={15} />Open chat{status.botNumber ? ` · +${status.botNumber}` : ''}</a> : <p className="text-sm text-muted">Chat with the Roomly number from your linked phone.</p>
          : <Button onClick={onLink}>Link my number to start</Button>}
      </div>
    </div>
  )
}
