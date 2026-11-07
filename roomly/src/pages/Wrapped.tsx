import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { ChevronLeft, ChevronRight, Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Avatar } from '@/components/ui/Avatar'
import { ErrorState } from '@/components/ui/EmptyState'
import { LogoMark } from '@/components/ui/Logo'
import { CATEGORY_MAP } from '@/constants/categories'
import { ROUTES } from '@/constants/routes'
import { useMembers, useSummary } from '@/hooks/queries'
import { useToast } from '@/store/ToastProvider'
import { copyToClipboard } from '@/utils/clipboard'
import { monthLabel } from '@/utils/date'
import { formatINR, formatNumber } from '@/utils/format'

const DURATION = 7000

export function WrappedPage() {
  const { month = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const reduce = useReducedMotion()
  const { data: s, isPending, isError, refetch } = useSummary(month)
  const { household, byId } = useMembers()
  const [[i, dir], setPos] = useState<[number, number]>([0, 1])
  const [paused, setPaused] = useState(false)

  const top = s?.byCategory[0]
  const buyer = useMemo(() => s?.byMember.slice().sort((a, b) => b.count - a.count)[0], [s])
  const buyerMember = buyer ? byId(buyer.memberId) : null
  const name = monthLabel(month, { year: false })
  const back = useCallback(() => navigate(ROUTES.history + (month ? `/${month}` : '')), [navigate, month])

  const screens = useMemo(() => {
    if (!s) return []
    const busy = s.expenseCount >= 40
    return [
      { bg: '--story-1', node: (
        <div><p className="text-sm tracking-wide opacity-70">{household?.name?.toUpperCase()}</p><h1 className="t-display mt-3">{monthLabel(month)}</h1>
          <p className="mt-6 max-w-xs text-xl opacity-80">Let’s see how your household spent the month.</p></div>) },
      { bg: '--story-2', node: (
        <div><AnimatedNumber value={s.total} format={formatINR} duration={1.4} className="tnum t-display block" /><p className="mt-4 text-2xl opacity-80">spent together</p></div>) },
      { bg: '--story-3', node: (
        <div><AnimatedNumber value={s.expenseCount} format={formatNumber} duration={1.2} className="tnum t-display block !text-[6rem] sm:!text-[8rem]" /><p className="mt-2 text-2xl opacity-80">purchases</p>
          <p className="mt-8 max-w-xs opacity-60">That’s about {(s.expenseCount / 30).toFixed(1)} a day, every day.</p></div>) },
      { bg: '--story-4', node: top ? (
        <div>{(() => { const Icon = CATEGORY_MAP[top.category].icon; return <Icon size={44} strokeWidth={1.4} className="mb-6 opacity-80" /> })()}
          <h2 className="t-display">{CATEGORY_MAP[top.category].label}</h2><p className="tnum mt-3 text-4xl font-semibold">{formatINR(top.total)}</p><p className="mt-4 text-xl opacity-75">Your biggest category.</p></div>) : null },
      { bg: '--story-5', node: buyerMember && buyer ? (
        <div><Avatar person={buyerMember} size="xl" className="mb-6" /><h2 className="t-display">{buyerMember.name.split(' ')[0]}</h2>
          <p className="tnum mt-3 text-4xl font-semibold">{buyer.count} purchases</p><p className="mt-4 text-xl opacity-75">Most active buyer.</p></div>) : null },
      { bg: '--story-1', node: (
        <div><LogoMark size={40} className="mb-6" /><h2 className="t-large">{name} was a {busy ? 'busy' : 'calm'} month.</h2>
          <dl className="mt-8 grid max-w-sm grid-cols-2 gap-x-6 gap-y-5">
            {[['Total', formatINR(s.total)], ['Purchases', String(s.expenseCount)], ['Top category', top ? CATEGORY_MAP[top.category].label : '—'], ['Most active', buyerMember?.name.split(' ')[0] ?? '—']].map(([k, v]) => (
              <div key={k}><dt className="text-sm opacity-60">{k}</dt><dd className="tnum text-xl font-semibold">{v}</dd></div>))}
          </dl>
          <Button variant="secondary" size="lg" className="mt-10" leftIcon={<Share2 size={17} />} onClick={() => share()}>Share</Button></div>) },
    ].filter((x) => x.node)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, top, buyer, buyerMember, household?.name, month])

  const share = async () => {
    if (!s) return
    const text = `${household?.name} · ${monthLabel(month)} on Roomly\n${formatINR(s.total)} spent together across ${s.expenseCount} purchases.${top ? ` Biggest category: ${CATEGORY_MAP[top.category].label}.` : ''}`
    if (navigator.share) { try { await navigator.share({ title: 'Roomly Wrapped', text }); return } catch { /* cancelled */ } }
    if (await copyToClipboard(text)) toast.success('Summary copied', 'Paste it in your group chat.')
  }

  const last = screens.length - 1
  const go = useCallback((delta: number) => setPos(([cur]) => { const n = Math.min(last, Math.max(0, cur + delta)); return [n, delta] }), [last])
  const close = back

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [go, close])

  if (isError) return <div className="grid min-h-dvh place-items-center p-6"><ErrorState onRetry={refetch} className="max-w-md" /></div>
  if (isPending || !s) return <div className="grid min-h-dvh place-items-center bg-[rgb(var(--story-1))]" role="status" aria-label="Loading"><LogoMark size={36} className="animate-pulse text-[rgb(var(--story-fg))]" /></div>
  if (s.expenseCount === 0) return <div className="grid min-h-dvh place-items-center p-6"><ErrorState title="Nothing to wrap yet." description={`No expenses were recorded in ${monthLabel(month)}.`} onRetry={close} className="max-w-md" /></div>

  const onDragEnd = (_: unknown, info: PanInfo) => { if (info.offset.x < -60) go(1); else if (info.offset.x > 60) go(-1) }
  const screen = screens[i]

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-hidden text-[rgb(var(--story-fg))]" role="region" aria-roledescription="story" aria-label={`Roomly Wrapped, ${monthLabel(month)}`}
      animate={{ backgroundColor: `rgb(var(${screen.bg}))` }} transition={{ duration: 0.5 }}
      onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[rgb(var(--story-fg))]/[0.04] blur-2xl" aria-hidden />

      {/* progress + chrome */}
      <div className="absolute inset-x-0 top-0 z-30 px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <div className="mx-auto flex max-w-xl gap-1.5" aria-hidden>
          {screens.map((_, n) => (
            <div key={n} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
              <div className="h-full origin-left rounded-full bg-white/90"
                style={n < i ? { transform: 'scaleX(1)' } : n === i ? (reduce || i === last ? { transform: 'scaleX(1)' } : { animation: `story-fill ${DURATION}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }) : { transform: 'scaleX(0)' }}
                onAnimationEnd={() => n === i && go(1)} key={`${n}-${i}`} />
            </div>
          ))}
        </div>
        <div className="mx-auto mt-4 flex max-w-xl items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-medium opacity-80"><LogoMark size={20} />Roomly Wrapped</span>
          <button onClick={close} aria-label="Close story" className="rounded-full p-2 transition-colors hover:bg-white/10"><X size={20} /></button>
        </div>
      </div>

      {/* tap zones */}
      <button className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-w-resize focus-visible:outline-offset-[-4px]" onClick={() => go(-1)} aria-label="Previous" disabled={i === 0} tabIndex={-1} />
      <button className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-e-resize focus-visible:outline-offset-[-4px]" onClick={() => go(1)} aria-label="Next" disabled={i === last} tabIndex={-1} />

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div key={i} custom={dir} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.25} onDragEnd={onDragEnd}
          variants={{ enter: (d: number) => ({ opacity: 0, x: d * 60, filter: 'blur(6px)' }), center: { opacity: 1, x: 0, filter: 'blur(0px)' }, exit: (d: number) => ({ opacity: 0, x: d * -60, filter: 'blur(6px)' }) }}
          initial="enter" animate="center" exit="exit" transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; const r = e.currentTarget.getBoundingClientRect(); go(e.clientX - r.left < r.width / 3 ? -1 : 1) }}
          className="relative z-20 mx-auto flex h-full max-w-xl cursor-pointer items-center px-8 pb-24 pt-24 sm:px-10"
        >
          <div className="w-full cursor-default">{screen.node}</div>
        </motion.div>
      </AnimatePresence>

      {/* desktop arrows + hint */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm opacity-70">
        <button onClick={() => go(-1)} disabled={i === 0} aria-label="Previous screen" className="pointer-events-auto hidden rounded-full p-2 hover:bg-white/10 disabled:opacity-30 md:block"><ChevronLeft size={20} /></button>
        <span className="tnum" aria-live="polite">{i + 1} / {screens.length}</span>
        <button onClick={() => go(1)} disabled={i === last} aria-label="Next screen" className="pointer-events-auto hidden rounded-full p-2 hover:bg-white/10 disabled:opacity-30 md:block"><ChevronRight size={20} /></button>
      </div>
    </motion.div>
  )
}
