import { useLocation } from 'react-router-dom'
import { Command, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { LogoMark } from '@/components/ui/Logo'
import { useHousehold } from '@/hooks/queries'
import { useAuth } from '@/store/AuthProvider'
import { useComposer } from '@/store/ComposerProvider'
import { currentMonth, greeting, monthLabel } from '@/utils/date'
import { firstName } from '@/utils/format'
import { NotificationMenu } from './NotificationMenu'
import { UserMenu } from './UserMenu'
import { ROUTES } from '@/constants/routes'

const TITLES: [string, string][] = [
  ['/app/expenses', 'Expenses'], ['/app/settlement', 'Settlement'], ['/app/members', 'Group'],
  ['/app/history', 'History'], ['/app/settings', 'Settings'],
]

export function Header({ onOpenCommand }: { onOpenCommand: () => void }) {
  const { user } = useAuth()
  const { data: household } = useHousehold()
  const { openNew } = useComposer()
  const { pathname } = useLocation()
  const isHome = pathname === ROUTES.dashboard
  const title = TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? ''
  const context = `${household?.name ?? ''} · ${monthLabel(currentMonth())}`
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-8">
        <LogoMark size={26} className="text-fg md:hidden" />
        <div className="min-w-0 flex-1">
          {/* Mobile: contextual greeting / page title */}
          <div className="md:hidden">
            <p className="truncate text-[15px] font-semibold leading-tight">{isHome && user ? `${greeting()}, ${firstName(user.name)} 👋` : title || household?.name}</p>
            <p className="truncate text-xs text-muted">{context}</p>
          </div>
          {/* Desktop: household · month */}
          <div className="hidden items-baseline gap-2 md:flex">
            <span className="text-[15px] font-semibold">{household?.name}</span>
            <span className="text-sm text-muted">{monthLabel(currentMonth())}</span>
          </div>
        </div>

        <button
          onClick={onOpenCommand}
          className="hidden h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-fg md:flex"
          aria-label="Open command menu"
        >
          <Search size={14} aria-hidden /> Search or jump to…
          <kbd className="ml-4 flex items-center gap-0.5 rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium">{isMac ? <Command size={10} /> : 'Ctrl'}K</kbd>
        </button>
        <IconButton label="Search" className="md:hidden" onClick={onOpenCommand}><Search size={19} /></IconButton>
        <Button className="hidden md:inline-flex" size="md" leftIcon={<Plus size={16} strokeWidth={2.5} />} onClick={openNew}>Add expense</Button>
        <NotificationMenu />
        <UserMenu />
      </div>
    </header>
  )
}
