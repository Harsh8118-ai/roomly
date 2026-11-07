import { useEffect, useState } from 'react'
import { Ban, CheckCircle2, MessageSquareText, Send, TriangleAlert, Terminal } from 'lucide-react'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { Button } from '@/components/ui/Button'
import { Tabs } from '@/components/ui/Tabs'
import { CATEGORY_MAP } from '@/constants/categories'
import { useMembers } from '@/hooks/queries'
import { useSimulateWhatsApp, useWhatsAppPreview } from '@/hooks/whatsapp'
import type { WhatsAppContext } from '@/services/whatsappService'
import { cn } from '@/utils/cn'
import { formatINR } from '@/utils/format'
import type { WhatsAppPreview, WhatsAppStatus } from '@/types'

const EXAMPLES = ['vegetables 150rs', 'petrol 500', 'paid 450 for sabzi', 'come at 5 pm']
const REASONS: Record<string, string> = {
  question: 'It’s a question.', time: 'It looks like a time, not a price.', date: 'It looks like a date.', chatter: 'It reads like chat, not a purchase.',
  'no-amount': 'There’s no amount in it.', 'no-description': 'There’s an amount but no description.', 'ambiguous-amount': 'There’s more than one number.',
  'amount-out-of-range': 'That amount looks too big.', empty: 'It’s empty.', 'too-long': 'It’s too long to be an expense.', 'too-wordy': 'It’s too wordy to be an expense.',
}

function Result({ r, context }: { r: WhatsAppPreview; context: WhatsAppContext }) {
  if (r.kind === 'expense' && r.wouldRecord && r.category !== undefined) {
    const cat = r.category ?? 'other'
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success-soft p-3" role="status">
        <CategoryIcon category={cat} size="md" className="bg-surface" />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r.title}</p><p className="t-small text-muted">{CATEGORY_MAP[cat].label}{r.dayOffset === -1 ? ' · Yesterday' : ' · Today'}{r.category === null ? ' · couldn’t guess a category' : ''}</p></div>
        <div className="text-right"><p className="tnum text-base font-semibold">{formatINR(r.amount ?? 0)}</p><p className="t-micro flex items-center justify-end gap-1 text-success"><CheckCircle2 size={12} />Roomly adds this</p></div>
      </div>
    )
  }
  if (r.kind === 'expense') {
    return <p role="status" className="flex gap-2 rounded-lg bg-warning-soft p-3 text-[13px] text-warning"><TriangleAlert size={15} className="mt-0.5 shrink-0" />{context === 'group' ? 'In the group Roomly only records short, clear messages like “vegetables 150”, so chat doesn’t turn into expenses. Message the bot for longer sentences.' : 'Roomly isn’t sure about this one.'}</p>
  }
  if (r.kind === 'command') return <p role="status" className="flex gap-2 rounded-lg bg-info-soft p-3 text-[13px] text-info"><MessageSquareText size={15} className="mt-0.5 shrink-0" />Roomly understands this as the “{r.command}” command.</p>
  return <p role="status" className="flex gap-2 rounded-lg bg-surface-2 p-3 text-[13px] text-muted"><Ban size={15} className="mt-0.5 shrink-0" />Roomly would ignore this. {REASONS[r.reason ?? ''] ?? 'It doesn’t look like an expense.'}</p>
}

/** Type a message the way you would in WhatsApp and see exactly what Roomly would do with it. */
export function MessagePlayground({ status }: { status: WhatsAppStatus }) {
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [context, setContext] = useState<WhatsAppContext>('dm')
  const [sender, setSender] = useState('')
  const [replies, setReplies] = useState<string[] | null>(null)
  const { members } = useMembers()
  const preview = useWhatsAppPreview(debounced, context)
  const simulate = useSimulateWhatsApp()

  useEffect(() => { const t = setTimeout(() => setDebounced(text), 250); return () => clearTimeout(t) }, [text])
  useEffect(() => { if (!sender && members[0]) setSender(members[0].id) }, [members, sender])
  useEffect(() => setReplies(null), [text, context])

  const send = () => simulate.mutate({ as: sender, text, context }, { onSuccess: (d) => setReplies(d.replies) })

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Try it</h3>
        <Tabs size="sm" label="Where would you send it?" value={context} onChange={setContext} tabs={[{ value: 'dm', label: 'Message the bot' }, { value: 'group', label: 'In the group' }]} />
      </div>
      <label htmlFor="wa-try" className="sr-only">Message to test</label>
      <input id="wa-try" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Type what you’d send, e.g. vegetables 150rs"
        className="h-11 w-full rounded-md border border-line bg-surface px-3.5 text-[15px] placeholder:text-subtle hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => <button key={ex} type="button" onClick={() => setText(ex)} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-fg">{ex}</button>)}
      </div>
      <div className="mt-3 min-h-[3.5rem]" aria-live="polite">
        {debounced.trim() && preview.data && <Result r={preview.data} context={context} />}
        {!debounced.trim() && <p className="t-small text-muted">Roomly reads short messages like “milk 60” or “gas refill rs.1130”. Anything else is ignored.</p>}
      </div>

      {status.simulator && (
        <div className="mt-4 rounded-lg border border-dashed border-line-strong p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><Terminal size={13} />Development only — send it for real, as…</p>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Send as" value={sender} onChange={(e) => setSender(e.target.value)} className="h-9 rounded-md border border-line bg-surface px-2.5 text-sm">
              {members.map((m) => <option key={m.id} value={m.id}>{m.name.split(' ')[0]}</option>)}
            </select>
            <Button size="md" variant="secondary" disabled={!text.trim()} loading={simulate.isPending} loadingText="Sending…" leftIcon={<Send size={14} />} onClick={send}>Send</Button>
          </div>
          {replies && (
            <div className={cn('mt-3 space-y-1.5')} aria-live="polite">
              {replies.length === 0 ? <p className="t-small text-muted">No reply — Roomly stayed quiet (nothing to add, or confirmations are off).</p>
                : replies.map((r, i) => <div key={i} className="max-w-[85%] whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-[13px]">{r}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
