import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Providers } from './providers'
import { ErrorBoundary } from './ErrorBoundary'
import { AppShell } from '@/components/layout/AppShell'
import { FullScreenLoader, ProtectedRoute, PublicOnlyRoute, SessionRoute } from '@/components/layout/RouteGuards'
import { ROUTES } from '@/constants/routes'
import { EntryRoute } from './EntryRoute'

const lazyPage = <T extends Record<string, React.ComponentType<any>>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((m) => ({ default: m[name] })))

const Login = lazyPage(() => import('@/pages/Login'), 'LoginPage')
const Register = lazyPage(() => import('@/pages/Register'), 'RegisterPage')
const ForgotPassword = lazyPage(() => import('@/pages/ForgotPassword'), 'ForgotPasswordPage')
const Onboarding = lazyPage(() => import('@/pages/Onboarding'), 'OnboardingPage')
const Dashboard = lazyPage(() => import('@/pages/Dashboard'), 'DashboardPage')
const Expenses = lazyPage(() => import('@/pages/Expenses'), 'ExpensesPage')
const ExpenseDetails = lazyPage(() => import('@/pages/ExpenseDetails'), 'ExpenseDetailsPage')
const Settlement = lazyPage(() => import('@/pages/Settlement'), 'SettlementPage')
const Members = lazyPage(() => import('@/pages/Members'), 'MembersPage')
const MemberDetails = lazyPage(() => import('@/pages/MemberDetails'), 'MemberDetailsPage')
const History = lazyPage(() => import('@/pages/History'), 'HistoryPage')
const MonthlyReport = lazyPage(() => import('@/pages/MonthlyReport'), 'MonthlyReportPage')
const Wrapped = lazyPage(() => import('@/pages/Wrapped'), 'WrappedPage')
const Settings = lazyPage(() => import('@/pages/Settings'), 'SettingsPage')
const NotFound = lazyPage(() => import('@/pages/NotFound'), 'NotFoundPage')

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Providers>
          <Suspense fallback={<FullScreenLoader />}>
            <Routes>
              <Route path={ROUTES.landing} element={<EntryRoute />} />

              <Route element={<PublicOnlyRoute />}>
                <Route path={ROUTES.login} element={<Login />} />
                <Route path={ROUTES.register} element={<Register />} />
                <Route path={ROUTES.forgotPassword} element={<ForgotPassword />} />
              </Route>

              <Route element={<SessionRoute />}>
                <Route path={ROUTES.onboarding} element={<Onboarding />} />
              </Route>

              <Route path="/app" element={<ProtectedRoute />}>
                {/* Full-screen story, outside the shell */}
                <Route path="wrapped/:month" element={<Wrapped />} />
                <Route element={<AppShell />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="expenses" element={<Expenses />} />
                  <Route path="expenses/:id" element={<ExpenseDetails />} />
                  <Route path="settlement" element={<Settlement />} />
                  <Route path="members" element={<Members />} />
                  <Route path="members/:id" element={<MemberDetails />} />
                  <Route path="history" element={<History />} />
                  <Route path="history/:month" element={<MonthlyReport />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Providers>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
