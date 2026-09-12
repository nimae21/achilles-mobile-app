import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
const mocks = vi.hoisted(() => ({
  platform: vi.fn(), get: vi.fn(), set: vi.fn(),
  listeners: {} as Record<string, (value: any) => any>,
  addListener: vi.fn(), register: vi.fn(), unregister: vi.fn(), removeAllDeliveredNotifications: vi.fn(), createChannel: vi.fn(),
  checkPermissions: vi.fn(), requestPermissions: vi.fn(),
  isAuthenticated: vi.fn(), getPushStatus: vi.fn(), registerPushDevice: vi.fn(), removePushDevice: vi.fn(), testPush: vi.fn(),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: mocks.platform } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }) } }))
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: mocks.get, set: mocks.set } }))
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: mocks }))
vi.mock('../../src/services/api', () => ({ api: mocks }))

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks()
  vi.stubEnv('VITE_PUSH_ENABLED', 'true')
  mocks.listeners = {}
  mocks.platform.mockReturnValue('android')
  mocks.get.mockImplementation(async ({ key }) => ({ value: key === 'push_installation_id' ? '9d8d7fd5-9144-4609-8e08-4f58d159bdab' : null }))
  mocks.set.mockResolvedValue(undefined)
  mocks.isAuthenticated.mockResolvedValue(true)
  mocks.getPushStatus.mockResolvedValue({ configured: true, registered: false, worker_running: true })
  mocks.checkPermissions.mockResolvedValue({ receive: 'prompt' })
  mocks.requestPermissions.mockResolvedValue({ receive: 'granted' })
  mocks.registerPushDevice.mockResolvedValue({ registered: true })
  mocks.removePushDevice.mockResolvedValue({})
  mocks.unregister.mockResolvedValue(undefined)
  mocks.removeAllDeliveredNotifications.mockResolvedValue(undefined)
  mocks.createChannel.mockResolvedValue(undefined)
  mocks.addListener.mockImplementation(async (name, callback) => { mocks.listeners[name] = callback; return { remove: vi.fn() } })
  mocks.register.mockImplementation(async () => { void mocks.listeners.registration({ value: 'test-firebase-token' }) })
})

