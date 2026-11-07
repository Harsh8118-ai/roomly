import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Eye, ImagePlus, RefreshCw, Trash2 } from 'lucide-react'
import { expenseService } from '@/services/expenseService'
import { Modal } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/Progress'
import { cn } from '@/utils/cn'

interface Props { value?: string; onChange: (url: string | undefined) => void }
type Phase = 'idle' | 'uploading' | 'error'

export function ReceiptUpload({ value, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const [preview, setPreview] = useState(false)

  const upload = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setPhase('error'); setError('Please choose an image (JPG, PNG or HEIC).'); return }
    setPhase('uploading'); setProgress(5); setError('')
    try {
      const url = await expenseService.uploadReceipt(file, setProgress)
      onChange(url); setPhase('idle')
    } catch (e) {
      setPhase('error'); setError(e instanceof Error ? e.message : 'Upload failed. Try again.')
    }
  }
  const pick = () => input.current?.click()

  return (
    <div>
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Upload receipt"
        onChange={(e) => { upload(e.target.files?.[0]); e.target.value = '' }} />
      <AnimatePresence mode="wait" initial={false}>
        {value && phase === 'idle' ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5">
            <button type="button" onClick={() => setPreview(true)} aria-label="View receipt" className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-line bg-surface-2">
              <img src={value} alt="Receipt thumbnail" className="h-full w-full object-cover object-top" />
            </button>
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">Receipt attached</p><p className="t-micro text-muted">Visible to everyone in your household</p></div>
            <div className="flex gap-0.5">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(true)} aria-label="View receipt"><Eye size={15} /></Button>
              <Button type="button" variant="ghost" size="sm" onClick={pick} aria-label="Replace receipt"><RefreshCw size={15} /></Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)} aria-label="Remove receipt" className="hover:text-danger"><Trash2 size={15} /></Button>
            </div>
          </motion.div>
        ) : phase === 'uploading' ? (
          <motion.div key="up" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-lg border border-line bg-surface p-4" role="status">
            <div className="mb-2.5 flex items-center justify-between text-sm"><span className="font-medium">Uploading receipt…</span><span className="tnum text-muted">{progress}%</span></div>
            <ProgressBar value={progress} label="Upload progress" />
          </motion.div>
        ) : (
          <motion.button
            key="empty" type="button" onClick={pick}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]) }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={cn('flex w-full items-center gap-3 rounded-lg border border-dashed p-4 text-left transition-colors',
              phase === 'error' ? 'border-danger/50 bg-danger-soft/40' : drag ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface hover:border-accent hover:bg-accent-soft/50')}
          >
            <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-md', phase === 'error' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-muted')}>
              {phase === 'error' ? <AlertCircle size={20} /> : <ImagePlus size={20} />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{phase === 'error' ? error : drag ? 'Drop to attach' : 'Add a receipt photo'}</span>
              <span className="t-micro text-muted">{phase === 'error' ? 'Tap to try again' : 'Snap it, drop it, or browse · up to 5 MB'}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
      <Modal open={preview} onClose={() => setPreview(false)} title="Receipt" className="max-w-md">
        {value && <img src={value} alt="Receipt" className="mx-auto max-h-[65dvh] rounded-md border border-line" />}
      </Modal>
    </div>
  )
}
