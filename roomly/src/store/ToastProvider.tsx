import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/utils/cn'

type ToastKind = 'success' | 'error' | 'info'
interface Toast { id: number; kind: ToastKind; title: string; description?: string; action?: { label: string; onClick: () => void } }
interface ToastApi {
  show: (t: Omit<Toast, 'id' | 'kind'> & { kind?: ToastKind; duration?: number }) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}
const Ctx = createContext<ToastApi | null>(null)

const icons = { success: CheckCircle2, error: AlertCircle, info: Info }
const tone = { success: 'text-success', error: 'text-danger', info: 'text-info' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const show = useCallback<ToastApi['show']>(({ kind = 'success', duration, ...rest }) => {
    const id = ++counter.current
    setToasts((t) => [...t.slice(-2), { id, kind, ...rest }])
    window.setTimeout(() => dismiss(id), duration ?? (rest.action ? 6000 : 3600))
  }, [dismiss])

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (title, description) => show({ kind: 'success', title, description }),
    error: (title, description) => show({ kind: 'error', title, description, duration: 5000 }),
    info: (title, description) => show({ kind: 'info', title, description }),
  }), [show])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:items-end md:p-6"
        role="region" aria-label="Notifications" aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = icons[t.kind]
            return (
              <motion.div
                key={t.id} layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-elevated p-3.5 shadow-lg"
                role={t.kind === 'error' ? 'alert' : 'status'}
              >
                <Icon size={18} className={cn('mt-0.5 shrink-0', tone[t.kind])} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{t.title}</p>
                  {t.description && <p className="t-small mt-0.5 text-muted">{t.description}</p>}
                </div>
                {t.action && (
                  <button
                    onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                    className="rounded-sm px-2 py-1 text-sm font-medium text-accent-strong transition-colors hover:bg-accent-soft"
                  >
                    {t.action.label}
                  </button>
                )}
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="rounded-sm p-1 text-subtle transition-colors hover:text-fg">
                  <X size={14} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast must be used inside ToastProvider')
  return v
}
