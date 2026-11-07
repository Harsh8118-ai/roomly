import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, Clock, MessageCircle, Pencil, Smartphone, StickyNote, Trash2, User } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Modal } from '@/components/ui/Dialog'
import { ErrorState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { CATEGORY_MAP } from '@/constants/categories'
import { ROUTES } from '@/constants/routes'
import { useDeleteExpense, useExpense, useMembers } from '@/hooks/queries'
import { useComposer } from '@/store/ComposerProvider'
import { ApiError } from '@/utils/errors'
import { formatLongDate, formatTimestamp, formatWeekday } from '@/utils/date'
import { formatINR } from '@/utils/format'

export function ExpenseDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: expense, isPending, error, refetch } = useExpense(id)
  const { byId } = useMembers()
  const { openEdit } = useComposer()
  const del = useDeleteExpense()
  const [confirm, setConfirm] = useState(false)
  const [receipt, setReceipt] = useState(false)
  const back = { to: ROUTES.expenses, label: 'Expenses' }

  if (isPending && !error) {
    return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-44 w-full rounded-2xl" /><Skeleton className="h-56 w-full rounded-xl" /></div>
  }
  if (error || !expense) {
    const notFound = error instanceof ApiError && error.status === 404
    return <div className="mx-auto max-w-2xl"><PageHeader title="Expense" back={back} />
      <ErrorState title={notFound ? 'Expense not found.' : 'Something went wrong.'} description={notFound ? 'It may have been deleted. Head back to your expenses.' : 'We couldn’t load this expense.'} onRetry={notFound ? () => navigate(ROUTES.expenses) : refetch} /></div>
  }

  const payer = byId(expense.paidBy)
  const cat = CATEGORY_MAP[expense.category]
  const rows = [
    { icon: User, label: 'Paid by', value: <span className="flex items-center gap-2"><Avatar person={payer} size="xs" />{payer.name}</span> },
    { icon: Calendar, label: 'Date', value: `${formatWeekday(expense.date)}, ${formatLongDate(expense.date)}` },
    { icon: StickyNote, label: 'Note', value: expense.note ?? <span className="text-subtle">No note</span> },
    { icon: Clock, label: 'Added', value: formatTimestamp(expense.createdAt) },
    { icon: expense.source === 'whatsapp' ? MessageCircle : Smartphone, label: 'Source', value: expense.source === 'whatsapp' ? 'WhatsApp message' : 'Roomly app' },
  ]

  const onDelete = () => del.mutate(expense, { onSuccess: () => { setConfirm(false); navigate(ROUTES.expenses, { replace: true }) } })

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={expense.title} back={back}
        actions={<>
          <Button variant="secondary" leftIcon={<Pencil size={15} />} onClick={() => openEdit(expense)}>Edit</Button>
          <Button variant="secondary" className="text-danger hover:bg-danger-soft" leftIcon={<Trash2 size={15} />} onClick={() => setConfirm(true)}>Delete</Button>
        </>} />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card variant="primary" className="p-6 text-center sm:p-8">
          <CategoryIcon category={expense.category} size="lg" className="mx-auto" />
          <p className="t-money-xl mt-5 !text-[2.75rem]">{formatINR(expense.amount)}</p>
          <p className="mt-2 text-sm text-muted">{cat.label}</p>
        </Card>
      </motion.div>

      <Card className="mt-4 divide-y divide-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-4 px-5 py-4">
            <r.icon size={16} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
            <span className="w-20 shrink-0 text-sm text-muted">{r.label}</span>
            <span className="min-w-0 flex-1 text-sm font-medium">{r.value}</span>
          </div>
        ))}
      </Card>

      {expense.receiptUrl && (
        <Card className="mt-4 p-5">
          <h2 className="mb-3 text-sm font-semibold">Receipt</h2>
          <button onClick={() => setReceipt(true)} className="group block overflow-hidden rounded-lg border border-line bg-surface-2 transition-shadow hover:shadow-md" aria-label="View receipt full size">
            <img src={expense.receiptUrl} alt={`Receipt for ${expense.title}`} className="max-h-72 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.02]" />
          </button>
        </Card>
      )}

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={onDelete} loading={del.isPending} destructive
        title="Delete this expense?" description={`${expense.title} (${formatINR(expense.amount)}) will be removed and everyone’s balances will update. You can undo right after.`} confirmLabel="Delete expense" />
      <Modal open={receipt} onClose={() => setReceipt(false)} title="Receipt" className="max-w-md">
        <img src={expense.receiptUrl} alt={`Receipt for ${expense.title}`} className="mx-auto max-h-[65dvh] rounded-md border border-line" />
      </Modal>
    </div>
  )
}
