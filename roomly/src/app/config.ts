const apiUrl = ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

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
