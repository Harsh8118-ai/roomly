import { cloneElement, useId, useState, type ReactElement } from 'react'
import { cn } from '@/utils/cn'

/** Lightweight tooltip: opens on hover and keyboard focus, dismissed with Esc. */
export function Tooltip({ label, children, side = 'top' }: { label: string; children: ReactElement<any>; side?: 'top' | 'bottom' | 'right' }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        id={id} role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-sm bg-fg px-2 py-1 text-xs font-medium text-bg shadow-md transition-opacity duration-150',
          open ? 'opacity-100' : 'opacity-0',
          side === 'top' && 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
          side === 'bottom' && 'left-1/2 top-full mt-1.5 -translate-x-1/2',
          side === 'right' && 'left-full top-1/2 ml-2 -translate-y-1/2',
        )}
      >
        {label}
      </span>
    </span>
  )
}