describe('Android notification registration', () => {
  it('does not call native registration from a browser', async () => {
    mocks.platform.mockReturnValue('web')
    const { refreshPushStatus, pushState } = await import('../../src/services/push')
    await refreshPushStatus(true)
    expect(pushState.status).toBe('browser')
    expect(mocks.register).not.toHaveBeenCalled()
  })
  it('shows not configured without pretending notifications are enabled', async () => {
    vi.stubEnv('VITE_PUSH_ENABLED', 'false')
    const { refreshPushStatus, pushState } = await import('../../src/services/push')
    await refreshPushStatus(true)
    expect(pushState.status).toBe('not_configured')
    expect(mocks.requestPermissions).not.toHaveBeenCalled()
    expect(mocks.register).not.toHaveBeenCalled()
  })
  it('waits for server configuration before asking permission', async () => {
    mocks.getPushStatus.mockResolvedValue({ configured: false })
    const { refreshPushStatus, pushState } = await import('../../src/services/push')
    await refreshPushStatus(true)
    expect(pushState.status).toBe('not_configured')
    expect(mocks.requestPermissions).not.toHaveBeenCalled()
  })
  it('registers the phone only after permission is granted', async () => {
    const { refreshPushStatus, pushState } = await import('../../src/services/push')
    await refreshPushStatus(true)
    expect(mocks.requestPermissions).toHaveBeenCalledOnce()
    expect(mocks.registerPushDevice).toHaveBeenCalledWith('9d8d7fd5-9144-4609-8e08-4f58d159bdab', 'test-firebase-token')
    expect(pushState.status).toBe('registered')
    expect(mocks.set).toHaveBeenCalledWith({ key: 'push_opt_in', value: 'true' })
  })
  it('removes a registration when permission is revoked', async () => {
    mocks.checkPermissions.mockResolvedValue({ receive: 'denied' })
    mocks.getPushStatus.mockResolvedValue({ configured: true, registered: true })
    const { refreshPushStatus, pushState } = await import('../../src/services/push')
    await refreshPushStatus()
    expect(pushState.status).toBe('denied')
    expect(mocks.register).not.toHaveBeenCalled()
    expect(mocks.removePushDevice).toHaveBeenCalledOnce()
  })
  it('does not opt users in automatically on startup', async () => {
    mocks.checkPermissions.mockResolvedValue({ receive: 'granted' })
    const { refreshPushStatus, pushState } = await import('../../src/services/push')
    await refreshPushStatus()
    expect(pushState.status).toBe('off')
    expect(mocks.register).not.toHaveBeenCalled()
  })
  it('reuses listeners and reports the worker being offline', async () => {
    mocks.getPushStatus.mockResolvedValue({ configured: true, registered: false, worker_running: false })
    const { refreshPushStatus, pushState } = await import('../../src/services/push')
    await refreshPushStatus(true); await refreshPushStatus(true)
    expect(mocks.addListener.mock.calls.filter(([event]) => event === 'registration')).toHaveLength(1)
    expect(pushState.status).toBe('registered')
    expect(pushState.workerRunning).toBe(false)
  })
  it('does not restore a session from a registration response arriving after logout', async () => {
    let finish!: () => void
    mocks.registerPushDevice.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    const { refreshPushStatus, clearPushSession, pushState } = await import('../../src/services/push')
    const pending = refreshPushStatus(true)
    await flushPromises()
    await clearPushSession()
    finish()
    await pending
    expect(pushState.status).toBe('off')
    expect(mocks.unregister).toHaveBeenCalledOnce()
    expect(mocks.set).not.toHaveBeenCalledWith({ key: 'push_opt_in', value: 'true' })
  })
  it('saves a token rotated by Firebase after registration', async () => {
    const { refreshPushStatus, pushState } = await import('../../src/services/push')
    await refreshPushStatus(true)
    mocks.get.mockImplementation(async ({ key }) => ({ value: key === 'push_installation_id' ? '9d8d7fd5-9144-4609-8e08-4f58d159bdab' : 'true' }))
    mocks.listeners.registration({ value: 'rotated-firebase-token' })
    await flushPromises()
    expect(mocks.registerPushDevice).toHaveBeenLastCalledWith('9d8d7fd5-9144-4609-8e08-4f58d159bdab', 'rotated-firebase-token')
    expect(pushState.status).toBe('registered')
  })
  it('does not start registration if logout happens while creating the channel', async () => {
    let finish!: () => void
    mocks.createChannel.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const { refreshPushStatus, clearPushSession, pushState } = await import('../../src/services/push')
    const pending = refreshPushStatus(true)
    await flushPromises()
    await clearPushSession()
    finish()
    await pending
    expect(mocks.register).not.toHaveBeenCalled()
    expect(pushState.status).toBe('off')
  })
  it('waits for old native logout cleanup before registering a new login', async () => {
    let finish!: () => void
    const { refreshPushStatus, clearPushSession } = await import('../../src/services/push')
    await refreshPushStatus(true)
    mocks.unregister.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const signingOut = clearPushSession()
    await flushPromises()
    const signingIn = refreshPushStatus(true)
    await flushPromises()
    expect(mocks.register).toHaveBeenCalledTimes(1)
    finish()
    await signingOut; await signingIn
    expect(mocks.register).toHaveBeenCalledTimes(2)
  })
  it('can retry after listener initialization fails partway through', async () => {
    const remove = vi.fn().mockResolvedValue(undefined)
    mocks.addListener.mockImplementationOnce(async (name, callback) => {
      mocks.listeners[name] = callback
      return { remove }
    }).mockRejectedValueOnce(new Error('Temporary bridge failure'))
    const { refreshPushStatus, pushState } = await import('../../src/services/push')
    await refreshPushStatus(true)
    expect(pushState.status).toBe('error')
    expect(remove).toHaveBeenCalledOnce()
    await refreshPushStatus(true)
    expect(pushState.status).toBe('registered')
  })
  it('does not let a late failure from a timed-out attempt reject the next attempt', async () => {
    vi.useFakeTimers()
    try {
      let failOld!: (error: Error) => void
      mocks.register.mockImplementationOnce(() => new Promise<void>((_, reject) => { failOld = reject }))
      const { refreshPushStatus, pushState } = await import('../../src/services/push')
      const first = refreshPushStatus(true)
      await vi.advanceTimersByTimeAsync(20001)
      await first
      expect(pushState.status).toBe('error')
      mocks.register.mockResolvedValueOnce(undefined)
      const second = refreshPushStatus(true)
      await vi.advanceTimersByTimeAsync(1)
      failOld(new Error('Late native failure'))
      await vi.advanceTimersByTimeAsync(1)
      expect(pushState.status).toBe('registering')
      mocks.listeners.registration({ value: 'new-token' })
      await vi.advanceTimersByTimeAsync(1)
      await second
      expect(pushState.status).toBe('registered')
    } finally { vi.useRealTimers() }
  })
  it('safely routes a tapped order through login when signed out', async () => {
    const router = { push: vi.fn(), replace: vi.fn() }
    const { initializePush } = await import('../../src/services/push')
    initializePush(router as any)
    await flushPromises()
    mocks.isAuthenticated.mockResolvedValue(false)
    await mocks.listeners.pushNotificationActionPerformed({ notification: { data: { type: 'order_paid', order_id: '42' } } })
    expect(router.replace).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/tabs/orders/42' } })
    expect(router.push).not.toHaveBeenCalled()
  })
})

