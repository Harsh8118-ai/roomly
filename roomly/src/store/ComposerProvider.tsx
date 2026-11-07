import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Expense } from '@/types'

interface ComposerCtx {
  open: boolean
  editing: Expense | null
  openNew: () => void
  openEdit: (e: Expense) => void
  close: () => void
}
const Ctx = createContext<ComposerCtx | null>(null)

/** UI state for the Add / Edit expense sheet, so any screen can open it. */
export function ComposerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; editing: Expense | null }>({ open: false, editing: null })
  const openNew = useCallback(() => setState({ open: true, editing: null }), [])
  const openEdit = useCallback((e: Expense) => setState({ open: true, editing: e }), [])
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])
  const value = useMemo(() => ({ ...state, openNew, openEdit, close }), [state, openNew, openEdit, close])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useComposer = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useComposer must be used inside ComposerProvider')
  return v
}
