import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'secondary'
  children: ReactNode
}
const sizes = { sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-11 w-11' }

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, size = 'md', variant = 'ghost', className, children, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref} type={type} aria-label={label} title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-[background-color,color,transform] duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-50',
        variant === 'ghost' ? 'text-muted hover:bg-surface-2 hover:text-fg' : 'border border-line-strong bg-surface text-fg hover:bg-surface-2',
        sizes[size], className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})
