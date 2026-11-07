import { useId } from 'react'
import { cn } from '@/utils/cn'

/**
 * The ROOMLY mark: one home, four rooms. The roof is a single shape; the
 * cross-shaped gap divides it into four shared spaces, one of them lit.
 * Works in monochrome (currentColor) and in light/dark.
 */
export function LogoMark({ size = 28, className, mono }: { size?: number; className?: string; mono?: boolean }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={cn('shrink-0', className)} aria-hidden>
      <defs>
        <mask id={id}>
          <rect width="24" height="24" fill="#fff" />
          <rect x="11.1" y="0" width="1.8" height="24" fill="#000" />
          <rect x="0" y="12.1" width="24" height="1.8" fill="#000" />
        </mask>
      </defs>
      <path mask={`url(#${id})`} fill="currentColor" d="M12 2 21.6 9.6V20a1.6 1.6 0 0 1-1.6 1.6H4A1.6 1.6 0 0 1 2.4 20V9.6Z" />
      <path d="M12.9 13.9H20a.6.6 0 0 1 .6.6v5.1a.6.6 0 0 1-.6.6h-7.1Z" fill={mono ? 'currentColor' : 'rgb(var(--accent))'} />
    </svg>
  )
}

export function Logo({ size = 26, className, showWord = true }: { size?: number; className?: string; showWord?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-fg', className)}>
      <LogoMark size={size} />
      {showWord && <span className="text-[1.05rem] font-semibold tracking-[-0.03em]">Roomly</span>}
    </span>
  )
}
