import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Logo } from '@/components/ui/Logo'
import { LinkButton } from '@/components/ui/Button'
import { ProductPreview } from '@/components/landing/ProductPreview'
import { FinalCta, Features, Footer, HowItWorks, Insights, MobileExperience, Problem, SettlementExplainer } from '@/components/landing/Sections'
import { useAuth } from '@/store/AuthProvider'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/utils/cn'

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const { user } = useAuth()
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on(); window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={cn('sticky top-0 z-40 transition-colors', scrolled ? 'border-b border-line bg-bg/85 backdrop-blur-xl' : 'border-b border-transparent')}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to={ROUTES.landing} aria-label="Roomly home"><Logo /></Link>
        <nav aria-label="Main" className="hidden items-center gap-8 text-sm text-muted md:flex">
          <a href="#how" className="transition-colors hover:text-fg">How it works</a>
          <a href="#features" className="transition-colors hover:text-fg">Features</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? <LinkButton to={ROUTES.dashboard} size="sm" variant="dark">Open app</LinkButton> : (
            <>
              <LinkButton to={ROUTES.login} size="sm" variant="ghost">Sign in</LinkButton>
              <LinkButton to={ROUTES.register} size="sm" variant="dark" className="hidden xs:inline-flex">Get started</LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <Nav />
      <main>
        <section className="px-5 pb-20 pt-12 md:pb-28 md:pt-20">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
              <h1 className="t-display">Shared living.<br />Without the awkward math.</h1>
              <p className="mt-6 max-w-lg text-lg text-muted md:text-xl">Track household expenses, split fairly, and know exactly who owes whom.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <LinkButton to={ROUTES.register} size="lg" rightIcon={<ArrowRight size={17} />}>Create your household</LinkButton>
                <a href="#how" className="inline-flex h-12 items-center justify-center rounded-md border border-line-strong bg-surface px-6 text-[15px] font-medium shadow-xs transition-colors hover:bg-surface-2">See how it works</a>
              </div>
              <p className="mt-5 text-sm text-muted">Free for households of any size · Built for rupees</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}>
              <ProductPreview className="mx-auto max-w-md lg:max-w-none" />
            </motion.div>
          </div>
        </section>
        <Problem />
        <HowItWorks />
        <Features />
        <SettlementExplainer />
        <Insights />
        <MobileExperience />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
