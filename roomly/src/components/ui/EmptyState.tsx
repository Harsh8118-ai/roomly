import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from './Button'

interface EmptyProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
  compact?: boolean
}

export function EmptyState({ icon: Icon, title, description, action, className, compact }: EmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-6 py-10' : 'px-6 py-16', className)}>
      <div className="relative mb-5">
        <div className="absolute inset-0 -m-3 rounded-2xl border border-dashed border-line-strong" aria-hidden />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          <Icon size={24} strokeWidth={1.75} aria-hidden />
        </div>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong.', description = 'We couldn’t load this right now.', onRetry, className }: { title?: string; description?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('card flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-danger-soft text-danger"><AlertTriangle size={22} aria-hidden /></div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-muted">{description}</p>
      {onRetry && <Button variant="secondary" className="mt-5" onClick={onRetry}>Try again</Button>}
    </div>
  )
}
