import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { History, Home, LayoutDashboard, MessageCircle, Moon, Plus, Receipt, Scale, Search, Settings, Users, Building2, type LucideIcon } from 'lucide-react'
import { useHouseholds } from '@/hooks/queries'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { householdService } from '@/services/householdService'
import { useAuth, ME_KEY } from '@/store/AuthProvider'
import { useComposer } from '@/store/ComposerProvider'
import { useTheme } from '@/store/ThemeProvider'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/utils/cn'

interface Cmd { id: string; label: string; icon: LucideIcon; hint?: string; keywords?: string; run: () => void }

export function CommandMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const { data: households = [] } = useHouseholds()
  const { openNew } = useComposer()
  const { resolved, setPref } = useTheme()
  useFocusTrap(ref, open, onClose)

  useEffect(() => { if (open) { setQ(''); setIndex(0) } }, [open])

  const go = (to: string) => () => navigate(to)
  const commands = useMemo<Cmd[]>(() => {
    const base: Cmd[] = [
      { id: 'add', label: 'Add expense', icon: Plus, hint: 'N', keywords: 'new create purchase', run: openNew },
      { id: 'search', label: 'Search expenses', icon: Search, hint: '/', keywords: 'find', run: go(ROUTES.expenses) },
      { id: 'settle', label: 'View settlement', icon: Scale, keywords: 'owe balance pay', run: go(ROUTES.settlement) },
      { id: 'home', label: 'Go to overview', icon: LayoutDashboard, keywords: 'dashboard home', run: go(ROUTES.dashboard) },
      { id: 'expenses', label: 'Go to expenses', icon: Receipt, run: go(ROUTES.expenses) },
      { id: 'members', label: 'Go to members', icon: Users, keywords: 'housemates', run: go(ROUTES.members) },
      { id: 'history', label: 'Go to history', icon: History, keywords: 'months reports', run: go(ROUTES.history) },
      { id: 'wrapped', label: 'Open Roomly Wrapped', icon: Home, keywords: 'recap story october', run: go(ROUTES.wrapped('2026-10')) },
      { id: 'whatsapp', label: 'Set up WhatsApp', icon: MessageCircle, keywords: 'link number group bot text', run: go(`${ROUTES.settings}#whatsapp`) },
      { id: 'settings', label: 'Open settings', icon: Settings, keywords: 'profile account', run: go(ROUTES.settings) },
      { id: 'theme', label: resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode', icon: Moon, keywords: 'theme appearance', run: () => setPref(resolved === 'dark' ? 'light' : 'dark') },
    ]
    const hh: Cmd[] = households.map((h) => ({
      id: `hh-${h.id}`, label: `Switch to ${h.name}`, icon: Building2, keywords: 'household switch',
      run: async () => {
        if (h.id === user?.currentHouseholdId) return
        qc.setQueryData(ME_KEY, await householdService.switchTo(h.id)); navigate(ROUTES.dashboard)
      },
    }))
    return [...base, ...hh]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [households, resolved, user?.currentHouseholdId])

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    const filtered = t ? commands.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(t)) : commands
    if (!t) return filtered
    const searchCmd: Cmd = { id: 'q', label: `Search expenses for “${q.trim()}”`, icon: Search, run: () => navigate(`${ROUTES.expenses}?q=${encodeURIComponent(q.trim())}`) }
    return [...filtered, searchCmd]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, commands])

  useEffect(() => setIndex(0), [q])
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [index])

  const run = (c?: Cmd) => { if (!c) return; onClose(); setTimeout(c.run, 60) }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => (i + 1) % results.length) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => (i - 1 + results.length) % results.length) }
    if (e.key === 'Enter') { e.preventDefault(); run(results[index]) }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.div
            ref={ref} role="dialog" aria-modal="true" aria-label="Command menu" tabIndex={-1}
            initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-elevated shadow-lg"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={17} className="text-muted" aria-hidden />
              <input
                data-autofocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
                placeholder="Type a command or search…" aria-label="Search commands"
                role="combobox" aria-expanded aria-controls="cmd-list" aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
              />
              <kbd className="rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
            </div>
            <div ref={listRef} id="cmd-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {results.map((c, i) => (
                <button
                  key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === index}
                  onMouseMove={() => setIndex(i)} onClick={() => run(c)}
                  className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors', i === index ? 'bg-surface-2' : '')}
                >
                  <c.icon size={16} className="text-muted" aria-hidden />
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <kbd className="rounded-xs border border-line bg-surface px-1.5 py-0.5 text-[11px] text-muted">{c.hint}</kbd>}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
