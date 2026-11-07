import { History, Home, LayoutDashboard, Receipt, Scale, Settings, Users } from 'lucide-react'
import { ROUTES } from '@/constants/routes'

export const NAV_ITEMS = [
  { to: ROUTES.dashboard, label: 'Overview', icon: LayoutDashboard },
  { to: ROUTES.expenses, label: 'Expenses', icon: Receipt },
  { to: ROUTES.settlement, label: 'Settlement', icon: Scale },
  { to: ROUTES.members, label: 'Members', icon: Users },
  { to: ROUTES.history, label: 'History', icon: History },
]
export const SETTINGS_ITEM = { to: ROUTES.settings, label: 'Settings', icon: Settings }

export const MOBILE_NAV = [
  { to: ROUTES.dashboard, label: 'Home', icon: Home },
  { to: ROUTES.expenses, label: 'Expenses', icon: Receipt },
  { to: ROUTES.settlement, label: 'Settle', icon: Scale },
  { to: ROUTES.settings, label: 'Profile', icon: Settings },
]
