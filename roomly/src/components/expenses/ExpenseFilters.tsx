import { useEffect, useState } from 'react'
import { ResponsiveDialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { CATEGORIES } from '@/constants/categories'
import { useMembers } from '@/hooks/queries'
import { cn } from '@/utils/cn'
import type { CategoryId } from '@/types'

export interface FilterState {
  members: string[]
  categories: CategoryId[]
  from: string
  to: string
  minAmount: string
  maxAmount: string
}
export const EMPTY_FILTERS: FilterState = { members: [], categories: [], from: '', to: '', minAmount: '', maxAmount: '' }

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors', on ? 'border-accent bg-accent-soft font-medium text-accent-strong' : 'border-line text-muted hover:border-line-strong hover:text-fg')}>
      {children}
    </button>
  )
}

/** Drawer on desktop, bottom sheet on mobile. Edits a draft and applies on "Show results". */
export function ExpenseFilters({ open, onClose, value, onApply }: { open: boolean; onClose: () => void; value: FilterState; onApply: (f: FilterState) => void }) {
  const [draft, setDraft] = useState(value)
  const { members } = useMembers()
  useEffect(() => { if (open) setDraft(value) }, [open, value])
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) => setDraft((d) => ({ ...d, [k]: v }))

  return (
    <ResponsiveDialog
      open={open} onClose={onClose} title="Filters" desktop="drawer"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setDraft(EMPTY_FILTERS)}>Reset</Button>
          <Button fullWidth onClick={() => { onApply(draft); onClose() }}>Show results</Button>
        </div>
      }
    >
      <div className="space-y-7 pt-2">
        <fieldset>
          <legend className="mb-3 text-sm font-medium">Paid by</legend>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => <Chip key={m.id} on={draft.members.includes(m.id)} onClick={() => set('members', toggle(draft.members, m.id))}><Avatar person={m} size="xs" />{m.name.split(' ')[0]}</Chip>)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-3 text-sm font-medium">Category</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => <Chip key={c.id} on={draft.categories.includes(c.id)} onClick={() => set('categories', toggle(draft.categories, c.id))}><c.icon size={14} />{c.label}</Chip>)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-3 text-sm font-medium">Date range</legend>
          <div className="grid grid-cols-2 gap-3">
            <Input label="From" type="date" value={draft.from} onChange={(e) => set('from', e.target.value)} />
            <Input label="To" type="date" value={draft.to} onChange={(e) => set('to', e.target.value)} />
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-3 text-sm font-medium">Amount</legend>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Min (₹)" inputMode="numeric" placeholder="0" value={draft.minAmount} onChange={(e) => set('minAmount', e.target.value.replace(/\D/g, ''))} />
            <Input label="Max (₹)" inputMode="numeric" placeholder="Any" value={draft.maxAmount} onChange={(e) => set('maxAmount', e.target.value.replace(/\D/g, ''))} />
          </div>
        </fieldset>
      </div>
    </ResponsiveDialog>
  )
}
