import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/utils/cn'

interface DropdownProps {
  trigger: (a: { open: boolean; toggle: () => void; props: Record<string, unknown> }) => ReactNode
  children: (a: { close: () => void }) => ReactNode
  align?: 'left' | 'right'
  panelClassName?: string
  role?: 'menu' | 'dialog'
  label?: string
}

/** Accessible popover: click-outside, Esc, arrow-key navigation for menu items. */
export function Dropdown({ trigger, children, align = 'right', panelClassName, role = 'menu', label }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); root.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus() }
      if (role === 'menu' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault()
        const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])
        const i = items.indexOf(document.activeElement as HTMLElement)
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
        items[next]?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>('[role="menuitem"],[data-autofocus]')?.focus(), 30)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); window.clearTimeout(t) }
  }, [open, role])

  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), props: { 'aria-haspopup': role, 'aria-expanded': open, 'aria-controls': open ? id : undefined } })}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panel} id={id} role={role} aria-label={label}
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
            className={cn('absolute z-50 mt-2 min-w-[12rem] rounded-lg border border-line bg-elevated p-1.5 shadow-lg', align === 'right' ? 'right-0' : 'left-0', panelClassName)}
          >
            {children({ close })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function MenuItem({ icon, children, onClick, danger, selected, trailing }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; danger?: boolean; selected?: boolean; trailing?: ReactNode }) {
  return (
    <button
      role="menuitem" onClick={onClick} type="button"
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus:outline-none',
        danger ? 'text-danger hover:bg-danger-soft focus:bg-danger-soft' : 'hover:bg-surface-2 focus:bg-surface-2',
        selected && 'font-medium',
      )}
    >
      {icon && <span className="text-muted" aria-hidden>{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {trailing}
    </button>
  )
}

export const MenuDivider = () => <div className="my-1.5 h-px bg-line" role="separator" />