describe('notification route validation', () => {
  it('accepts order IDs and rejects arbitrary links and malformed IDs', async () => {
    const { notificationOrderPath, safeNotificationRedirect } = await import('../../src/services/notification-routing')
    expect(notificationOrderPath('42')).toBe('/tabs/orders/42')
    for (const value of ['https://evil.test', '../42', '-1', '0', '1e3', {}, null]) {
      expect(notificationOrderPath(value)).toBeNull()
    }
    expect(safeNotificationRedirect('/tabs/orders/42')).toBe('/tabs/orders/42')
    expect(safeNotificationRedirect('https://evil.test')).toBe('/tabs/dashboard')
    expect(safeNotificationRedirect(null)).toBe('/tabs/dashboard')
  })

  it('only allows known in-app paths and keeps the inventory filter', async () => {
    const { safeRoute, isSafeRoute } = await import('../../src/services/notification-routing')
    expect(safeRoute('/tabs/approvals/12')).toBe('/tabs/approvals/12')
    expect(safeRoute('/tabs/users/admins/7')).toBe('/tabs/users/admins/7')
    expect(safeRoute('/tabs/inventory?filter=low')).toBe('/tabs/inventory?filter=low')
    expect(safeRoute('/tabs/inventory?filter=evil')).toBe('/tabs/inventory')
    for (const value of ['/admin/dashboard', 'https://evil.test', '/tabs/orders/0', '/tabs/orders/abc', '//evil.test']) {
      expect(safeRoute(value)).toBeNull()
      expect(isSafeRoute(value)).toBe(false)
    }
  })

  it('resolves backend alert types to the matching screen', async () => {
    const { routeForAlert } = await import('../../src/services/notification-routing')
    expect(routeForAlert({ type: 'order_paid', order_id: '9' })).toBe('/tabs/orders/9')
    expect(routeForAlert({ type: 'approval_submitted', meta: { approval_id: 4 } })).toBe('/tabs/approvals/4')
    expect(routeForAlert({ type: 'invitation_accepted' })).toBe('/tabs/users/admins')
    expect(routeForAlert({ type: 'account_suspended', meta: { user_id: 3, role: 'admin' } })).toBe(
      '/tabs/users/admins/3',
    )
    expect(routeForAlert({ type: 'account_reactivated', meta: { user_id: 3, role: 'user' } })).toBe('/tabs/users/3')
    expect(routeForAlert({ type: 'inventory_low_stock' })).toBe('/tabs/inventory')
    expect(routeForAlert({ type: 'security_alert' })).toBe('/tabs/logs')
    expect(routeForAlert({ type: 'unknown_event' })).toBeNull()
    // An explicit route from the backend always wins when it is allowed.
    expect(routeForAlert({ type: 'order_paid', route: '/tabs/logs/2', order_id: '9' })).toBe('/tabs/logs/2')
  })
})
