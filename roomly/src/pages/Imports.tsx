import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileUp, RefreshCw, History, FileArchive } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { useMembers } from '@/hooks/queries'
import { api } from '@/services/api/client'
import { useAuth } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'

type ImportStats = { total: number; newMessages: number; duplicates: number; candidates: number; ignored: number; approved?: number; rejected?: number; unmatched?: number }
type ImportRecord = { id: string; filename: string; status: 'review' | 'completed'; stats: ImportStats; createdAt: string }
type ImportResponse = {
  import: { id: string; filename: string; stats: ImportStats }
  messages: unknown[]
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
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<ImportRecord[]>([])
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
    try {
      const chat = await readChatFile(file)
      if (!chat.content.trim()) throw new Error('The selected chat file is empty.')
      const result = await api.post<ImportResponse>('/imports/whatsapp', { filename: chat.filename, content: chat.content })
      await qc.invalidateQueries({ queryKey: ['hh'] })
      await refreshHistory()
      const stats = result.import.stats
      toast.success(\`Imported \${stats.approved ?? 0} expenses. \${stats.duplicates} duplicates skipped; \${stats.unmatched ?? 0} sender/month issues need attention in history.\`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import this chat.')
    } finally { setBusy(false) }
  }

  return <>
    <PageHeader title="Import WhatsApp chat" description="Expenses are added automatically. The sender of each message is recorded as the person who paid." />
    {!isAdmin ? <div className="card p-5 text-sm text-muted">Only the household admin can import chat exports.</div> : <>
      <section className="card mb-6 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong"><FileUp size={20} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Upload WhatsApp export</h2>
            <p className="mt-1 text-sm text-muted">Upload a .txt or .md export, or a .zip containing one. Roomly automatically creates expenses and assigns each payer using the WhatsApp sender name. No approval or editing step.</p>
            <label className="mt-4 inline-flex cursor-pointer">
              <input type="file" accept=".txt,.md,.zip,text/plain,text/markdown,application/zip" className="sr-only" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} />
              <span className="inline-flex h-10 items-center gap-2 rounded-md bg-accent-strong px-4 text-sm font-semibold text-on-accent">{busy ? <RefreshCw size={16} className="animate-spin" /> : <FileArchive size={16} />}{busy ? 'Importing…' : 'Choose chat file'}</span>
            </label>
            <p className="mt-2 text-xs text-muted">TXT · Markdown · ZIP containing TXT/Markdown · Maximum 10 MB</p>
          </div>
        </div>
      </section>
      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2"><History size={18} /><h2 className="font-semibold">Import history</h2><span className="text-xs text-muted">({history.length})</span></div>
        {history.length === 0 ? <p className="py-5 text-center text-sm text-muted">No chat imports yet. Each upload will be recorded here.</p> : <div className="divide-y divide-line">
          {history.map((record) => <article key={record.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{record.filename}</p><p className="mt-1 text-xs text-muted">{new Date(record.createdAt).toLocaleString()} · {record.stats.total} messages scanned · {record.stats.approved ?? 0} expenses added</p></div>
            <div className="text-right"><span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs">Completed</span><p className="mt-1 text-xs text-muted">{record.stats.duplicates} duplicates · {record.stats.ignored} ignored · {record.stats.unmatched ?? 0} unmatched</p></div>
          </article>)}
        </div>}
      </section>
    </>}
  </>
}
