import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger' | 'soft'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-strong text-on-accent hover:brightness-[1.08] shadow-xs',
  dark: 'bg-fg text-bg hover:opacity-90 shadow-xs',
  secondary: 'border border-line-strong bg-surface text-fg hover:bg-surface-2 shadow-xs',
  soft: 'bg-accent-soft text-accent-strong hover:brightness-[0.97]',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger text-white hover:brightness-[1.06] shadow-xs',
}
const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-sm px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-md px-4 text-sm',
  lg: 'h-12 gap-2 rounded-md px-6 text-[15px]',
}

export const buttonClasses = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) =>
  cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,filter,transform,opacity,box-shadow] duration-150 ease-out',
    'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
    variants[variant], sizes[size], extra,
  )

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingText?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, loadingText, leftIcon, rightIcon, fullWidth, className, children, disabled, type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={buttonClasses(variant, size, cn(fullWidth && 'w-full', className))} {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 14 : 16} /> : leftIcon}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && rightIcon}
    </button>
  )
})

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}
export function LinkButton({ variant = 'primary', size = 'md', leftIcon, rightIcon, fullWidth, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClasses(variant, size, cn(fullWidth && 'w-full', className))} {...rest}>
      {leftIcon}<span>{children}</span>{rightIcon}
    </Link>
  )
}
