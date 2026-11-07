import { useEffect } from 'react'

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

/** Single-key shortcuts that never fire while typing or with modifiers held. */
export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const on = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase() || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (document.body.style.overflow === 'hidden') return // a dialog is open
      handler(e)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [key, handler, enabled])
}
