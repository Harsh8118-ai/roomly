import { Compass } from 'lucide-react'
import { LinkButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Logo } from '@/components/ui/Logo'
import { ROUTES } from '@/constants/routes'

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="text-center">
        <Logo className="mb-6" />
        <EmptyState icon={Compass} title="Page not found." description="That page doesn’t exist, or it moved." action={<LinkButton to={ROUTES.dashboard}>Back to Roomly</LinkButton>} />
      </div>
    </div>
  )
}
