import { cn } from '@/utils/cn'

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="t-small mt-0.5 text-muted">{description}</p>}
      </div>
      <button
        role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50', checked ? 'bg-accent-strong' : 'bg-line-strong')}
      >
        <span className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out', checked && 'translate-x-4')} />
      </button>
    </div>
  )
}
