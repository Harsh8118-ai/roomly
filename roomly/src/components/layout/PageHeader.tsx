import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

interface Props { title: string; description?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }

export function PageHeader({ title, description, actions, back }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-8">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-muted transition-colors hover:text-fg">
            <ChevronLeft size={15} aria-hidden />{back.label}
          </Link>
        )}
        <h1 className="t-page">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
