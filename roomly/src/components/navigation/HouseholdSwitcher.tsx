import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Dropdown, MenuDivider, MenuItem } from '@/components/ui/Dropdown'
import { useHousehold, useHouseholds } from '@/hooks/queries'
import { householdService } from '@/services/householdService'
import { useAuth, ME_KEY } from '@/store/AuthProvider'
import { useToast } from '@/store/ToastProvider'
import { friendlyError } from '@/utils/errors'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/utils/cn'
import { LogoMark } from '@/components/ui/Logo'

export function HouseholdSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { data: household } = useHousehold()
  const { data: households = [] } = useHouseholds()
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  const switchTo = async (id: string, close: () => void) => {
    close()
    if (id === user?.currentHouseholdId) return
    try {
      const u = await householdService.switchTo(id)
      qc.setQueryData(ME_KEY, u)
      navigate(ROUTES.dashboard)
    } catch (e) { toast.error(friendlyError(e)) }
  }

  return (
    <Dropdown
      align="left" label="Households" panelClassName="w-64"
      trigger={({ toggle, props }) => (
        <button
          onClick={toggle} {...props}
          className={cn('flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface p-2 text-left transition-colors hover:border-line-strong', collapsed && 'justify-center border-transparent bg-transparent')}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-strong"><LogoMark size={18} mono /></span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight">{household?.name ?? 'Household'}</span>
                <span className="block text-xs text-muted">{household ? `${household.members.length} members` : ' '}</span>
              </span>
              <ChevronsUpDown size={14} className="text-subtle" aria-hidden />
            </>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <>
          <p className="px-2.5 pb-1 pt-1.5 text-xs text-muted">Your households</p>
          {households.map((h) => (
            <MenuItem key={h.id} onClick={() => switchTo(h.id, close)} selected={h.id === user?.currentHouseholdId} trailing={h.id === user?.currentHouseholdId ? <Check size={15} className="text-accent-strong" /> : undefined}>
              {h.name}
            </MenuItem>
          ))}
          <MenuDivider />
          <MenuItem icon={<Plus size={15} />} onClick={() => { close(); navigate(`${ROUTES.onboarding}?new=1`) }}>Create another household</MenuItem>
        </>
      )}
    </Dropdown>
  )
}
