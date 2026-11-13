import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { api } from '@/services/api/client'
import { Money } from '@/components/ui/Money'
import { FullScreenLoader } from '@/components/layout/RouteGuards'

type PublicData = {
  household: string; total: number; expenseCount: number; generatedAt: string;
  byCategory: { category: string; label: string; amount: number }[];
  members?: { name: string; paid: number }[];
}
export function PublicDashboardPage() {
  const { token = '' } = useParams()
  const query = useQuery({ queryKey: ['public-share', token], queryFn: () => api.get<PublicData>('/public/shares/' + token), retry: false })
  if (query.isPending) return <FullScreenLoader />
  if (query.isError || !query.data) return <main className="grid min-h-dvh place-items-center p-6"><div className="max-w-sm text-center"><h1 className="text-xl font-semibold">Dashboard unavailable</h1><p className="mt-2 text-sm text-muted">This link may have expired or been revoked by the household admin.</p></div></main>
  const data = query.data
  return <main className="min-h-dvh bg-bg px-4 py-8 sm:px-8"><div className="mx-auto max-w-3xl">
    <div className="mb-8"><p className="text-sm font-semibold text-accent-strong">ROOMLY</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{data.household}</h1><p className="mt-1 text-sm text-muted">Shared household expense dashboard · Read only</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="card p-5"><p className="text-sm text-muted">Total recorded expenses</p><p className="mt-2 text-3xl font-semibold"><Money value={data.total} /></p></div><div className="card p-5"><p className="text-sm text-muted">Expense entries</p><p className="mt-2 text-3xl font-semibold">{data.expenseCount}</p></div></div>
    <section className="card mt-5 p-5"><h2 className="font-semibold">Spending by category</h2><div className="mt-4 space-y-4">{data.byCategory.sort((a,b)=>b.amount-a.amount).map((item) => <div key={item.category}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{item.label}</span><Money value={item.amount} /></div><div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent-strong" style={{ width: (data.total ? item.amount / data.total * 100 : 0) + '%' }} /></div></div>)}</div></section>
    {data.members && <section className="card mt-5 p-5"><h2 className="font-semibold">Member contributions</h2><div className="mt-3 divide-y divide-line">{data.members.map((member) => <div key={member.name} className="flex justify-between py-3 text-sm"><span>{member.name}</span><Money value={member.paid} /></div>)}</div></section>}
    <p className="mt-6 text-center text-xs text-muted">Shared securely by Roomly · Generated {new Date(data.generatedAt).toLocaleString()}</p>
  </div></main>
}
