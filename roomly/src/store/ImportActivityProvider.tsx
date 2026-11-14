import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type ImportPhase = 'reading' | 'mapping' | 'importing' | 'complete'
interface ImportActivity {
  active: boolean
  phase: ImportPhase
  filename: string
  imported: number
  total: number
  duplicates: number
  start: (filename: string) => void
  update: (phase: ImportPhase) => void
  finish: (stats: { imported: number; total: number; duplicates: number }) => void
  clear: () => void
}
const Context = createContext<ImportActivity | null>(null)

export function ImportActivityProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const [phase, setPhase] = useState<ImportPhase>('reading')
  const [filename, setFilename] = useState('')
  const [imported, setImported] = useState(0)
  const [total, setTotal] = useState(0)
  const [duplicates, setDuplicates] = useState(0)
  const value = useMemo<ImportActivity>(() => ({
    active, phase, filename, imported, total, duplicates,
    start: (name) => { setFilename(name); setPhase('reading'); setImported(0); setTotal(0); setDuplicates(0); setActive(true) },
    update: setPhase,
    finish: (stats) => { setImported(stats.imported); setTotal(stats.total); setDuplicates(stats.duplicates); setPhase('complete'); setActive(false) },
    clear: () => { setActive(false); setPhase('reading'); setFilename(''); setImported(0); setTotal(0); setDuplicates(0) },
  }), [active, phase, filename, imported, total, duplicates])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useImportActivity() {
  const value = useContext(Context)
  if (!value) throw new Error('useImportActivity must be used inside ImportActivityProvider')
  return value
}
