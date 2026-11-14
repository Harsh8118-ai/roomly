import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { ThemeProvider } from '@/store/ThemeProvider'
import { AuthProvider } from '@/store/AuthProvider'
import { ToastProvider } from '@/store/ToastProvider'
import { ComposerProvider } from '@/store/ComposerProvider'
import { ImportActivityProvider } from '@/store/ImportActivityProvider'
import { ApiError } from '@/utils/errors'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't hammer the server for errors a retry can't fix (401/403/404/422…)
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <ImportActivityProvider><ComposerProvider>{children}</ComposerProvider></ImportActivityProvider>
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  )
}
