import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import { Logo, LogoMark } from '@/components/ui/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { useAuth } from '@/store/AuthProvider'
import { useMembers } from '@/hooks/queries'
import { cn } from '@/utils/cn'
import { NAV_ITEMS, SETTINGS_ITEM } from './navItems'
import { HouseholdSwitcher } from './HouseholdSwitcher'
import { ROUTES } from '@/constants/routes'

const KEY = 'roomly.sidebar'

function Item({ item, collapsed }: { item: { to: string; label: string; icon: LucideIcon }; collapsed: boolean }) {
  const link = (
    <NavLink
      to={item.to} end={item.to === ROUTES.dashboard}
      className={({ isActive }) => cn('group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors', collapsed && 'justify-center px-0', isActive ? 'text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg')}
    >
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-md bg-surface shadow-sm ring-1 ring-line" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          {isActive && <motion.span layoutId="sidebar-bar" className="absolute -left-3 top-2.5 h-5 w-[3px] rounded-full bg-accent" />}
          <item.icon size={18} strokeWidth={isActive ? 2 : 1.75} className="relative shrink-0" aria-hidden />
          {!collapsed && <span className="relative">{item.label}</span>}
        </>
      )}
    </NavLink>
  )
  return collapsed ? <Tooltip label={item.label} side="right">{link}</Tooltip> : link
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(KEY) === '1')
  const { user } = useAuth()
  const { byId } = useMembers()
  const me = user ? byId(user.id) : null
  const toggle = () => setCollapsed((c) => { localStorage.setItem(KEY, c ? '0' : '1'); return !c })

  return (
    <aside
      className={cn('sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg px-3 py-4 transition-[width] duration-300 ease-out md:flex', collapsed ? 'w-[76px]' : 'w-[264px]')}
      aria-label="Primary"
    >
      <div className={cn('mb-5 flex items-center px-2', collapsed ? 'justify-center' : 'justify-between')}>
        <Link to={ROUTES.dashboard} aria-label="Roomly home">{collapsed ? <LogoMark size={26} className="text-fg" /> : <Logo />}</Link>
        {!collapsed && (
          <button onClick={toggle} aria-label="Collapse sidebar" className="rounded-sm p-1.5 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"><PanelLeftClose size={16} /></button>
        )}
      </div>
      <HouseholdSwitcher collapsed={collapsed} />
      <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="Main">
        <div className="flex flex-col gap-1">{NAV_ITEMS.map((i) => <Item key={i.to} item={i} collapsed={collapsed} />)}</div>
        <div className="mt-auto flex flex-col gap-1">
          {collapsed && (
            <button onClick={toggle} aria-label="Expand sidebar" className="mb-1 flex h-10 items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"><PanelLeftOpen size={18} /></button>
          )}
          <Item item={SETTINGS_ITEM} collapsed={collapsed} />
        </div>
      </nav>
      {me && (
        <Link to={ROUTES.settings} className={cn('mt-4 flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5 transition-colors hover:border-line-strong', collapsed && 'justify-center border-transparent bg-transparent p-1')}>
          <Avatar person={me} size="md" />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium leading-tight">{me.name}</span>
              <span className="block text-xs text-muted">{me.role === 'admin' ? 'Admin' : 'Member'} · Active</span>
            </span>
          )}
        </Link>
      )}
    </aside>
  )
}
