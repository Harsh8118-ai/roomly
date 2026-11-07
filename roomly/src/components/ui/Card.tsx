import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type Variant = 'standard' | 'primary' | 'interactive' | 'insight'
const variants: Record<Variant, string> = {
  standard: 'card',
  primary: 'rounded-2xl border border-line bg-surface shadow-sm',
  interactive: 'card card-hover cursor-pointer',
  insight: 'rounded-xl border border-accent/20 bg-accent-soft',
}

interface Props extends HTMLAttributes<HTMLDivElement> { variant?: Variant }
export const Card = forwardRef<HTMLDivElement, Props>(function Card({ variant = 'standard', className, ...rest }, ref) {
  return <div ref={ref} className={cn(variants[variant], className)} {...rest} />
})

export function CardHeader({ title, action, subtitle, className }: { title: string; subtitle?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="t-section">{title}</h2>
        {subtitle && <p className="t-small mt-0.5 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
