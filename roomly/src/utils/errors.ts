export class ApiError extends Error {
  status: number
  constructor(status: number, message?: string) {
    super(message ?? `Request failed (${status})`)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Raw API errors never reach the UI — everything is mapped to friendly copy here. */
export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 0: return "You're offline. Check your connection and try again."
      case 400:
      case 422: return err.message && err.message.length < 120 ? err.message : 'Some details look off. Please check and try again.'
      case 401: return 'Session expired. Please sign in again.'
      case 403: return "You don't have permission to do that."
      case 404: return "We couldn't find that."
      case 409: return err.message && err.message.length < 120 ? err.message : 'That already exists.'
      default: return fallback
    }
  }
  return fallback
}
