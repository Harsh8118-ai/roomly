import { useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { IconButton } from './IconButton'
import { Button } from './Button'

export interface OverlayProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  /** Hide the visible title (kept for screen readers). */
  hideTitle?: boolean
  className?: string
}

const Backdrop = ({ onClick }: { onClick: () => void }) => (
  <motion.div
    className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
    onClick={onClick} aria-hidden
  />
)

function Header({ title, description, onClose, hideTitle, id }: Pick<OverlayProps, 'title' | 'description' | 'onClose' | 'hideTitle'> & { id: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', hideTitle ? 'absolute right-3 top-3 z-10' : 'px-6 pb-2 pt-6')}>
      <div className={cn(hideTitle && 'sr-only')}>
        <h2 id={id} className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <IconButton label="Close" size="sm" onClick={onClose}><X size={18} /></IconButton>
    </div>
  )
}

/** Centered modal (desktop). */
export function Modal({ open, onClose, title, description, children, footer, hideTitle, className }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <Backdrop onClick={onClose} />
          <motion.div
            ref={ref} role="dialog" aria-modal="true" aria-labelledby="dlg-title" tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            className={cn('relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-elevated shadow-lg outline-none', className)}
          >
            <Header id="dlg-title" title={title} description={description} onClose={onClose} hideTitle={hideTitle} />
            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
            {footer && <div className="border-t border-line bg-surface-2/50 px-6 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Mobile bottom sheet — swipe the handle (or the sheet) down to dismiss. */
export function BottomSheet({ open, onClose, title, description, children, footer, hideTitle, className }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null)
  const controls = useDragControls()
  useFocusTrap(ref, open, onClose)
  const onDragEnd = (_: unknown, info: PanInfo) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose() }
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end">
          <Backdrop onClick={onClose} />
          <motion.div
            ref={ref} role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabIndex={-1}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            drag="y" dragControls={controls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            className={cn('relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-line bg-elevated shadow-lg outline-none', className)}
          >
            <div className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing" onPointerDown={(e) => controls.start(e)}>
              <span className="h-1.5 w-10 rounded-full bg-line-strong" aria-hidden />
            </div>
            <Header id="sheet-title" title={title} description={description} onClose={onClose} hideTitle={hideTitle} />
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2">{children}</div>
            {footer && <div className="border-t border-line bg-elevated px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Right-hand drawer (desktop). */
export function Drawer({ open, onClose, title, description, children, footer, className }: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <Backdrop onClick={onClose} />
          <motion.aside
            ref={ref} role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabIndex={-1}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 42 }}
            className={cn('relative flex h-full w-full max-w-md flex-col border-l border-line bg-elevated shadow-lg outline-none', className)}
          >
            <Header id="drawer-title" title={title} description={description} onClose={onClose} />
            <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">{children}</div>
            {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Picks the right container for the viewport: modal/drawer on desktop, bottom sheet on mobile. */
export function ResponsiveDialog({ desktop = 'modal', ...props }: OverlayProps & { desktop?: 'modal' | 'drawer' }) {
  const isDesktop = useIsDesktop()
  if (!isDesktop) return <BottomSheet {...props} />
  return desktop === 'drawer' ? <Drawer {...props} /> : <Modal {...props} />
}

interface ConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  loading?: boolean
  destructive?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirm', loading, destructive }: ConfirmProps) {
  return (
    <ResponsiveDialog
      open={open} onClose={onClose} title={title} description={description} className="sm:max-w-md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus>{confirmLabel}</Button>
        </div>
      }
    >
      <span className="sr-only">{description}</span>
    </ResponsiveDialog>
  )
}
