export type ParseResult =
  | { kind: 'command'; command: 'link' | 'help' | 'balance' | 'total' | 'undo'; arg?: string }
  | { kind: 'expense'; amount: number; title: string; category: string | null; confidence: 'high' | 'medium'; dayOffset: number }
  | { kind: 'ignore'; reason: string }
export function parseMessage(input: string): ParseResult
export function shouldRecord(result: ParseResult, context?: 'dm' | 'group'): boolean
export function guessCategory(text: string): string | null
