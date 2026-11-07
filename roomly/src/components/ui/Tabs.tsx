import { useId } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

interface TabsProps<T extends string> {
  tabs: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
}

/** Segmented control with a sliding indicator. Arrow keys move between tabs. */
export function Tabs<T extends string>({ tabs, value, onChange, label, size = 'md', className }: TabsProps<T>) {
  const id = useId()
  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.value === value)
    if (e.key === 'ArrowRight') onChange(tabs[(i + 1) % tabs.length].value)
    if (e.key === 'ArrowLeft') onChange(tabs[(i - 1 + tabs.length) % tabs.length].value)
  }
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className={cn('inline-flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-surface-2 p-0.5 hide-scrollbar', className)}>
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value} role="tab" aria-selected={active} tabIndex={active ? 0 : -1} onClick={() => onChange(t.value)}
            className={cn('relative whitespace-nowrap rounded-[10px] font-medium transition-colors', size === 'sm' ? 'px-3 py-1 text-[13px]' : 'px-3.5 py-1.5 text-sm', active ? 'text-fg' : 'text-muted hover:text-fg')}
          >
            {active && <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-[10px] bg-surface shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
