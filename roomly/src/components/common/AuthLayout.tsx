import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { formatSigned } from '@/utils/format'
import { ROUTES } from '@/constants/routes'

const PEOPLE = [
  { name: 'Rahul Sharma', tone: 1, amount: 635 }, { name: 'Kunal Mehta', tone: 5, amount: 75 },
  { name: 'Vikas Singh', tone: 4, amount: -285 }, { name: 'Aman Verma', tone: 2, amount: -425 },
]

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link to={ROUTES.landing} aria-label="Roomly home" className="w-fit"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-[22rem] flex-1 flex-col justify-center py-10">
          <h1 className="t-page">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <p className="mt-8 text-center text-sm text-muted">{footer}</p>}
        </div>
      </div>
      <aside className="relative hidden overflow-hidden bg-accent-soft lg:block" aria-hidden>
        <div className="absolute inset-0 grid place-items-center p-12">
          <div className="w-full max-w-sm">
            <p className="t-large mb-8 max-w-xs text-fg">Everyone pays. Nobody keeps score.</p>
            <div className="card space-y-1 p-2 shadow-md">
              <p className="px-3 pb-1 pt-2 text-xs text-muted">October · Casa 4</p>
              {PEOPLE.map((p) => (
                <div key={p.name} className="flex items-center gap-3 rounded-md px-3 py-2.5">
                  <Avatar person={p} size="md" />
                  <span className="flex-1 text-sm font-medium">{p.name.split(' ')[0]}</span>
                  <span className={`tnum text-sm font-semibold ${p.amount > 0 ? 'text-success' : 'text-danger'}`}>{formatSigned(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
