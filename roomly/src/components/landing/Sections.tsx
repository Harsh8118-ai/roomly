import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BarChart3, Camera, Check, MessageCircle, MoonStar, Receipt, Scale, Smartphone, Sparkles, Users, Zap } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { LinkButton } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { ROUTES } from '@/constants/routes'
import { formatINR } from '@/utils/format'
import { cn } from '@/utils/cn'

const reveal = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } }

export function SectionHeading({ title, body, center }: { title: string; body?: string; center?: boolean }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      <h2 className="t-large">{title}</h2>
      {body && <p className="mt-4 text-lg text-muted">{body}</p>}
    </div>
  )
}

export function Problem() {
  const lines = [
    { who: 'Aman', t: 'Bought veggies, 450. Will add to the sheet', time: '9:12 pm' },
    { who: 'Kunal', t: 'Wait, did anyone count the gas?', time: '9:40 pm' },
    { who: 'Vikas', t: 'I paid wifi last month 😅 who owes what', time: '10:05 pm' },
    { who: 'Rahul', t: 'Scrolling up 200 messages…', time: '10:06 pm' },
  ]
  return (
    <section className="px-5 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        <motion.div {...reveal}>
          <SectionHeading title="The group chat is not a ledger." body="Receipts get buried. Someone always pays more. By month-end, nobody can say who owes whom — and nobody wants to be the one to ask." />
        </motion.div>
        <motion.div {...reveal} className="card space-y-2.5 p-4 md:p-5" aria-label="Example of a messy house group chat">
          {lines.map((l, i) => (
            <div key={i} className={cn('max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm', i % 2 ? 'ml-auto bg-accent-soft' : 'bg-surface-2')}>
              <p className="t-micro font-medium text-muted">{l.who}</p>
              <p className="mt-0.5">{l.t}</p>
              <p className="t-micro mt-1 text-right text-subtle">{l.time}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export function HowItWorks() {
  const steps = [
    { icon: Users, title: 'Set up your home', body: 'Name your household and invite the people you live with.' },
    { icon: Receipt, title: 'Add what you buy', body: 'Amount, what it was, done. Takes about ten seconds at the shop.' },
    { icon: Scale, title: 'Settle once a month', body: 'Roomly works out each fair share and the fewest payments to square up.' },
  ]
  return (
    <section id="how" className="scroll-mt-20 border-y border-line bg-surface px-5 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="Three steps. No spreadsheets." center />
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.li key={s.title} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} className="relative">
              <span className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent-strong"><s.icon size={22} strokeWidth={1.75} /></span>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-muted">{s.body}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function Features() {
  const items = [
    { icon: Zap, title: 'Add in ten seconds', body: 'Amount, a word, a tap. Roomly guesses the category as you type.' },
    { icon: Camera, title: 'Receipts, attached', body: 'Snap the bill so nobody has to take your word for it.' },
    { icon: Scale, title: 'Fair, to the rupee', body: 'Shares always add up exactly. No rounding arguments.' },
    { icon: BarChart3, title: 'See where it goes', body: 'Categories, trends and who’s been buying what.' },
    { icon: MoonStar, title: 'Light and dark', body: 'Easy on the eyes at midnight, when most expenses get added.' },
    { icon: Smartphone, title: 'Made for your phone', body: 'Thumb-sized buttons and a floating “Add expense” always in reach.' },
  ]
  return (
    <section id="features" className="scroll-mt-20 px-5 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="Everything a shared home needs. Nothing it doesn’t." />
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <div key={f.title} className="bg-surface p-7 transition-colors hover:bg-surface-2/60">
              <f.icon size={20} strokeWidth={1.75} className="text-accent-strong" aria-hidden />
              <h3 className="mt-5 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-[15px] text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SettlementExplainer() {
  const rows = [
    { name: 'Rahul', tone: 1, paid: 5240, bal: 635 }, { name: 'Kunal', tone: 5, paid: 4680, bal: 75 },
    { name: 'Vikas', tone: 4, paid: 4320, bal: -285 }, { name: 'Aman', tone: 2, paid: 4180, bal: -425 },
  ]
  return (
    <section className="bg-fg px-5 py-20 text-bg md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        <motion.div {...reveal}>
          <h2 className="t-large">Four people. ₹18,420. Three payments.</h2>
          <p className="mt-4 text-lg text-bg/65">Everyone’s fair share is ₹4,605. Roomly compares it with what each person actually paid, then finds the shortest way to square up.</p>
          <ul className="mt-8 space-y-3 text-[15px]">
            {['Aman pays Rahul ₹425', 'Vikas pays Rahul ₹210', 'Vikas pays Kunal ₹75'].map((t) => <li key={t} className="flex items-center gap-3"><span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-fg"><Check size={12} strokeWidth={3} /></span>{t}</li>)}
          </ul>
        </motion.div>
        <motion.div {...reveal} className="rounded-2xl bg-bg p-2 text-fg">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center gap-3 rounded-xl px-4 py-3.5">
              <Avatar person={r} size="md" />
              <div className="flex-1"><p className="text-sm font-medium">{r.name}</p><p className="t-small tnum text-muted">Paid {formatINR(r.paid)}</p></div>
              <span className={cn('tnum text-base font-semibold', r.bal > 0 ? 'text-success' : 'text-danger')}>{r.bal > 0 ? '+' : '−'}{formatINR(Math.abs(r.bal))}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export function Insights() {
  return (
    <section className="px-5 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title="A month, told as a story." body="At the end of every month, Roomly Wrapped turns your spending into a quick recap — your biggest category, your most active buyer, and the total you spent together." />
        <motion.div {...reveal} className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { bg: '--story-2', big: '₹18,420', small: 'spent together' },
            { bg: '--story-4', big: 'Groceries', small: '₹7,420 · your biggest category' },
            { bg: '--story-5', big: 'Rahul', small: '17 purchases · most active buyer' },
          ].map((c) => (
            <div key={c.big} className="flex aspect-[4/5] flex-col justify-end rounded-2xl p-7 text-[rgb(var(--story-fg))]" style={{ background: `rgb(var(${c.bg}))` }}>
              <Sparkles size={18} className="mb-auto opacity-60" aria-hidden />
              <p className="tnum text-4xl font-semibold tracking-tight">{c.big}</p>
              <p className="mt-2 opacity-70">{c.small}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export function MobileExperience() {
  return (
    <section className="border-t border-line bg-surface px-5 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        <motion.div {...reveal} className="md:order-2">
          <SectionHeading title="Built for the checkout queue." body="You’ll add most expenses standing at a shop. So the big button is under your thumb, the amount is the first thing you type, and everything else can wait." />
        </motion.div>
        <motion.div {...reveal} className="mx-auto w-full max-w-[17rem] md:order-1">
          <div className="overflow-hidden rounded-[2.2rem] border-[6px] border-fg bg-bg shadow-lg">
            <div className="px-5 pb-6 pt-8">
              <p className="text-center text-xs text-muted">Add expense</p>
              <p className="tnum mt-4 text-center text-5xl font-semibold tracking-tight"><span className="mr-1 text-3xl text-muted">₹</span>450</p>
              <div className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] font-medium">
                {['Groceries', 'Vegetables', 'Milk'].map((c, i) => <span key={c} className={cn('rounded-lg border py-2.5', i === 1 ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-muted')}>{c}</span>)}
              </div>
              <div className="mt-8 rounded-xl bg-accent-strong py-3 text-center text-sm font-semibold text-on-accent">Add expense</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export function FinalCta() {
  return (
    <section className="px-5 py-24 md:py-32">
      <motion.div {...reveal} className="mx-auto max-w-3xl text-center">
        <h2 className="t-display">Make shared living feel effortless.</h2>
        <p className="mx-auto mt-5 max-w-lg text-lg text-muted">Set up your household in a minute. Your housemates can join whenever they’re ready.</p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <LinkButton to={ROUTES.register} size="lg" rightIcon={<ArrowRight size={17} />}>Create your household</LinkButton>
          <LinkButton to={ROUTES.login} size="lg" variant="secondary">Explore the demo</LinkButton>
        </div>
      </motion.div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-line px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
        <div className="flex items-center gap-3"><Logo size={22} /><span>Shared living, simplified.</span></div>
        <nav aria-label="Footer" className="flex gap-6">
          <a href="#features" className="hover:text-fg">Features</a><a href="#how" className="hover:text-fg">How it works</a>
          <Link to={ROUTES.login} className="hover:text-fg">Sign in</Link>
        </nav>
        <span className="inline-flex items-center gap-1.5"><MessageCircle size={14} />Made for homes in India · © 2026 Roomly</span>
      </div>
    </footer>
  )
}
