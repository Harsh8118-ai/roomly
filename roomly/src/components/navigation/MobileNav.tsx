import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useComposer } from '@/store/ComposerProvider'
import { MOBILE_NAV } from './navItems'
import { ROUTES } from '@/constants/routes'

/** Bottom tab bar + a thumb-reachable floating "Add expense" button. */
export function MobileNav() {
  const { openNew } = useComposer()
  return (
    <>
      <motion.button
        onClick={openNew} aria-label="Add expense" whileTap={{ scale: 0.92 }}
        initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 24, delay: 0.2 }}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 items-center gap-2 rounded-xl bg-accent-strong pl-4 pr-5 text-sm font-semibold text-on-accent shadow-lg md:hidden"
      >
        <Plus size={20} strokeWidth={2.5} aria-hidden /> Add expense
      </motion.button>
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
