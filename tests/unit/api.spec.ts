import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const preferences = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn() }))
vi.mock('@capacitor/preferences', () => ({ Preferences: preferences }))
vi.mock('../../src/services/secure-storage', () => ({ SecureStorage: preferences }))
import { api, ApiError } from '../../src/services/api'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  preferences.get.mockResolvedValue({ value: 'test-token' })
  preferences.remove.mockResolvedValue(undefined)
  preferences.set.mockResolvedValue(undefined)
  vi.stubGlobal('fetch', fetchMock)
})

function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    text: async () => JSON.stringify(body),
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('super admin session handling', () => {
  it('exchanges credentials for a token and stores the session user', async () => {
    fetchMock.mockResolvedValue(
      response({ token: 'new-session', user: { name: 'Super Admin', email: 'root@example.test', role: 'super_admin' } }),
    )
    const data = await api.login('root@example.test', 'secret')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/login$/)
    expect(options.method).toBe('POST')
    expect(options.headers.get('Authorization')).toBeNull()
    expect(JSON.parse(options.body)).toEqual({ email: 'root@example.test', password: 'secret' })
    expect(data.token).toBe('new-session')
    expect(preferences.set).toHaveBeenCalledWith({ key: 'auth_token', value: 'new-session' })
    expect(preferences.set).toHaveBeenCalledWith({
      key: 'auth_user',
      value: JSON.stringify(data.user),
    })
  })

  it('clears both local values when a stored profile is invalid', async () => {
    preferences.get.mockImplementation(async ({ key }: { key: string }) => ({
      value: key === 'auth_user' ? '{not-json' : 'test-token',
    }))

    await expect(api.getUser()).resolves.toBeNull()
    expect(preferences.remove).toHaveBeenCalledWith({ key: 'auth_token' })
    expect(preferences.remove).toHaveBeenCalledWith({ key: 'auth_user' })
  })
  it('surfaces the backend refusal when an admin or customer tries to sign in', async () => {
    fetchMock.mockResolvedValue(
      response({ message: 'This app is reserved for Super Admin accounts.' }, 403),
    )
    await expect(api.login('admin@example.test', 'secret')).rejects.toThrow(
      'This app is reserved for Super Admin accounts.',
    )
    expect(preferences.set).not.toHaveBeenCalled()
  })

  it('clears expired sessions and asks the app to return to login', async () => {
    const expired = vi.fn()
    window.addEventListener('auth-expired', expired)
    fetchMock.mockResolvedValue(response({ message: 'Unauthenticated.' }, 401))

    await expect(api.orders()).rejects.toBeInstanceOf(ApiError)
    expect(preferences.remove).toHaveBeenCalledWith({ key: 'auth_token' })
    expect(expired).toHaveBeenCalledOnce()
    window.removeEventListener('auth-expired', expired)
  })

  it('clears local login even if logout cannot reach the server', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api.logout()).rejects.toThrow('Unable to reach the Achilles server')
    expect(preferences.remove).toHaveBeenCalledWith({ key: 'auth_token' })
    expect(preferences.remove).toHaveBeenCalledWith({ key: 'auth_user' })
  })

  it('clears an expired session even if the server returns HTML', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => '<html>Unauthenticated</html>' })
    await expect(api.dashboard()).rejects.toBeInstanceOf(ApiError)
    expect(preferences.remove).toHaveBeenCalledWith({ key: 'auth_token' })
  })

  it('does not clear a new login when an old request eventually returns 401', async () => {
    let finish!: (value: ReturnType<typeof response>) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const oldRequest = api.orders().catch((error) => error)
    await flushPromises()
    fetchMock.mockResolvedValueOnce(
      response({ token: 'new-session', user: { name: 'Super Admin', email: 'root@example.test' } }),
    )
    await api.login('root@example.test', 'secret')
    finish(response({ message: 'Old session expired.' }, 401))

    expect(await oldRequest).toBeInstanceOf(ApiError)
    expect(preferences.remove).not.toHaveBeenCalled()
  })
})

