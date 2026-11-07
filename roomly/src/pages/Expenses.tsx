import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Receipt, Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthSelector } from '@/components/common/MonthSelector'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { ExpenseFilters, EMPTY_FILTERS, type FilterState } from '@/components/expenses/ExpenseFilters'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { SkeletonList } from '@/components/ui/Skeleton'
import { Money } from '@/components/ui/Money'
import { CATEGORY_MAP } from '@/constants/categories'
import { useExpenses, useMembers } from '@/hooks/queries'
import { useHotkey } from '@/hooks/useHotkeys'
import { useComposer } from '@/store/ComposerProvider'
import { currentMonth, formatDate, monthLabel } from '@/utils/date'
import { pluralize, sum } from '@/utils/format'
import type { CategoryId } from '@/types'

export function ExpensesPage() {
  const [params, setParams] = useSearchParams()
  const { byId } = useMembers()
  const { openNew } = useComposer()
  const searchRef = useRef<HTMLInputElement>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const month = params.get('month') ?? currentMonth()
  const filters: FilterState = useMemo(() => ({
    members: params.get('members')?.split(',').filter(Boolean) ?? [],
    categories: (params.get('categories')?.split(',').filter(Boolean) ?? []) as CategoryId[],
    from: params.get('from') ?? '', to: params.get('to') ?? '',
    minAmount: params.get('min') ?? '', maxAmount: params.get('max') ?? '',
  }), [params])
  const q = params.get('q') ?? ''
  const hasRange = !!(filters.from || filters.to)

  // search box is local for snappy typing, debounced into the URL
  const [text, setText] = useState(q)
  useEffect(() => setText(q), [q])
  const patch = useCallback((changes: Record<string, string | null>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
      return next
    }, { replace: true })
  }, [setParams])
  useEffect(() => {
    if (text === q) return
    const t = setTimeout(() => patch({ q: text.trim() || null }), 220)
    return () => clearTimeout(t)
  }, [text, q, patch])
  useHotkey('/', useCallback((e) => { e.preventDefault(); searchRef.current?.focus() }, []))

  const { data, isPending, isError, refetch, isPlaceholderData } = useExpenses({
    month: hasRange ? undefined : month, q, members: filters.members, categories: filters.categories,
    from: filters.from || undefined, to: filters.to || undefined,
    minAmount: filters.minAmount ? Number(filters.minAmount) : undefined, maxAmount: filters.maxAmount ? Number(filters.maxAmount) : undefined,
  })

  const applyFilters = (f: FilterState) => patch({
    members: f.members.join(',') || null, categories: f.categories.join(',') || null,
    from: f.from || null, to: f.to || null, min: f.minAmount || null, max: f.maxAmount || null,
  })
  const clearAll = () => { setText(''); patch({ q: null, members: null, categories: null, from: null, to: null, min: null, max: null }) }

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.members.map((id) => ({ key: `m-${id}`, label: byId(id).name.split(' ')[0], remove: () => applyFilters({ ...filters, members: filters.members.filter((x) => x !== id) }) })),
    ...filters.categories.map((id) => ({ key: `c-${id}`, label: CATEGORY_MAP[id]?.label ?? id, remove: () => applyFilters({ ...filters, categories: filters.categories.filter((x) => x !== id) }) })),
    ...(hasRange ? [{ key: 'date', label: `${filters.from ? formatDate(filters.from) : 'Start'} – ${filters.to ? formatDate(filters.to) : 'Today'}`, remove: () => applyFilters({ ...filters, from: '', to: '' }) }] : []),
    ...(filters.minAmount || filters.maxAmount ? [{ key: 'amt', label: `₹${filters.minAmount || '0'} – ${filters.maxAmount ? `₹${filters.maxAmount}` : 'any'}`, remove: () => applyFilters({ ...filters, minAmount: '', maxAmount: '' }) }] : []),
    ...(q ? [{ key: 'q', label: `“${q}”`, remove: () => { setText(''); patch({ q: null }) } }] : []),
  ]
  const activeCount = chips.filter((c) => c.key !== 'q').length
  const filtered = chips.length > 0

  return (
    <>
      <PageHeader
        title="Expenses"
        description={hasRange ? 'Custom date range' : monthLabel(month)}
        actions={<>
          {!hasRange && <MonthSelector month={month} onChange={(m) => patch({ month: m === currentMonth() ? null : m })} />}
          <Button className="hidden md:inline-flex" leftIcon={<Plus size={16} />} onClick={openNew}>Add expense</Button>
        </>}
      />

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            ref={searchRef} value={text} onChange={(e) => setText(e.target.value)} type="search" aria-label="Search expenses"
            placeholder="Search by item, category or person"
            className="h-11 w-full rounded-md border border-line bg-surface pl-10 pr-10 text-[15px] placeholder:text-subtle hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden"
          />
          {text ? <button onClick={() => { setText(''); patch({ q: null }) }} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1.5 text-muted hover:text-fg"><X size={14} /></button>
            : <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted md:block">/</kbd>}
        </div>
        <Button variant="secondary" size="md" className="h-11" leftIcon={<SlidersHorizontal size={16} />} onClick={() => setFiltersOpen(true)}>
          Filters{activeCount > 0 && <span className="ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent-strong px-1 text-[11px] text-on-accent">{activeCount}</span>}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {filtered && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
              {chips.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1.5 text-[13px] font-medium text-accent-strong">
                  {c.label}
                  <button onClick={c.remove} aria-label={`Remove filter ${c.label}`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-accent/20"><X size={12} /></button>
                </span>
              ))}
              <button onClick={clearAll} className="px-1 text-[13px] text-muted underline-offset-4 hover:text-fg hover:underline">Clear all</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isError ? <ErrorState title="Something went wrong." description="We couldn’t load your household expenses." onRetry={refetch} />
        : isPending ? <SkeletonList rows={8} />
        : data.length === 0 ? (
          <div className="card">
            {filtered ? (
              <EmptyState icon={SearchX} title="Nothing matches." description="Try a different search, or clear your filters to see everything." action={<Button variant="secondary" onClick={clearAll}>Clear all filters</Button>} />
            ) : (
              <EmptyState icon={Receipt} title="No expenses yet." description={month === currentMonth() ? 'Your household hasn’t recorded any expenses this month. Add your first expense to get started.' : `Nothing was recorded in ${monthLabel(month)}.`}
                action={month === currentMonth() ? <Button leftIcon={<Plus size={16} />} onClick={openNew}>Add expense</Button> : undefined} />
            )}
          </div>
        ) : (
          <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <p className="mb-3 px-1 text-sm text-muted" aria-live="polite">{pluralize(data.length, 'expense')} · <Money value={sum(data.map((d) => d.amount))} className="font-medium text-fg" /></p>
            <ExpenseList expenses={data} grouped />
          </div>
        )}

      <ExpenseFilters open={filtersOpen} onClose={() => setFiltersOpen(false)} value={filters} onApply={applyFilters} />
    </>
  )
}
