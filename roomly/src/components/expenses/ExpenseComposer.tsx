import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { ResponsiveDialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { CATEGORIES } from '@/constants/categories'
import { expenseSchema, type ExpenseFormValues } from '@/schemas'
import { useCreateExpense, useMembers, useUpdateExpense } from '@/hooks/queries'
import { useAuth } from '@/store/AuthProvider'
import { useComposer } from '@/store/ComposerProvider'
import { friendlyError } from '@/utils/errors'
import { addDays, formatDate, todayISO } from '@/utils/date'
import { guessCategory } from '@/utils/guessCategory'
import { cn } from '@/utils/cn'
import { ReceiptUpload } from './ReceiptUpload'
import type { CategoryId, Expense } from '@/types'

const toForm = (e: Expense): ExpenseFormValues => ({
  amount: String(e.amount), title: e.title, category: e.category, paidBy: e.paidBy, date: e.date, note: e.note ?? '', receiptUrl: e.receiptUrl,
  splitType: e.splitType ?? 'equal', splits: e.splits ?? [],
})

/** Add / edit expense. Built for one-handed use at the checkout counter: amount → what → category → done. */
export function ExpenseComposer() {
  const { open, editing, close } = useComposer()
  const { user } = useAuth()
  const { members } = useMembers()
  const create = useCreateExpense()
  const update = useUpdateExpense()
  const [showMore, setShowMore] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'success'>('idle')
  const [serverError, setServerError] = useState('')
  const categoryTouched = useRef(false)
  const autoTitle = useRef('')

  const defaults = useMemo<ExpenseFormValues>(() => editing ? toForm(editing) : ({
    amount: '', title: '', category: '' as CategoryId, paidBy: user?.id ?? '', date: todayISO(), note: '', receiptUrl: undefined, splitType: 'equal', splits: [],
  }), [editing, user?.id])

  const { register, handleSubmit, control, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<ExpenseFormValues, unknown, z.output<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema), defaultValues: defaults, mode: 'onSubmit', reValidateMode: 'onChange',
  })

  useEffect(() => {
    if (!open) return
    reset(defaults); setShowMore(!!editing); setPhase('idle'); setServerError('')
    categoryTouched.current = !!editing; autoTitle.current = ''
  }, [open, editing, defaults, reset])

  const category = watch('category')
  const date = watch('date')
  const paidBy = watch('paidBy')
  const title = watch('title')
  const splitType = watch('splitType')
  const payer = members.find((m) => m.id === paidBy)

  // Smart assist: guess the category from the title until the user picks one themselves.
  useEffect(() => {
    if (categoryTouched.current) return
    const g = guessCategory(title)
    if (g && g !== category) setValue('category', g, { shouldValidate: false })
  }, [title, category, setValue])

  const pickCategory = (id: CategoryId) => {
    categoryTouched.current = true
    setValue('category', id, { shouldValidate: true })
    const label = CATEGORIES.find((c) => c.id === id)!.label
    if (!title.trim() || title === autoTitle.current) { setValue('title', label, { shouldValidate: true }); autoTitle.current = label }
  }

  const onSubmit = handleSubmit(async (v) => {
    setServerError('')
    const input = { title: v.title.trim(), amount: Number(v.amount.replace(/,/g, '')), category: v.category as CategoryId, paidBy: v.paidBy, date: v.date, note: v.note?.trim() || undefined, receiptUrl: v.receiptUrl || undefined, splitType: v.splitType, splits: v.splitType === 'custom' ? v.splits : [] }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input }); else await create.mutateAsync(input)
      setPhase('success')
      setTimeout(close, 650)
    } catch (e) { setServerError(friendlyError(e)) }
  })

  const busy = isSubmitting || create.isPending || update.isPending
  const label = editing ? 'Save changes' : 'Add expense'

  return (
    <ResponsiveDialog
      open={open} onClose={close} title={editing ? 'Edit expense' : 'Add expense'} className="sm:max-w-[30rem]"
      footer={
        <Button type="submit" form="expense-form" size="lg" fullWidth loading={busy} loadingText={editing ? 'Saving…' : 'Adding…'} disabled={phase === 'success'} variant={phase === 'success' ? 'soft' : 'primary'}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={phase} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="inline-flex items-center gap-2">
              {phase === 'success' ? <><Check size={18} /> {editing ? 'Saved' : 'Added'}</> : label}
            </motion.span>
          </AnimatePresence>
        </Button>
      }
    >
      <form id="expense-form" onSubmit={onSubmit} noValidate className="space-y-5">
        {serverError && <p role="alert" className="rounded-md bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{serverError}</p>}

        {/* Amount — the hero of the form */}
        <div>
          <label htmlFor="amount" className="sr-only">Amount in rupees</label>
          <div className={cn('flex items-baseline justify-center gap-1.5 rounded-xl border bg-surface-2/60 px-4 py-5 transition-colors focus-within:border-accent focus-within:bg-surface', errors.amount ? 'border-danger/60' : 'border-transparent')}>
            <span className="text-3xl font-medium text-muted" aria-hidden>₹</span>
            <input
              id="amount" data-autofocus inputMode="decimal" autoComplete="off" placeholder="0" aria-invalid={!!errors.amount} aria-describedby={errors.amount ? 'amount-err' : undefined}
              className="tnum w-full min-w-0 max-w-[10ch] bg-transparent text-center text-5xl font-semibold tracking-tight outline-none placeholder:text-subtle/60"
              {...register('amount', { onChange: (e) => { e.target.value = e.target.value.replace(/[^\d.]/g, '') } })}
            />
          </div>
          {errors.amount && <p id="amount-err" role="alert" className="mt-1.5 text-center text-xs text-danger">{errors.amount.message}</p>}
        </div>

        <Input label="What was it?" placeholder="Vegetables, milk, gas refill…" autoComplete="off" error={errors.title?.message} {...register('title')} />

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">Category</legend>
          <Controller control={control} name="category" render={() => (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 hide-scrollbar sm:grid sm:grid-cols-5 sm:overflow-visible" role="radiogroup" aria-label="Category">
              {CATEGORIES.map((c) => {
                const on = category === c.id
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => pickCategory(c.id)}
                    className={cn('flex min-w-[4.6rem] shrink-0 flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-[12px] font-medium transition-all active:scale-95 sm:min-w-0',
                      on ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-fg')}>
                    <c.icon size={19} strokeWidth={1.75} aria-hidden />{c.label}
                  </button>
                )
              })}
            </div>
          )} />
          {errors.category && <p role="alert" className="mt-1.5 text-xs text-danger">{errors.category.message}</p>}
        </fieldset>

        <div>
          <button type="button" onClick={() => setShowMore((s) => !s)} aria-expanded={showMore}
            className="flex w-full items-center justify-between rounded-md py-1 text-left text-sm transition-colors hover:text-fg">
            <span><span className="font-medium">Details</span> <span className="text-muted">· Paid by {payer?.id === user?.id ? 'you' : payer?.name.split(' ')[0]} · {formatDate(date)}</span></span>
            <ChevronDown size={16} className={cn('text-muted transition-transform', showMore && 'rotate-180')} aria-hidden />
          </button>
          <AnimatePresence initial={false}>
            {showMore && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }} className="overflow-hidden">
                <div className="space-y-4 pb-1 pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select label="Paid by" error={errors.paidBy?.message} {...register('paidBy')}>
                      {members.map((m) => <option key={m.id} value={m.id}>{m.name}{m.id === user?.id ? ' (you)' : ''}</option>)}
                    </Select>
                    <div>
                      <Input label="Date" type="date" max={addDays(todayISO(), 0)} error={errors.date?.message} {...register('date')} />
                      <div className="mt-2 flex gap-1.5">
                        {[['Today', 0], ['Yesterday', -1]].map(([l, d]) => (
                          <button key={l} type="button" onClick={() => setValue('date', addDays(todayISO(), d as number), { shouldValidate: true })}
                            className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors', date === addDays(todayISO(), d as number) ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-muted hover:text-fg')}>{l}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Textarea label="Note" optional placeholder="Anything the others should know?" error={errors.note?.message} {...register('note')} />
                  <Select label="Split method" {...register('splitType', { onChange: (event) => {
                    const mode = event.target.value as 'equal' | 'custom'
                    if (mode === 'custom') {
                      const total = Math.round(Number((watch('amount') || '0').replace(/,/g, '')))
                      const base = members.length ? Math.floor(total / members.length) : 0
                      let remainder = total - base * members.length
                      setValue('splits', members.map((member) => ({ memberId: member.id, amount: base + (remainder-- > 0 ? 1 : 0) })), { shouldValidate: true })
                    } else setValue('splits', [])
                  } })}>
                    <option value="equal">Split equally between everyone</option>
                    <option value="custom">Custom amounts per member</option>
                  </Select>
                  {splitType === 'custom' && <div className="rounded-lg border border-line p-3">
                    <p className="mb-2 text-xs font-medium text-muted">Set each member’s share. The total must match the expense amount.</p>
                    <div className="space-y-2">
                      {members.map((member, index) => <label key={member.id} className="flex items-center justify-between gap-3 text-sm">
                        <span>{member.name}</span>
                        <span className="flex items-center gap-1"><span className="text-muted">₹</span><input type="number" min="0" step="1" className="h-9 w-28 rounded-md border border-line bg-surface px-2 text-right tnum" {...register(('splits.' + index + '.amount') as `splits.${number}.amount`, { valueAsNumber: true })} /></span>
                      </label>)}
                    </div>
                    {errors.splits?.message && <p role="alert" className="mt-2 text-xs text-danger">{errors.splits.message}</p>}
                  </div>}
                  <div>
                    <p className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium">Receipt <span className="text-xs font-normal text-subtle">Optional</span></p>
                    <Controller control={control} name="receiptUrl" render={({ field }) => <ReceiptUpload value={field.value} onChange={field.onChange} />} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </form>
    </ResponsiveDialog>
  )
}