describe('super admin endpoints', () => {
  it('requests the selected order status, search term and page', async () => {
    fetchMock.mockResolvedValue(response({ data: [], current_page: 2, last_page: 2, total: 20 }))
    await api.orders({ status: 'shipped', search: 'juan', page: 2 })
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/orders\?status=shipped&search=juan&page=2$/)
  })

  it('omits blank filters instead of sending empty query values', async () => {
    fetchMock.mockResolvedValue(response({ data: [], current_page: 1, last_page: 1, total: 0 }))
    await api.orders({ status: 'all', search: '', page: 1 })
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/orders\?status=all&page=1$/)
  })

  it('sends approval decisions as a single reviewed payload', async () => {
    fetchMock.mockResolvedValue(response({ message: '1 request(s) approved.', reviewed: [7], failed: [] }))
    await api.reviewApprovals({ ids: [7], decision: 'approved' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/approvals\/review$/)
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ ids: [7], decision: 'approved' })
  })

  it('keeps server transition errors visible instead of failing silently', async () => {
    fetchMock.mockResolvedValue(response({ message: 'This request is already reviewed.' }, 422))
    await expect(api.reviewApprovals({ ids: [7], decision: 'approved' })).rejects.toThrow(
      'This request is already reviewed.',
    )
  })

  it('suspends an account through the governance endpoint', async () => {
    fetchMock.mockResolvedValue(response({ message: 'Account suspended.', user: { id: 5, is_active: false } }))
    await api.setUserStatus(5, false)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/users\/5\/status$/)
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({ is_active: false })
  })

  it('invites an admin with the existing invitation workflow', async () => {
    fetchMock.mockResolvedValue(response({ message: 'Invitation sent.', invitation: { id: 1 } }, 201))
    await api.inviteAdmin('new.admin@example.test')
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/admin-invitations$/)
    expect(JSON.parse(options.body)).toEqual({ email: 'new.admin@example.test' })
  })

  it('marks notifications read and reports the new unread count', async () => {
    fetchMock.mockResolvedValue(response({ message: 'Read.', notification: { id: 'abc' }, unread: 2 }))
    const result = await api.markNotificationRead('abc')
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/notifications\/abc\/read$/)
    expect(result.unread).toBe(2)
  })

  it('registers this phone for push against the authenticated token', async () => {
    fetchMock.mockResolvedValue(response({ registered: true }))
    await api.registerPushDevice('9d8d7fd5-9144-4609-8e08-4f58d159bdab', 'fcm-token')
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/push\/device$/)
    expect(options.method).toBe('PUT')
    expect(options.headers.get('Authorization')).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({
      installation_id: '9d8d7fd5-9144-4609-8e08-4f58d159bdab',
      token: 'fcm-token',
    })
  })
})

describe('slow and unreliable networks', () => {
  it('retries a failed GET once but never a mutation', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(api.orders()).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    fetchMock.mockClear()
    await expect(api.logout()).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a server refusal', async () => {
    fetchMock.mockResolvedValue(response({ message: 'You do not have permission.' }, 403))
    await expect(api.dashboard()).rejects.toThrow('You do not have permission.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('screen cache', () => {
  it('serves warm entries and expires stale ones', async () => {
    const { readCache, writeCache, clearCache } = await import('../../src/services/screen-cache')
    writeCache('orders|{}', { total: 3 })
    expect(readCache<{ total: number }>('orders|{}', 60_000)).toEqual({ total: 3 })
    expect(readCache('orders|{}', -1)).toBeNull()
    clearCache()
    expect(readCache('orders|{}', 60_000)).toBeNull()
  })
})

describe('bounded request policy', () => {
  it('honors a bounded Retry-After for a safe GET', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(response({ message: 'Slow down.' }, 429, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(response({ data: [], current_page: 1, last_page: 1, total: 0 }))

    const pending = api.orders({ search: 'rate-limited' })
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_000)
    await expect(pending).resolves.toMatchObject({ total: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not wait for an excessive Retry-After', async () => {
    fetchMock.mockResolvedValue(response({ message: 'Try later.' }, 429, { 'Retry-After': '60' }))
    const error = await api.orders({ search: 'long-rate-limit' }).catch((caught) => caught)

    expect(error).toMatchObject({ kind: 'rate_limit', retryAfterMs: 60_000 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('classifies bounded request timeouts separately from offline failures', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        }),
    )

    const result = api.orders({ search: 'timeout' }).catch((caught) => caught)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(8_000)
    await vi.advanceTimersByTimeAsync(350)
    await vi.advanceTimersByTimeAsync(8_000)

    const error = await result
    expect(error).toMatchObject({ kind: 'timeout', status: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reports cold-backend responses promptly after the one safe retry', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue(response({}, 503))
    const result = api.orders({ search: 'cold-backend' }).catch((caught) => caught)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(350)

    const error = await result
    expect(error).toMatchObject({ kind: 'cold_backend', status: 503 })
    expect(error.message).toContain('starting up')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('never retries an unsafe write when the connection fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await api.inviteAdmin('new@example.test').catch((caught) => caught)

    expect(error).toMatchObject({ kind: 'offline' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
