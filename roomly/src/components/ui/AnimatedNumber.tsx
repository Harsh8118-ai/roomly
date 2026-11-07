import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

/** Tweens between values — used for every headline money figure so changes feel connected. */
export function AnimatedNumber({ value, format, duration = 0.9, className }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(reduce ? value : 0)
  const from = useRef(reduce ? value : 0)

  useEffect(() => {
    if (reduce) { setDisplay(value); return }
    const controls = animate(from.current, value, {
      duration, ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => { from.current = v; setDisplay(v) },
    })
    return () => controls.stop()
  }, [value, duration, reduce])

  return <span className={className} aria-label={format(value)}><span aria-hidden>{format(display)}</span></span>
}
