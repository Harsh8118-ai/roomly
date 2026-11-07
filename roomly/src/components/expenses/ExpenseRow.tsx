import { memo } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Paperclip } from 'lucide-react'
import { CategoryIcon } from '@/components/common/CategoryIcon'
import { CATEGORY_MAP } from '@/constants/categories'
import { ROUTES } from '@/constants/routes'
import { formatDate } from '@/utils/date'
import { firstName } from '@/utils/format'
import { Money } from '@/components/ui/Money'
import type { Expense, Member } from '@/types'

interface Props { expense: Expense; payer: Member; isMe?: boolean; hideDate?: boolean }

export const ExpenseRow = memo(function ExpenseRow({ expense, payer, isMe, hideDate }: Props) {
  return (
    <Link to={ROUTES.expense(expense.id)} className="group flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2 sm:py-3.5">
      <CategoryIcon category={expense.category} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[15px] font-medium leading-tight">
          <span className="truncate">{expense.title}</span>
          {expense.source === 'whatsapp' && <MessageCircle size={12} className="shrink-0 text-accent-strong" aria-label="Added from WhatsApp" />}
          {expense.receiptUrl && <Paperclip size={12} className="shrink-0 text-subtle" aria-label="Has receipt" />}
        </p>
        <p className="t-small mt-1 truncate text-muted">
          {isMe ? 'You' : firstName(payer.name)} · {hideDate ? CATEGORY_MAP[expense.category].label : formatDate(expense.date)}
        </p>
      </div>
      <Money value={expense.amount} className="text-[15px] font-semibold" />
    </Link>
  )
})
