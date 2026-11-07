export const ROUTES = {
  landing: '/', login: '/login', register: '/register', forgotPassword: '/forgot-password',
  onboarding: '/onboarding', dashboard: '/app/dashboard', expenses: '/app/expenses',
  expense: (id: string) => `/app/expenses/${id}`,
  settlement: '/app/settlement', members: '/app/members',
  member: (id: string) => `/app/members/${id}`,
  history: '/app/history', report: (month: string) => `/app/history/${month}`,
  wrapped: (month: string) => `/app/wrapped/${month}`, settings: '/app/settings',
} as const
