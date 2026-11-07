import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/Field'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> { label?: string; hint?: string; error?: string }

export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false)
  return (
    <Input
      ref={ref} type={show ? 'text' : 'password'} {...props}
      trailing={
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
          className="grid h-8 w-8 place-items-center rounded-sm text-muted transition-colors hover:text-fg">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  )
})
