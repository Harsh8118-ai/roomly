import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

export function SettingsSection({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <div className="mb-3 px-1"><h2 id={`${id}-h`} className="t-section">{title}</h2>{description && <p className="t-small mt-0.5 text-muted">{description}</p>}</div>
      <Card className="p-5">{children}</Card>
    </section>
  )
}
