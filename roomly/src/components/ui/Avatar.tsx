import { cn } from '@/utils/cn'
import { initials } from '@/utils/format'

const sizes = {
  xs: 'h-5 w-5 text-[9px]', sm: 'h-7 w-7 text-[11px]', md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm', xl: 'h-20 w-20 text-2xl',
}
export type AvatarSize = keyof typeof sizes
interface Person { name: string; tone?: number }

export function Avatar({ person, size = 'md', className, ring }: { person: Person; size?: AvatarSize; className?: string; ring?: boolean }) {
  const tone = person.tone ?? 6
  return (
    <span
      aria-hidden
      title={person.name}
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold', sizes[size], ring && 'ring-2 ring-surface', className)}
      style={{ background: `rgb(var(--tone-${tone}-bg))`, color: `rgb(var(--tone-${tone}-fg))` }}
    >
      {initials(person.name)}
    </span>
  )
}

export function AvatarStack({ people, max = 4, size = 'sm' }: { people: Person[]; max?: number; size?: AvatarSize }) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <span className="inline-flex items-center" role="img" aria-label={`${people.length} members`}>
      {shown.map((p, i) => <Avatar key={i} person={p} size={size} ring className={i > 0 ? '-ml-2' : ''} />)}
      {extra > 0 && <span className={cn('-ml-2 inline-flex items-center justify-center rounded-full bg-surface-2 font-medium text-muted ring-2 ring-surface', sizes[size])}>+{extra}</span>}
    </span>
  )
}
