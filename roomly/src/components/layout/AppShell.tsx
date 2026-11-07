import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/navigation/Sidebar'
import { Header } from '@/components/navigation/Header'
import { MobileNav } from '@/components/navigation/MobileNav'
import { CommandMenu } from '@/components/navigation/CommandMenu'
import { ExpenseComposer } from '@/components/expenses/ExpenseComposer'
import { useComposer } from '@/store/ComposerProvider'
import { useHotkey } from '@/hooks/useHotkeys'
import { useLiveUpdates } from '@/hooks/useLiveUpdates'
import { PageTransition } from './PageTransition'

export function AppShell() {
  const [cmdOpen, setCmdOpen] = useState(false)
  const { openNew } = useComposer()
  const { pathname } = useLocation()
  useLiveUpdates()

  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen((o) => !o) }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  useHotkey('n', useCallback((e) => { e.preventDefault(); openNew() }, [openNew]))

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-fg focus:px-3 focus:py-2 focus:text-bg">Skip to content</a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenCommand={() => setCmdOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-40 pt-6 md:px-8 md:pb-16 md:pt-8">
          <PageTransition key={pathname}><Outlet /></PageTransition>
        </main>
      </div>
      <MobileNav />
      <ExpenseComposer />
      <CommandMenu open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  )
}
