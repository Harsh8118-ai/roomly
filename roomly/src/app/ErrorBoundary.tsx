import { Component, type ReactNode } from 'react'
import { ErrorState } from '@/components/ui/EmptyState'

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <ErrorState title="Something went wrong." description="Roomly hit an unexpected problem. Reloading usually fixes it." onRetry={() => window.location.reload()} className="max-w-md" />
      </div>
    )
  }
}
