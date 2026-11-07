import { CATEGORY_MAP } from '@/constants/categories'
import type { CategoryId } from '@/types'
import { cn } from '@/utils/cn'

const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' }
const iconSizes = { sm: 15, md: 18, lg: 22 }

export function CategoryIcon({ category, size = 'md', className }: { category: CategoryId; size?: keyof typeof sizes; className?: string }) {
  const Icon = CATEGORY_MAP[category].icon
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg/80', sizes[size], className)} aria-hidden>
      <Icon size={iconSizes[size]} strokeWidth={1.75} />
    </span>
  )
}
