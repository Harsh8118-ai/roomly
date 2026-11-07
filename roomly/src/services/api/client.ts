import { config } from '@/app/config'
import { handleMock } from '@/mock/server'
import { ApiError } from '@/utils/errors'

type Query = Record<string, string | number | string[] | undefined | null>
interface Options { query?: Query; body?: unknown }

export const UNAUTHORIZED_EVENT = 'roomly:unauthorized'
export const tokenStore = {
  get: () => localStorage.getItem(config.tokenKey),
  set: (t: string) => localStorage.setItem(config.tokenKey, t),
  clear: () => localStorage.removeItem(config.tokenKey),
}

function flatten(query: Query = {}): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    out[k] = Array.isArray(v) ? v.join(',') : String(v)
  }
  return out
}

async function request<T>(method: string, path: string, { query, body }: Options = {}): Promise<T> {
  const token = tokenStore.get()
  const flat = flatten(query)
  try {
    if (config.useMock) return (await handleMock({ method, path, query: flat, body: body ?? {}, token })) as T

    const qs = new URLSearchParams(flat).toString()
    const res = await fetch(`${config.apiUrl}${path}${qs ? `?${qs}` : ''}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError(res.status, data?.message)
    }
    return (res.status === 204 ? undefined : await res.json()) as T
  } catch (err) {
    const apiErr = err instanceof ApiError ? err : new ApiError(0)
    if (apiErr.status === 401 && token && !path.startsWith('/auth/login')) {
      tokenStore.clear()
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    throw apiErr
  }
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
