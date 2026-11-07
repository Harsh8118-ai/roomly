import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/store/AuthProvider'
import { useHousehold } from '@/hooks/queries'
import { greeting, monthLabel } from '@/utils/date'
import { firstName } from '@/utils/format'
import { ROUTES } from '@/constants/routes'
import type { MonthKey } from '@/types'

export function DashboardHeader({ month }: { month: MonthKey }) {
  const { user } = useAuth()
  const { data: household } = useHousehold()
  return (
    <header className="hidden items-end justify-between gap-4 md:flex">
      <div>
        <h1 className="t-page">{greeting()}, {user ? firstName(user.name) : ''} 👋</h1>
        <p className="mt-1.5 text-sm text-muted">Here’s what’s happening at home. <span className="text-subtle">·</span> {household?.name} <span className="text-subtle">·</span> {monthLabel(month)}</p>
      </div>
      <Link to={ROUTES.wrapped(month)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-medium transition-colors hover:border-accent hover:text-accent-strong">
        <Sparkles size={14} aria-hidden /> Roomly Wrapped
      </Link>
    </header>
  )
}
