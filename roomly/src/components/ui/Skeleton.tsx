import { cn } from '@/utils/cn'

export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn('skeleton', className)} />

export const SkeletonCard = ({ className, lines = 2 }: { className?: string; lines?: number }) => (
  <div className={cn('card space-y-3 p-5', className)} aria-busy="true" aria-label="Loading">
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-9 w-2/3" />
    {Array.from({ length: lines - 1 }).map((_, i) => <Skeleton key={i} className="h-3 w-1/2" />)}
  </div>
)

export const SkeletonRow = () => (
  <div className="flex items-center gap-3 px-4 py-3.5" aria-hidden>
    <Skeleton className="h-10 w-10 rounded-md" />
    <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-3 w-1/4" /></div>
    <Skeleton className="h-4 w-16" />
  </div>
)

export const SkeletonList = ({ rows = 6 }: { rows?: number }) => (
  <div className="card divide-y divide-line overflow-hidden" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
  </div>
)

const BAR_HEIGHTS = [40, 65, 50, 80, 45, 70, 55, 90, 60, 75, 50, 66]
export const SkeletonChart = ({ className }: { className?: string }) => (
  <div className={cn('card p-5', className)} aria-busy="true" aria-label="Loading chart">
    <Skeleton className="mb-6 h-4 w-40" />
    <div className="flex h-48 items-end gap-2">
      {BAR_HEIGHTS.map((h, i) => <Skeleton key={i} className="flex-1 rounded-sm" />).map((_, i) => (
        <div key={i} className="flex-1" style={{ height: `${BAR_HEIGHTS[i]}%` }}><Skeleton className="h-full w-full rounded-sm" /></div>
      ))}
    </div>
  </div>
)
