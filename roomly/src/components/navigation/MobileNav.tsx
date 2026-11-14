import { NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useComposer } from '@/store/ComposerProvider'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import { MOBILE_NAV } from './navItems'
import { ROUTES } from '@/constants/routes'

/** Bottom tab navigation. Expenses are added through WhatsApp chat imports. */
export function MobileNav() {
  const { openNew } = useComposer()
  return (
    <>
      <button onClick={openNew} aria-label="Add expense manually" className="fixed bottom-[76px] right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-accent-strong text-on-accent shadow-lg md:hidden"><Plus size={22}/></button>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {MOBILE_NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === ROUTES.dashboard} className={({ isActive }) => cn('relative flex h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors', isActive ? 'text-fg' : 'text-subtle')}>
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="mobile-nav-dot" className="absolute top-0 h-0.5 w-8 rounded-full bg-accent-strong" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                    <item.icon size={21} strokeWidth={isActive ? 2.2 : 1.75} aria-hidden />
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
