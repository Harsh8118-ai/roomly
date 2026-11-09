const configuredApiUrl = ((import.meta as any).env?.VITE_API_URL as string | undefined)?.trim() ?? ''
// Accept either http://localhost:5000 or http://localhost:5000/api, but store exactly one /api suffix.
const apiOrigin = configuredApiUrl.replace(/\/+$/, '').replace(/\/api$/i, '')
const apiUrl = apiOrigin ? `${apiOrigin}/api` : ''

export const config = {
  /** Base URL of the Express API. Empty = run against the in-browser mock API. */
  apiUrl,
  useMock: apiUrl === '',
  /**
   * In demo mode the app pretends it's this day, so the seeded October data
   * always looks "live" no matter when you open the project.
   */
  demoToday: '2026-10-28',
  tokenKey: 'roomly.token',
  themeKey: 'roomly.theme',
  demoCredentials: { email: 'rahul@roomly.app', password: 'roomly123' },
}
