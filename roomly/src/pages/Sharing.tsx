import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Link2, Share2, ShieldCheck, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api/client'
import { copyToClipboard } from '@/utils/clipboard'
import { useToast } from '@/store/ToastProvider'

type Share = { id: string; createdAt: string; expiresAt: string | null; revoked: boolean; showMemberBreakdown: boolean }
type CreatedShare = { id: string; url: string; expiresAt: string; showMemberBreakdown: boolean }

export function SharingPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const [created, setCreated] = useState<CreatedShare | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [expiry, setExpiry] = useState(30)
  const links = useQuery({ queryKey: ['shares'], queryFn: () => api.get<Share[]>('/shares') })
  const create = useMutation({
    mutationFn: () => api.post<CreatedShare>('/shares', { expiresInDays: expiry, showMemberBreakdown: showMembers }),
    onSuccess: async (value) => { setCreated(value); await qc.invalidateQueries({ queryKey: ['shares'] }); toast.success('Dashboard link created.') },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not create a link.'),
  })
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete('/shares/' + id),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['shares'] }); toast.success('Share link revoked.') },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not revoke link.'),
  })
  const copy = async (url: string) => { if (await copyToClipboard(url)) toast.success('Link copied.') }
  const whatsapp = (url: string) => window.open('https://wa.me/?text=' + encodeURIComponent('Our Roomly household expense dashboard is ready: ' + url), '_blank', 'noopener,noreferrer')

  return <>
    <PageHeader title="Share dashboard" description="Create a read-only link that anyone can open. You can revoke it whenever you need." />
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent-strong"><ShieldCheck size={20} /></div>
        <div><h2 className="font-semibold">Public read-only access</h2><p className="mt-1 text-sm text-muted">Anyone with the link can view household totals and category analysis. Member-wise totals are optional.</p></div>
      </div>
      <label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={showMembers} onChange={(e) => setShowMembers(e.target.checked)} /> Include member-wise contributions</label>
      <label className="mt-4 block text-sm text-muted">Link expiry
        <select value={expiry} onChange={(e) => setExpiry(Number(e.target.value))} className="mt-1 h-10 w-full max-w-xs rounded-md border border-line bg-surface px-3 text-fg">
          <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>180 days</option><option value={365}>1 year</option>
        </select>
      </label>
      <Button className="mt-5" onClick={() => create.mutate()} loading={create.isPending} leftIcon={<Link2 size={16} />}>Generate dashboard link</Button>
      {created && <div className="mt-5 rounded-lg border border-line bg-surface-2 p-4">
        <p className="text-sm font-medium">Your share link is ready</p><p className="mt-2 break-all text-sm text-muted">{created.url}</p>
        <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="secondary" leftIcon={<Copy size={14} />} onClick={() => void copy(created.url)}>Copy link</Button><Button size="sm" leftIcon={<Share2 size={14} />} onClick={() => whatsapp(created.url)}>Share to WhatsApp</Button></div>
      </div>}
    </section>
    <section className="mt-6"><h2 className="mb-3 font-semibold">Previously generated links</h2>
      {links.isPending ? <p className="text-sm text-muted">Loading links…</p> : links.isError ? <p className="text-sm text-danger">Could not load share links.</p> : links.data.length === 0 ? <p className="text-sm text-muted">No links have been created yet.</p> : <div className="card divide-y divide-line">
        {links.data.map((link) => <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div><p className="text-sm font-medium">{link.showMemberBreakdown ? 'Household + member totals' : 'Household totals only'}</p><p className="mt-1 text-xs text-muted">{link.revoked ? 'Revoked' : 'Expires ' + (link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : 'never')}</p></div>
          {link.revoked ? <span className="text-xs text-muted">Inactive</span> : <Button size="sm" variant="danger" leftIcon={<Trash2 size={14} />} onClick={() => revoke.mutate(link.id)} loading={revoke.isPending}>Revoke</Button>}
        </div>)}
      </div>}
    </section>
  </>
}
