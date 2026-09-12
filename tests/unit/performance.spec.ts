import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const preferences = vi.hoisted(() => {
  const values = new Map<string, string>()

  return {
    values,
    get: vi.fn(async ({ key }: { key: string }) => ({ value: values.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      values.set(key, value)
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      values.delete(key)
    }),
    keys: vi.fn(async () => ({ keys: [...values.keys()] })),
  }
})

vi.mock('@capacitor/preferences', () => ({ Preferences: preferences }))

import { ApiError, api } from '../../src/services/api'

const fetchMock = vi.fn()

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) }
}

const page = (total: number) => ({ data: [], current_page: 1, last_page: 1, total, counts: {} })

beforeEach(() => {
  vi.clearAllMocks()
  preferences.values.clear()
  preferences.get.mockImplementation(async ({ key }: { key: string }) => ({
    value: preferences.values.get(key) ?? (key === 'auth_token' ? 'test-token' : null),
  }))
  vi.stubGlobal('fetch', fetchMock)
})

describe('duplicate request prevention', () => {
  it('serves overlapping identical GETs from the one request already in flight', async () => {
    let release!: (value: unknown) => void
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )

    const first = api.orders({ status: 'paid' })
    const second = api.orders({ status: 'paid' })
    await flushPromises()

    // The screen asked twice; the network was asked once.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    release(response(page(7)))

    expect((await first).total).toBe(7)
    expect((await second).total).toBe(7)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('still sends different filters as their own requests', async () => {
    fetchMock.mockResolvedValue(response(page(0)))
    await Promise.all([api.orders({ status: 'paid' }), api.orders({ status: 'shipped' })])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('lets the next request go out once the shared one has finished', async () => {
    fetchMock.mockResolvedValue(response(page(1)))
    await api.orders({ status: 'paid' })
    await api.orders({ status: 'paid' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('request cancellation', () => {
  it('abandons a request the user has moved on from without retrying it', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementationOnce(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )

    const pending = api.orders({ search: 'juan' }, controller.signal)
    await flushPromises()
    controller.abort()

    await expect(pending).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('on-device screen cache', () => {
  it('restores screens from the last session for the same account', async () => {
    const first = await import('../../src/services/screen-cache')
    first.setCacheScope(first.cacheScopeFor('root@example.test'))
    first.writeCache('dashboard', { total: 7 })
    await flushPromises()

    // A cold start: fresh module state, same device storage.
    vi.resetModules()
    const second = await import('../../src/services/screen-cache')
    expect(second.readCache('dashboard', 60_000)).toBeNull()

    second.setCacheScope(second.cacheScopeFor('root@example.test'))
    await second.hydrateCache()
    expect(second.readCache<{ total: number }>('dashboard', 60_000)).toEqual({ total: 7 })
  })

  it('never surfaces the screens of a different account, even after a cold start', async () => {
    const first = await import('../../src/services/screen-cache')
    first.setCacheScope(first.cacheScopeFor('root@example.test'))
    first.writeCache('orders', { total: 3 })
    await flushPromises()

    vi.resetModules()
    const second = await import('../../src/services/screen-cache')
    second.setCacheScope(second.cacheScopeFor('someone.else@example.test'))
    await second.hydrateCache()

    expect(second.readCache('orders', 60_000)).toBeNull()
    // The abandoned copy is deleted, not just hidden.
    expect([...preferences.values.keys()].some((key) => key.includes('orders'))).toBe(false)
  })
})

describe('development performance log', () => {
  it('stays out of builds that are not development', async () => {
    const perf = await import('../../src/services/perf')
    perf.installPerfConsole()
    perf.recordRequest({ method: 'GET', endpoint: '/orders', status: 200, outcome: 'ok', ms: 12 })

    expect(perf.perfEnabled()).toBe(false)
    expect(window.__achillesPerf).toBeUndefined()
    expect(perf.perfReport().screens).toEqual([])
  })
})
