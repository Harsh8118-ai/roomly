import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileUp, RefreshCw, History, FileArchive, X, UserRound, Users, ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useMembers } from '@/hooks/queries'
import { api } from '@/services/api/client'
import { useAuth } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'
import { useImportActivity } from '@/store/ImportActivityProvider'

type ImportStats = { total: number; newMessages: number; duplicates: number; candidates: number; ignored: number; approved?: number; rejected?: number; unmatched?: number }
type ImportRecord = { id: string; filename: string; status: 'review' | 'completed'; stats: ImportStats; createdAt: string }
type PreviewResponse = { senders: string[]; candidates: number; dateFormat: { dateOrder: 'MDY' | 'DMY' | null; inferred: boolean; ambiguous: boolean } }
type SenderMapping = { sender: string; memberId?: string; name?: string }
type DateOrder = 'MDY' | 'DMY'
type ImportResponse = {
  import: { id: string; filename: string; stats: ImportStats }
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
  const importActivity = useImportActivity()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<ImportRecord[]>([])
  const [chat, setChat] = useState<{ filename: string; content: string } | null>(null)
  const [senders, setSenders] = useState<string[]>([])
  const [dateOrder, setDateOrder] = useState<DateOrder | null>(null)
  const [dateOrderInferred, setDateOrderInferred] = useState(false)
  const isAdmin = members.some((member) => member.id === user?.id && member.role === 'admin')

  const refreshHistory = async () => {
    try { setHistory(await api.get<ImportRecord[]>('/imports')) }
    catch { /* History remains available on the next refresh. */ }
  }
  useEffect(() => { void refreshHistory() }, [])

  const upload = async (file?: File) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { toast.error('The maximum upload size is 10 MB.'); return }
    setBusy(true)
    importActivity.start(file.name)
    try {
      const parsed = await readChatFile(file)
      if (!parsed.content.trim()) throw new Error('The selected chat file is empty.')
      const preview = await api.post<PreviewResponse>('/imports/whatsapp/preview', { filename: parsed.filename, content: parsed.content })
      setChat(parsed)
      setDateOrder(preview.dateFormat.dateOrder)
      setDateOrderInferred(preview.dateFormat.inferred)
      importActivity.update('mapping')
      setSenders(preview.senders)
    } catch (error) {
      importActivity.clear()
      toast.error(error instanceof Error ? error.message : 'Could not read this chat.')
    } finally { setBusy(false) }
  }

  const startImport = async (selectedSender: string | null) => {
    if (!chat || busy) return
    if (!dateOrder) { toast.error('Choose the date format before importing this chat.'); return }
    const separateMemberName = selectedSender ? '' : user?.name?.trim() ?? ''
    if (!selectedSender && !separateMemberName) {
      toast.error('Your account name is missing. Update your profile before importing as a separate member.')
      return
    }
    setBusy(true)
    importActivity.update('importing')
    try {
      const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      const senderMappings: SenderMapping[] = senders
        .filter((sender) => sender !== selectedSender)
        .map((sender) => {
          const match = members.find((member) => normalize(member.name) === normalize(sender))
          return match ? { sender, memberId: match.id } : { sender, name: sender }
        })
      const result = await api.post<ImportResponse>('/imports/whatsapp', {
        filename: chat.filename, content: chat.content, senderMappings,
        selfSender: selectedSender ?? '', separateMemberName, dateOrder,
      })
      await qc.invalidateQueries({ queryKey: ['hh'] })
      await refreshHistory()
      const stats = result.import.stats
      importActivity.finish({ imported: stats.approved ?? 0, total: stats.total, duplicates: stats.duplicates })
      toast.success(`Imported ${stats.approved ?? 0} expenses. ${stats.duplicates} duplicates skipped; ${stats.unmatched ?? 0} unmatched.`)
      setChat(null)
      setSenders([])
      setDateOrder(null)
      setDateOrderInferred(false)
    } catch (error) {
      importActivity.clear()
      toast.error(error instanceof Error ? error.message : 'Could not import this chat.')
    } finally { setBusy(false) }
  }

  return <>
    <PageHeader title="Import WhatsApp chat" description="Turn your group chat into a shared expense ledger." />
    {busy && <section className="card mb-4 overflow-hidden p-4 sm:p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-semibold">{importActivity.phase === 'reading' ? 'Reading your chat' : importActivity.phase === 'mapping' ? 'Preparing your import' : 'Adding expenses to Roomly'}</p><p className="mt-0.5 truncate text-xs text-muted">{importActivity.filename}</p></div>
        <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-strong">In progress</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Import in progress">
        <div className="h-full w-2/5 rounded-full bg-accent-strong animate-[import-progress_1.3s_ease-in-out_infinite]" />
      </div>
      <p className="mt-2 text-xs text-muted">Keep this page open while Roomly processes the chat. Expense totals will appear as soon as the import finishes.</p>
    </section>}
    {!busy && importActivity.phase === 'complete' && <section className="card mb-4 flex flex-wrap items-center justify-between gap-3 border-accent/30 p-4">
      <div><p className="text-sm font-semibold">Chat imported successfully</p><p className="mt-1 text-xs text-muted">{importActivity.filename}</p></div>
      <div className="flex gap-4 text-right"><div><p className="tnum text-lg font-semibold text-success">{importActivity.imported}</p><p className="text-[11px] text-muted">Expenses</p></div><div><p className="tnum text-lg font-semibold">{importActivity.duplicates}</p><p className="text-[11px] text-muted">Duplicates skipped</p></div></div>
    </section>}
    {!isAdmin ? <div className="card p-5 text-sm text-muted">Only the household admin can import chat exports.</div> : <>
      <section className="card mb-5 p-4 sm:mb-6 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong"><FileUp size={20} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Upload WhatsApp export</h2>
            <p className="mt-1 text-sm text-muted">Upload a .txt or .md export, or a .zip containing one.</p>
            <label className="mt-4 flex w-full cursor-pointer sm:inline-flex sm:w-auto">
              <input type="file" accept=".txt,.md,.zip,text/plain,text/markdown,application/zip" className="sr-only" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} />
              <span className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent-strong px-4 text-sm font-semibold text-on-accent shadow-sm transition-transform active:scale-[0.98] sm:w-auto">{busy ? <RefreshCw size={16} className="animate-spin" /> : <FileArchive size={16} />}{busy ? 'Reading…' : 'Choose chat file'}</span>
            </label>
            <p className="mt-2 text-xs text-muted">TXT · Markdown · ZIP || Maximum 10 MB</p>
          </div>
        </div>
      </section>
      {chat && <section className="card mb-5 overflow-hidden sm:mb-6">
        <div className="flex items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent-strong">Ready to import</div>
            <h2 className="text-lg font-semibold">Who are you in this chat?</h2>
            <p className="mt-1 text-sm text-muted">{senders.length} expense senders detected · {chat.filename}</p>
          </div>
          <button className="rounded-md p-2 text-muted transition hover:bg-surface-2" onClick={() => { setChat(null); setSenders([]); setDateOrder(null); setDateOrderInferred(false); importActivity.clear() }} aria-label="Cancel import"><X size={18}/></button>
        </div>
        <div className="space-y-2 p-4 sm:p-5">
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-sm font-medium">Chat date format</p>
            {dateOrder ? <p className="mt-1 text-xs text-muted">{dateOrderInferred ? 'Detected automatically from unambiguous dates.' : 'Confirm the date order used in this WhatsApp export.'}</p> : <p className="mt-1 text-xs text-muted">The dates in this export are ambiguous. Choose the format used by the original phone.</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => { setDateOrder('DMY'); setDateOrderInferred(false) }} aria-pressed={dateOrder === 'DMY'} className={`rounded-lg border px-3 py-2 text-sm ${dateOrder === 'DMY' ? 'border-accent-strong bg-accent-soft font-semibold text-accent-strong' : 'border-line bg-surface'}`}>DD/MM/YY · 11/12 = 11 December</button>
              <button type="button" disabled={busy} onClick={() => { setDateOrder('MDY'); setDateOrderInferred(false) }} aria-pressed={dateOrder === 'MDY'} className={`rounded-lg border px-3 py-2 text-sm ${dateOrder === 'MDY' ? 'border-accent-strong bg-accent-soft font-semibold text-accent-strong' : 'border-line bg-surface'}`}>MM/DD/YY · 11/12 = November 12</button>
            </div>
          </div>
          <p className="hidden sm:flex text-sm text-muted">Choose your name below. Roomly matches the remaining senders to existing members where possible and creates missing members automatically.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {senders.map((sender) => {
              const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
              const match = members.find((member) => normalize(member.name) === normalize(sender))
              return <button key={sender} type="button" disabled={busy || !dateOrder} onClick={() => void startImport(sender)} className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition hover:border-accent-strong/60 hover:bg-accent-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong disabled:cursor-wait disabled:opacity-60">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-strong"><UserRound size={19}/></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{sender}</span><span className="mt-0.5 block text-xs text-muted">{match ? `Matches Roomly member · ${match.name}` : 'Use this sender as your identity'}</span></span>
                <ArrowRight size={17} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent-strong"/>
              </button>
            })}
            <button type="button" disabled={busy || !dateOrder} onClick={() => void startImport(null)} className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-dashed border-accent-strong/50 bg-accent-soft/20 p-3 text-left transition hover:border-accent-strong hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong disabled:cursor-wait disabled:opacity-60 sm:col-span-2">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface text-accent-strong"><Users size={19}/></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">I’m not in this chat</span><span className="mt-0.5 block text-xs text-muted">Make you a separate household member</span></span>
              <ArrowRight size={17} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent-strong"/>
            </button>
          </div>
          {!dateOrder && <p className="text-xs text-warning">Select the date format above to enable importing.</p>}
          {busy && <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-sm text-accent-strong" role="status"><RefreshCw size={15} className="animate-spin"/> Importing chat and assigning expenses…</div>}
          <p className="pt-1 text-xs text-muted">Selecting an option starts the import immediately.</p>
        </div>
      </section>}
      <section className="card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2"><History size={18} /><h2 className="font-semibold">Import history</h2><span className="text-xs text-muted">({history.length})</span></div>
        {history.length === 0 ? <p className="py-5 text-center text-sm text-muted">No chat imports yet. Each upload will be recorded here.</p> : <div className="divide-y divide-line">
          {history.map((record) => <article key={record.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{record.filename}</p><p className="mt-1 text-xs text-muted">{new Date(record.createdAt).toLocaleString()} · {record.stats.total} messages scanned · {record.stats.approved ?? 0} expenses added</p></div>
            <div className="flex items-center justify-between gap-2 sm:block sm:text-right"><span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-strong">Completed</span><p className="mt-1 text-xs text-muted">{record.stats.duplicates} duplicates · {record.stats.ignored} ignored · {record.stats.unmatched ?? 0} unmatched</p></div>
          </article>)}
        </div>}
      </section>
    </>}
  </>
}
