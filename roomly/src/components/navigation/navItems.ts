import { FileUp, Home, LayoutDashboard, Link2, Receipt, Scale, Settings, Users } from 'lucide-react'
import { ROUTES } from '@/constants/routes'

/** Keep the primary navigation focused on the four actions people use most. */
export const NAV_ITEMS = [
  { to: ROUTES.dashboard, label: 'Overview', icon: LayoutDashboard },
  { to: ROUTES.expenses, label: 'Expenses', icon: Receipt },
  { to: ROUTES.settlement, label: 'Settlement', icon: Scale },
  { to: ROUTES.members, label: 'Group', icon: Users },
  { to: ROUTES.imports, label: 'Import chat', icon: FileUp },
  { to: ROUTES.sharing, label: 'Share dashboard', icon: Link2 },
]
export const SETTINGS_ITEM = { to: ROUTES.settings, label: 'Settings', icon: Settings }

export const MOBILE_NAV = [
  { to: ROUTES.dashboard, label: 'Home', icon: Home },
  { to: ROUTES.expenses, label: 'Expenses', icon: Receipt },
  { to: ROUTES.settlement, label: 'Settle', icon: Scale },
  { to: ROUTES.members, label: 'Group', icon: Users },
]
