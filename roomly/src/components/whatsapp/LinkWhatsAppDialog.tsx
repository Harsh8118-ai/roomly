import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, ExternalLink, RefreshCw, Smartphone } from 'lucide-react'
import { ResponsiveDialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'
import { useCreateLinkCode, useSimulateWhatsApp, useWhatsAppStatus } from '@/hooks/whatsapp'
import { copyToClipboard } from '@/utils/clipboard'
import type { WhatsAppLinkCode } from '@/types'

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`

/** Shows a one-time code (and QR) the person sends to the Roomly number to prove the phone is theirs. */
export function LinkWhatsAppDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const toast = useToast()
  const { data: status } = useWhatsAppStatus({ fast: open })
  const createCode = useCreateLinkCode()
  const simulate = useSimulateWhatsApp()
  const [code, setCode] = useState<WhatsAppLinkCode | null>(null)
  const [left, setLeft] = useState(0)
  const announced = useRef(false)

  const generate = () => createCode.mutate(undefined, { onSuccess: (c) => { setCode(c); setLeft(new Date(c.expiresAt).getTime() - Date.now()) } })

  useEffect(() => { if (open) { announced.current = false; setCode(null); generate() } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open])
  useEffect(() => {
    if (!open || !code) return
    const t = setInterval(() => setLeft(new Date(code.expiresAt).getTime() - Date.now()), 1000)
    return () => clearInterval(t)
  }, [open, code])

  const linked = !!status?.me.linked && !!code
  // Keep the latest onClose in a ref: the parent passes a new function on every render, and
  // depending on it directly would cancel the close timer below before it fires.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open || !linked) return
    if (!announced.current) { announced.current = true; toast.success('WhatsApp linked', 'You can now text expenses to Roomly.') }
    const t = setTimeout(() => onCloseRef.current(), 1600)
    return () => clearTimeout(t)
  }, [open, linked, toast])

  const expired = !!code && left <= 0 && !linked
  const copy = async () => { if (code && await copyToClipboard(`link ${code.code}`)) toast.success('Message copied') }
  const number = status?.botNumber ? `+${status.botNumber}` : null

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Link your WhatsApp" description="Send Roomly a one-time code so it knows which number is yours.">
      <AnimatePresence mode="wait" initial={false}>
        {linked ? (
          <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center" role="status">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent-strong text-on-accent"><Check size={30} strokeWidth={2.5} /></motion.div>
            <p className="mt-5 text-lg font-semibold">You’re linked{status?.me.phoneMasked ? ` · ${status.me.phoneMasked}` : ''}</p>
            <p className="mt-1 text-sm text-muted">Try texting “vegetables 150” to Roomly.</p>
          </motion.div>
        ) : (
          <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {createCode.isPending && !code ? (
              <div className="py-12 text-center text-sm text-muted" role="status">Getting your code…</div>
            ) : code ? (
              <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
                {code.deepLink && (
                  <div className="mx-auto rounded-xl border border-line bg-white p-3" aria-hidden={expired}>
                    <QRCodeSVG value={code.deepLink} size={148} level="M" className={expired ? 'opacity-20' : ''} />
                    <p className="mt-2 text-center text-[11px] text-neutral-500">Scan with your phone</p>
                  </div>
                )}
                <div>
                  <p className="text-[13px] text-muted">Your code</p>
                  <p className="tnum mt-1 font-mono text-3xl font-semibold tracking-wider">{code.code}</p>
                  <p className="mt-2 text-sm text-muted" role="timer">{expired ? 'This code expired.' : `Expires in ${mmss(Math.max(0, left))}`}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {expired ? (
                      <Button leftIcon={<RefreshCw size={15} />} onClick={generate} loading={createCode.isPending}>Get a new code</Button>
                    ) : (
                      <>
                        {code.deepLink && <a href={code.deepLink} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md bg-accent-strong px-4 text-sm font-medium text-on-accent transition-[filter] hover:brightness-110"><ExternalLink size={15} />Open WhatsApp</a>}
                        <Button variant="secondary" leftIcon={<Copy size={15} />} onClick={copy}>Copy message</Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {code && !expired && (
              <ol className="mt-6 space-y-2.5 rounded-lg bg-surface-2 p-4 text-sm">
                <li className="flex gap-3"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-fg text-[11px] font-semibold text-bg">1</span><span>{code.deepLink ? 'Tap Open WhatsApp (or scan the QR).' : <>Open WhatsApp and start a chat with {number ?? 'the Roomly number'}.</>}</span></li>
                <li className="flex gap-3"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-fg text-[11px] font-semibold text-bg">2</span><span>Send the message <code className="rounded-xs bg-surface px-1.5 py-0.5 font-mono text-[13px]">link {code.code}</code> — it’s already typed for you.</span></li>
                <li className="flex gap-3"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-fg text-[11px] font-semibold text-bg">3</span><span>Come back here. This screen updates by itself.</span></li>
              </ol>
            )}

            {code && !expired && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted" role="status"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-strong" /></span>Waiting for your message…</p>
            )}

            {status?.simulator && code && !expired && user && (
              <div className="mt-5 rounded-lg border border-dashed border-line-strong p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted"><Smartphone size={13} />Development only</p>
                <Button size="sm" variant="secondary" loading={simulate.isPending} onClick={() => simulate.mutate({ as: user.id, text: `link ${code.code}`, context: 'dm' })}>Simulate sending it from my phone</Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </ResponsiveDialog>
  )
}
