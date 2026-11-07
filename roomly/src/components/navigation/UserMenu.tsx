import { History, LogOut, Monitor, Moon, Settings, Sun, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Dropdown, MenuDivider, MenuItem } from '@/components/ui/Dropdown'
import { useMembers } from '@/hooks/queries'
import { useAuth } from '@/store/AuthProvider'
import { useTheme, type ThemePref } from '@/store/ThemeProvider'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/utils/cn'

const THEMES: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function UserMenu() {
  const { user, logout } = useAuth()
  const { byId } = useMembers()
  const { pref, setPref } = useTheme()
  const navigate = useNavigate()
  if (!user) return null
  const me = byId(user.id)
  const me2 = { ...me, name: me.name === 'Former member' ? user.name : me.name }

  return (
    <Dropdown
      panelClassName="w-64"
      trigger={({ toggle, props }) => (
        <button onClick={toggle} {...props} aria-label="Account menu" className="rounded-full transition-transform active:scale-95"><Avatar person={me2} size="md" /></button>
      )}
    >
      {({ close }) => (
        <>
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <MenuDivider />
          <MenuItem icon={<Users size={16} />} onClick={() => { close(); navigate(ROUTES.members) }}>Members</MenuItem>
          <MenuItem icon={<History size={16} />} onClick={() => { close(); navigate(ROUTES.history) }}>History</MenuItem>
          <MenuItem icon={<Settings size={16} />} onClick={() => { close(); navigate(ROUTES.settings) }}>Settings</MenuItem>
          <MenuDivider />
          <div className="flex gap-1 px-1 py-1" role="group" aria-label="Theme">
            {THEMES.map((t) => (
              <button key={t.value} role="menuitem" aria-pressed={pref === t.value} onClick={() => setPref(t.value)} aria-label={`${t.label} theme`}
                className={cn('flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent', pref === t.value ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg')}>
                <t.icon size={15} />
              </button>
            ))}
          </div>
          <MenuDivider />
          <MenuItem danger icon={<LogOut size={16} />} onClick={async () => { close(); await logout(); navigate(ROUTES.login) }}>Log out</MenuItem>
        </>
      )}
    </Dropdown>
  )
}
