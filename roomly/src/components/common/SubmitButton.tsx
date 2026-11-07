import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export type SubmitPhase = 'idle' | 'loading' | 'success'

/** Idle → "Signing in…" → "Success", so the button itself communicates progress. */
export function SubmitButton({ phase, idle, loading, success = 'Success' }: { phase: SubmitPhase; idle: string; loading: string; success?: string }) {
  return (
    <Button type="submit" size="lg" fullWidth loading={phase === 'loading'} loadingText={loading} disabled={phase === 'success'} variant={phase === 'success' ? 'soft' : 'primary'}
      leftIcon={phase === 'success' ? <Check size={18} /> : undefined}>
      {phase === 'success' ? success : idle}
    </Button>
  )
}
