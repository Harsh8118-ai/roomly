import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileUp, Check, X, RefreshCw, History, FileArchive } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useMembers } from '@/hooks/queries'
import { api } from '@/services/api/client'
import { useAuth } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'
import { CATEGORY_MAP } from '@/constants/categories'
import type { CategoryId } from '@/types'

type ImportStats = { total: number; newMessages: number; duplicates: number; candidates: number; ignored: number; approved?: number; rejected?: number }
type ImportRecord = { id: string; filename: string; status: 'review' | 'completed'; stats: ImportStats; createdAt: string }
type Candidate = {
  id: string; sender: string; senderMemberId: string | null; sentAt: string; text: string;
  parsed: { amount: number; title: string; category: CategoryId | null; confidence: 'high' | 'medium'; dayOffset: number };
  status: string;
}
type ImportResponse = {
  import: { id: string; filename: string; stats: ImportStats };
  messages: Candidate[];
}

async function readZipChat(file: File): Promise<{ filename: string; content: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('This ZIP archive is invalid or unsupported.')
  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  const candidates: { name: string; method: number; compressed: number; uncompressed: number; local: number }[] = []
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Could not read the ZIP file directory.')
    const method = view.getUint16(offset + 10, true)
    const compressed = view.getUint32(offset + 20, true)
    const uncompressed = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const local = view.getUint32(offset + 42, true)
    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength))
    if (/\.(txt|md)$/i.test(name) && !name.endsWith('/')) candidates.push({ name, method, compressed, uncompressed, local })
    offset += 46 + nameLength + extraLength + commentLength
  }
  const chosen = candidates.sort((a, b) => Number(/\.txt$/i.test(b.name)) - Number(/\.txt$/i.test(a.name)))[0]
  if (!chosen) throw new Error('No .txt or .md chat file was found inside this ZIP.')
  if (chosen.uncompressed > 10 * 1024 * 1024) throw new Error('The extracted chat exceeds the 10 MB limit.')
  const localOffset = chosen.local
  if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Could not read the chat file inside this ZIP.')
  const nameLength = view.getUint16(localOffset + 26, true)
  const extraLength = view.getUint16(localOffset + 28, true)
  const start = localOffset + 30 + nameLength + extraLength
  const compressedData = bytes.slice(start, start + chosen.compressed)
  let output: Uint8Array
  if (chosen.method === 0) output = compressedData
  else if (chosen.method === 8) {
    const stream = new Blob([compressedData]).stream().pipeThrough(new DecompressionStream('deflate-raw' as CompressionFormat))
    output = new Uint8Array(await new Response(stream).arrayBuffer())
  } else throw new Error('This ZIP uses an unsupported compression method.')
  return { filename: chosen.name.split('/').pop() || file.name, content: new TextDecoder('utf-8').decode(output) }
}

async function readChatFile(file: File) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.zip')) return readZipChat(file)
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type === 'text/plain' || file.type === 'text/markdown') {
    return { filename: file.name, content: await file.text() }
  }
  throw new Error('Choose a .txt, .md or .zip chat export.')
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
  const [history, setHistory] = useState<ImportRecord[]>([])
  const isAdmin = members.some((member) => member.id === user?.id && member.role === 'admin')

  const refreshHistory = async () => {
    try { setHistory(await api.get<ImportRecord[]>('/imports')) }
    catch { /* Keep the import screen usable if history cannot be loaded. */ }
  }
  useEffect(() => { void refreshHistory() }, [])

  const upload = async (file?: File) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('The maximum upload size is 10 MB.'); return }
    setBusy(true)
    try {
      const chat = await readChatFile(file)
      if (!chat.content.trim()) throw new Error('The selected chat file is empty.')
      const result = await api.post<ImportResponse>('/imports/whatsapp', { filename: chat.filename, content: chat.content })
      setCandidates(result.messages)
      setImportId(result.import.id)
      setFilename(result.import.filename)
      await refreshHistory()
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
      await refreshHistory()
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
            <h2 className="font-semibold">Upload WhatsApp export</h2>
            <p className="mt-1 text-sm text-muted">Upload a WhatsApp .txt or .md export, or a .zip containing one of these chat files. Expense lines are extracted individually, even when several are written in one message.</p>
            <label className="mt-4 inline-flex cursor-pointer">
              <input type="file" accept=".txt,.md,.zip,text/plain,text/markdown,application/zip" className="sr-only" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} />
              <span className="inline-flex h-10 items-center gap-2 rounded-md bg-accent-strong px-4 text-sm font-semibold text-on-accent">{busy ? <RefreshCw size={16} className="animate-spin" /> : <FileArchive size={16} />}{busy ? 'Processing…' : 'Choose chat file'}</span>
            </label>
            <p className="mt-2 text-xs text-muted">TXT · Markdown · ZIP containing TXT/Markdown · Maximum 10 MB</p>
          </div>
        </div>
      </section>
      {importId && <section className="card mb-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="font-semibold">Review detected expenses</h2><p className="text-xs text-muted">{filename} · {candidates.length} pending</p></div>
          <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-medium text-warning">{candidates.length} need approval</span>
        </div>
        {candidates.length === 0 ? <p className="py-8 text-center text-sm text-muted">No pending messages. Check the import history below for the scan summary.</p> : <div className="divide-y divide-line">
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
      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2"><History size={18} /><h2 className="font-semibold">Import history</h2><span className="text-xs text-muted">({history.length})</span></div>
        {history.length === 0 ? <p className="py-5 text-center text-sm text-muted">No chat imports yet. Every upload will be recorded here.</p> : <div className="divide-y divide-line">
          {history.map((record) => <article key={record.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{record.filename}</p><p className="mt-1 text-xs text-muted">{new Date(record.createdAt).toLocaleString()} · {record.stats.total} messages scanned · {record.stats.candidates} expense candidates</p></div>
            <div className="text-right"><span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">{record.status === 'completed' ? 'Completed' : 'Review pending'}</span><p className="mt-1 text-xs text-muted">{record.stats.duplicates} duplicates · {record.stats.ignored} ignored</p></div>
          </article>)}
        </div>}
      </section>
    </>}
  </>
}
