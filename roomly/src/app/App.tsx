import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Providers } from './providers'
import { ErrorBoundary } from './ErrorBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { FullScreenLoader, ProtectedRoute, PublicOnlyRoute, SessionRoute } from '@/components/layout/RouteGuards'
import { ROUTES } from '@/constants/routes'
import { EntryRoute } from './EntryRoute'
const lazyPage = <T extends Record<string, React.ComponentType<any>>>(loader: () => Promise<T>, name: keyof T) => lazy(() => loader().then((m) => ({ default: m[name] })))
const Login = lazyPage(() => import('@/pages/Login'), 'LoginPage')
const AuthCallback = lazyPage(() => import('./AuthCallback'), 'AuthCallback')
const Onboarding = lazyPage(() => import('@/pages/Onboarding'), 'OnboardingPage')
const Dashboard = lazyPage(() => import('@/pages/Dashboard'), 'DashboardPage')
const Expenses = lazyPage(() => import('@/pages/Expenses'), 'ExpensesPage')
const ExpenseDetails = lazyPage(() => import('@/pages/ExpenseDetails'), 'ExpenseDetailsPage')
const Settlement = lazyPage(() => import('@/pages/Settlement'), 'SettlementPage')
const Members = lazyPage(() => import('@/pages/Members'), 'MembersPage')
const Settings = lazyPage(() => import('@/pages/Settings'), 'SettingsPage')
const Imports = lazyPage(() => import('@/pages/Imports'), 'ImportsPage')
const NotFound = lazyPage(() => import('@/pages/NotFound'), 'NotFoundPage')
export function App() {
  return <ErrorBoundary><BrowserRouter><Providers><Suspense fallback={<FullScreenLoader />}>
    <Routes>
      <Route path="/" element={<EntryRoute />} />
      <Route path="/login" element={<PublicOnlyRoute />}><Route index element={<Login />} /></Route>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<SessionRoute />}><Route path="/onboarding" element={<Onboarding />} /></Route>
      <Route path="/app" element={<ProtectedRoute />}><Route element={<AppShell />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="expenses/:id" element={<ExpenseDetails />} />
        <Route path="settlement" element={<Settlement />} />
        <Route path="members" element={<Members />} />
        <Route path="settings" element={<Settings />} />
        <Route path="imports" element={<Imports />} />
      </Route></Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense></Providers></BrowserRouter></ErrorBoundary>
}
