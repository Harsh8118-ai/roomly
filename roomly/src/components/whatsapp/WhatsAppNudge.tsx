import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, X } from 'lucide-react'
import { useWhatsAppStatus } from '@/hooks/whatsapp'
import { Card } from '@/components/ui/Card'
import { ROUTES } from '@/constants/routes'

const KEY = 'roomly.nudge.whatsapp'

/** One-time suggestion on the dashboard until the person links their number or dismisses it. */
export function WhatsAppNudge() {
  const { data } = useWhatsAppStatus()
  const [hidden, setHidden] = useState(() => localStorage.getItem(KEY) === '1')
  if (hidden || !data?.configured || data.me.linked) return null
  return (
    <Card variant="insight" className="relative flex items-center gap-4 p-4 pr-12">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface text-accent-strong"><MessageCircle size={19} /></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Log expenses from WhatsApp</p><p className="t-small text-muted">Text “vegetables 150” and Roomly adds it. No app needed at the shop.</p></div>
      <Link to={`${ROUTES.settings}#whatsapp`} className="hidden h-9 shrink-0 items-center rounded-md bg-accent-strong px-3.5 text-sm font-medium text-on-accent transition-[filter] hover:brightness-110 sm:inline-flex">Set it up</Link>
      <button onClick={() => { localStorage.setItem(KEY, '1'); setHidden(true) }} aria-label="Dismiss" className="absolute right-3 top-3 rounded-sm p-1.5 text-muted hover:text-fg"><X size={15} /></button>
      <Link to={`${ROUTES.settings}#whatsapp`} className="absolute inset-0 sm:hidden" aria-label="Set up WhatsApp" />
    </Card>
  )
}
