import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

interface FieldProps {
  label?: string
  hint?: string
  error?: string
  optional?: boolean
  children: (a: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
  className?: string
}

/** Label + control + hint/error wiring, so every form field is announced correctly. */
export function Field({ label, hint, error, optional, children, className }: FieldProps) {
  const id = useId()
  const msgId = `${id}-msg`
  const describedBy = error || hint ? msgId : undefined
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="flex items-baseline justify-between text-[13px] font-medium">
          <span>{label}</span>
          {optional && <span className="text-xs font-normal text-subtle">Optional</span>}
        </label>
      )}
      {children({ id, describedBy, invalid: !!error })}
      {(error || hint) && (
        <p id={msgId} role={error ? 'alert' : undefined} className={cn('text-xs', error ? 'text-danger' : 'text-muted')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

const control =
  'w-full rounded-md border bg-surface px-3.5 text-[15px] text-fg placeholder:text-subtle transition-[border-color,box-shadow] duration-150 ' +
  'hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60'
const state = (invalid: boolean) => (invalid ? 'border-danger/60 focus:border-danger focus:ring-danger/15' : 'border-line')

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label?: string; hint?: string; error?: string; optional?: boolean
  leading?: ReactNode; trailing?: ReactNode
  inputClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, optional, leading, trailing, className, inputClassName, ...rest }, ref,
) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {leading && <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">{leading}</span>}
          <input
            id={id} ref={ref} aria-invalid={invalid || undefined} aria-describedby={describedBy}
            className={cn(control, state(invalid), 'h-11', leading ? 'pl-10' : undefined, trailing ? 'pr-11' : undefined, inputClassName)}
            {...rest}
          />
          {trailing && <span className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</span>}
        </div>
      )}
    </Field>
  )
})

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> { label?: string; hint?: string; error?: string; optional?: boolean }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, optional, className, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} ref={ref} rows={3} aria-invalid={invalid || undefined} aria-describedby={describedBy}
          className={cn(control, state(invalid), 'resize-none py-2.5')} {...rest} />
      )}
    </Field>
  )
})

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> { label?: string; hint?: string; error?: string; optional?: boolean }
/** Native <select> — the best possible mobile experience — dressed in the design system. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, hint, error, optional, className, children, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select id={id} ref={ref} aria-invalid={invalid || undefined} aria-describedby={describedBy}
            className={cn(control, state(invalid), 'h-11 cursor-pointer appearance-none pr-10')} {...rest}>
            {children}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        </div>
      )}
    </Field>
  )
})
