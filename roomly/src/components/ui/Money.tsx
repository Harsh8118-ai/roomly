import { cn } from '@/utils/cn'
import { formatINR, formatSigned } from '@/utils/format'

export const balanceTone = (n: number) => (n > 0 ? 'text-success' : n < 0 ? 'text-danger' : 'text-fg')

/** Tabular, coloured money. `signed` shows +/− and colours by sign. */
export function Money({ value, signed, className, colored = true }: { value: number; signed?: boolean; className?: string; colored?: boolean }) {
  return (
    <span className={cn('tnum', signed && colored && balanceTone(value), className)}>
      {signed ? formatSigned(value) : formatINR(value)}
    </span>
  )
}
