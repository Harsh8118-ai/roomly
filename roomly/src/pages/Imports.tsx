import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileUp, RefreshCw, History, FileArchive, Check, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useMembers } from '@/hooks/queries'
import { api } from '@/services/api/client'
import { useAuth } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'
import { useImportActivity } from '@/store/ImportActivityProvider'

type ImportStats = { total: number; newMessages: number; duplicates: number; candidates: number; ignored: number; approved?: number; rejected?: number; unmatched?: number }
type ImportRecord = { id: string; filename: string; status: 'review' | 'completed'; stats: ImportStats; createdAt: string }
type PreviewResponse = { senders: string[]; candidates: number }
type SenderMapping = { sender: string; memberId?: string; name?: string }
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
  const [selfSender, setSelfSender] = useState('')
  const [separateMemberName, setSeparateMemberName] = useState('')
  const [senderChoices, setSenderChoices] = useState<Record<string, string>>({})
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
      importActivity.update('mapping')
      setSenders(preview.senders)
      setSelfSender(preview.senders.some((name) => /^you$/i.test(name)) ? preview.senders.find((name) => /^you$/i.test(name))! : '')
      setSeparateMemberName('')
      const defaults: Record<string, string> = {}
      preview.senders.forEach((sender) => {
        const match = members.find((member) => member.name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === sender.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
        defaults[sender] = match?.id ?? '__new__'
      })
      setSenderChoices(defaults)
    } catch (error) {
      importActivity.clear()
      toast.error(error instanceof Error ? error.message : 'Could not read this chat.')
    } finally { setBusy(false) }
  }

  const confirmImport = async () => {
    if (!chat) return
    if (!selfSender && !separateMemberName.trim()) { toast.error('Choose your sender identity or enter a separate member name.'); return }
    setBusy(true)
    importActivity.update('importing')
    try {
      const senderMappings: SenderMapping[] = senders.filter((sender) => sender !== selfSender).map((sender) => {
        const choice = senderChoices[sender]
        if (choice && choice !== '__new__') return { sender, memberId: choice }
        return { sender, name: sender }
      })
      const result = await api.post<ImportResponse>('/imports/whatsapp', {
        filename: chat.filename, content: chat.content, senderMappings, selfSender, separateMemberName,
      })
      await qc.invalidateQueries({ queryKey: ['hh'] })
      await refreshHistory()
      const stats = result.import.stats
      importActivity.finish({ imported: stats.approved ?? 0, total: stats.total, duplicates: stats.duplicates })
      toast.success(`Imported ${stats.approved ?? 0} expenses. ${stats.duplicates} duplicates skipped; ${stats.unmatched ?? 0} unmatched.`)
      setChat(null); setSenders([]); setSelfSender(''); setSeparateMemberName('')
    } catch (error) {
      importActivity.clear()
      toast.error(error instanceof Error ? error.message : 'Could not import this chat.')
    } finally { setBusy(false) }
  }

  return <>
    <PageHeader title="Import WhatsApp chat" description="Turn your group chat into a shared expense ledger. Roomly detects payments and assigns each expense to its message sender." />
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
            <p className="mt-1 text-sm text-muted">Upload a .txt or .md export, or a .zip containing one. Roomly extracts the senders first so you can map every person before expenses are imported.</p>
            <label className="mt-4 flex w-full cursor-pointer sm:inline-flex sm:w-auto">
              <input type="file" accept=".txt,.md,.zip,text/plain,text/markdown,application/zip" className="sr-only" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} />
              <span className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent-strong px-4 text-sm font-semibold text-on-accent shadow-sm transition-transform active:scale-[0.98] sm:w-auto">{busy ? <RefreshCw size={16} className="animate-spin" /> : <FileArchive size={16} />}{busy ? 'Reading…' : 'Choose chat file'}</span>
            </label>
            <p className="mt-2 text-xs text-muted">TXT · Markdown · ZIP containing TXT/Markdown · Maximum 10 MB</p>
          </div>
        </div>
      </section>
      {chat && <section className="card mb-5 space-y-4 p-4 sm:mb-6 sm:space-y-5 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent-strong">Step 2 of 2</div><h2 className="font-semibold">Match your group members</h2><p className="mt-1 text-sm text-muted">{senders.length} senders found · {chat.filename}</p></div><button className="rounded-md p-2 text-muted hover:bg-surface-2" onClick={() => setChat(null)} aria-label="Cancel import"><X size={18}/></button></div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Which sender are you?</label>
          <select value={selfSender ? 'sender:'+selfSender : '__separate__'} onChange={(e) => { if (e.target.value === '__separate__') setSelfSender(''); else { setSelfSender(e.target.value.slice(7)); setSeparateMemberName('') } }} className="h-11 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm">
            <option value="__separate__">I'm not in this chat — create a separate member</option>
            {senders.map((sender) => <option key={sender} value={'sender:'+sender}>{sender}</option>)}
          </select>
          {!selfSender && <input value={separateMemberName} onChange={(e) => setSeparateMemberName(e.target.value)} placeholder="Your member name" maxLength={60} className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"/>}
        </div>
        <div className="space-y-3"><div><h3 className="text-sm font-semibold">Match everyone else</h3><p className="mt-0.5 text-xs text-muted">Connect chat names to existing Roomly members, or create new members.</p></div>
          {senders.filter((sender) => sender !== selfSender).map((sender) => <div key={sender} className="grid gap-2 rounded-lg border border-line bg-surface-2/50 p-3 sm:grid-cols-[1fr_1fr] sm:items-center"><span className="text-sm font-medium">{sender}</span><select value={senderChoices[sender] ?? '__new__'} onChange={(e) => setSenderChoices((old) => ({...old,[sender]:e.target.value}))} className="h-11 w-full min-w-0 rounded-lg border border-line bg-surface px-3 text-sm"><option value="__new__">Create as “{sender}”</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>)}
        </div>
        <p className="text-xs text-muted">Each expense will be attributed to the sender you map. Roomly will not ask you to approve or edit individual expenses.</p>
        <button disabled={busy} onClick={() => void confirmImport()} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent-strong px-4 text-sm font-semibold text-on-accent shadow-sm transition-transform active:scale-[0.99] disabled:opacity-50 sm:w-auto">{busy ? <RefreshCw size={16} className="animate-spin"/> : <Check size={16}/>} {busy ? 'Importing…' : 'Confirm and import expenses'}</button>
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
