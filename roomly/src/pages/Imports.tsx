import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileUp, Check, X, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useMembers } from '@/hooks/queries'
import { api } from '@/services/api/client'
import { useAuth } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'
import { CATEGORY_MAP } from '@/constants/categories'
import type { CategoryId } from '@/types'

type Candidate = {
  id: string; sender: string; senderMemberId: string | null; sentAt: string; text: string;
  parsed: { amount: number; title: string; category: CategoryId | null; confidence: 'high' | 'medium'; dayOffset: number };
  status: string;
}
type ImportResponse = {
  import: { id: string; filename: string; stats: { total: number; newMessages: number; duplicates: number; candidates: number; ignored: number } };
  messages: Candidate[];
}

export function ImportsPage() {
  const { user } = useAuth()
  const { members } = useMembers()
  const toast = useToast()
  const qc = useQueryClient()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [importId, setImportId] = useState('')
  const [filename, setFilename] = useState('')
  const [busy, setBusy] = useState(false)
  const isAdmin = members.some((member) => member.id === user?.id && member.role === 'admin')

  const upload = async (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.txt')) { toast.error('Choose a WhatsApp .txt export.'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('The maximum export size is 10 MB.'); return }
    setBusy(true)
    try {
      const content = await file.text()
      const result = await api.post<ImportResponse>('/imports/whatsapp', { filename: file.name, content })
      setCandidates(result.messages)
      setImportId(result.import.id)
      setFilename(result.import.filename)
      toast.success(`Import scanned: ${result.import.stats.newMessages} new messages, ${result.import.stats.duplicates} duplicates skipped.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import this chat.')
    } finally { setBusy(false) }
  }

  const decide = async (candidate: Candidate, action: 'approve' | 'reject') => {
    const paidBy = candidate.senderMemberId || ''
    if (action === 'approve' && !paidBy) { toast.error(`Map ${candidate.sender} to a Roomly member before approving.`); return }
    try {
      await api.post(`/imports/${importId}/review`, { decisions: [{
        messageId: candidate.id, action, paidBy,
        amount: candidate.parsed.amount, title: candidate.parsed.title,
        category: candidate.parsed.category || 'other',
      }] })
      setCandidates((items) => items.filter((item) => item.id !== candidate.id))
      await qc.invalidateQueries({ queryKey: ['hh'] })
      toast.success(action === 'approve' ? 'Expense added to Roomly.' : 'Message rejected.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update this message.') }
  }

  const mapSender = (id: string, memberId: string) => setCandidates((items) => items.map((item) => item.id === id ? { ...item, senderMemberId: memberId } : item))

  return <>
    <PageHeader title="Import WhatsApp chat" description="Upload a group export. Roomly skips messages it has already seen and queues expense candidates for your approval." />
    {!isAdmin ? <div className="card p-5 text-sm text-muted">Only the household admin can import chat exports.</div> : <>
      <section className="card mb-6 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong"><FileUp size={20} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Upload WhatsApp .txt export</h2>
            <p className="mt-1 text-sm text-muted">Export the chat without media from WhatsApp, then upload the .txt file here. You can upload the full chat again later; duplicate messages will be skipped.</p>
            <label className="mt-4 inline-flex cursor-pointer">
              <input type="file" accept=".txt,text/plain" className="sr-only" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} />
              <span className="inline-flex h-10 items-center gap-2 rounded-md bg-accent-strong px-4 text-sm font-semibold text-on-accent">{busy ? <RefreshCw size={16} className="animate-spin" /> : <FileUp size={16} />}{busy ? 'Processing…' : 'Choose chat export'}</span>
            </label>
            <p className="mt-2 text-xs text-muted">TXT files only · Maximum 10 MB · Expense messages are retained for review; non-expense message text is not stored.</p>
          </div>
        </div>
      </section>
      {importId && <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-semibold">Review detected expenses</h2><p className="text-xs text-muted">{filename} · {candidates.length} pending</p></div>
          <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-medium text-warning">{candidates.length} need approval</span>
        </div>
        {candidates.length === 0 ? <p className="py-8 text-center text-sm text-muted">No pending messages. Your import review is complete.</p> : <div className="divide-y divide-line">
          {candidates.map((item) => <article key={item.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-medium">{item.parsed.title}</p><p className="mt-0.5 text-xs text-muted">{item.sender} · {new Date(item.sentAt).toLocaleString()}</p></div>
              <p className="tnum text-lg font-semibold">₹{item.parsed.amount.toLocaleString('en-IN')}</p>
            </div>
            <p className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-sm text-muted">{item.text}</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="min-w-[190px] flex-1 text-xs text-muted">Paid by
                <select value={item.senderMemberId || ''} onChange={(e) => mapSender(item.id, e.target.value)} className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg">
                  <option value="">Select member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </label>
              <span className="mb-2 text-xs text-muted">{item.parsed.category ? CATEGORY_MAP[item.parsed.category]?.label : 'Other'} · {item.parsed.confidence} confidence</span>
              <Button size="sm" variant="secondary" onClick={() => void decide(item, 'reject')} leftIcon={<X size={14} />}>Reject</Button>
              <Button size="sm" onClick={() => void decide(item, 'approve')} disabled={!item.senderMemberId} leftIcon={<Check size={14} />}>Approve</Button>
            </div>
          </article>)}
        </div>}
      </section>}
    </>}
  </>
}
