import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  platform: vi.fn(() => 'android'),
  native: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  legacy: { get: vi.fn(), remove: vi.fn() },
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: mocks.platform }, registerPlugin: () => mocks.native }))
vi.mock('@capacitor/preferences', () => ({ Preferences: mocks.legacy }))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  mocks.platform.mockReturnValue('android')
  mocks.native.get.mockResolvedValue({ value: null })
  mocks.native.set.mockResolvedValue(undefined)
  mocks.native.remove.mockResolvedValue(undefined)
  mocks.legacy.get.mockResolvedValue({ value: 'legacy-token' })
  mocks.legacy.remove.mockResolvedValue(undefined)
})

it('encrypts a legacy token before deleting plaintext and serves repeated reads from memory', async () => {
  const { SecureStorage } = await import('../../src/services/secure-storage')
  await expect(SecureStorage.get({ key: 'auth_token' })).resolves.toEqual({ value: 'legacy-token' })
  await SecureStorage.get({ key: 'auth_token' })
  expect(mocks.native.get).toHaveBeenCalledTimes(1)
  expect(mocks.native.set).toHaveBeenCalledWith({ key: 'auth_token', value: 'legacy-token' })
  expect(mocks.native.set.mock.invocationCallOrder[0]).toBeLessThan(mocks.legacy.remove.mock.invocationCallOrder[0])
})

it('fails closed when encryption fails and leaves the legacy value available for a later migration', async () => {
  mocks.native.set.mockRejectedValue(new Error('keystore unavailable'))
  const { SecureStorage } = await import('../../src/services/secure-storage')
  await expect(SecureStorage.get({ key: 'auth_token' })).rejects.toThrow('keystore unavailable')
  expect(mocks.legacy.remove).not.toHaveBeenCalled()
})

it('prefers encrypted credentials over stale plaintext and removes the latter', async () => {
  mocks.native.get.mockResolvedValue({ value: 'secure-token' })
  const { SecureStorage } = await import('../../src/services/secure-storage')
  await expect(SecureStorage.get({ key: 'auth_token' })).resolves.toEqual({ value: 'secure-token' })
  expect(mocks.legacy.get).not.toHaveBeenCalled()
  expect(mocks.legacy.remove).toHaveBeenCalledWith({ key: 'auth_token' })
})

it('does not restore legacy plaintext sessions in a browser', async () => {
  mocks.platform.mockReturnValue('web')
  const { SecureStorage } = await import('../../src/services/secure-storage')
  await expect(SecureStorage.get({ key: 'auth_token' })).resolves.toEqual({ value: null })
  await SecureStorage.set({ key: 'auth_token', value: 'browser-token' })
  await expect(SecureStorage.get({ key: 'auth_token' })).resolves.toEqual({ value: 'browser-token' })
  expect(mocks.native.set).not.toHaveBeenCalled()
  expect(mocks.legacy.get).not.toHaveBeenCalled()
})

it('deduplicates concurrent restoration and prevents it from resurrecting logout', async () => {
  let resolve!: (value: { value: string }) => void
  mocks.native.get.mockImplementation(() => new Promise(r => { resolve = r }))
  const { SecureStorage } = await import('../../src/services/secure-storage')
  const first = SecureStorage.get({ key: 'auth_token' })
  const second = SecureStorage.get({ key: 'auth_token' })
  const removal = SecureStorage.remove({ key: 'auth_token' })
  resolve({ value: 'secure-token' })
  await Promise.all([first, second, removal])
  await expect(SecureStorage.get({ key: 'auth_token' })).resolves.toEqual({ value: null })
  expect(mocks.native.get).toHaveBeenCalledTimes(1)
  expect(mocks.native.remove).toHaveBeenCalledWith({ key: 'auth_token' })
})

it('uses one native read per session field and no bridge reads after restoration', async () => {
  mocks.native.get.mockImplementation(async ({ key }: { key: string }) => ({
    value:
      key === 'auth_token'
        ? 'secure-token'
        : JSON.stringify({ name: 'Root', email: 'root@example.test', role: 'super_admin' }),
  }))

  const { SecureStorage, secureStorageBridgeCalls } = await import('../../src/services/secure-storage')
  await Promise.all([
    SecureStorage.get({ key: 'auth_token' }),
    SecureStorage.get({ key: 'auth_token' }),
    SecureStorage.get({ key: 'auth_user' }),
    SecureStorage.get({ key: 'auth_user' }),
  ])
  expect(mocks.native.get).toHaveBeenCalledTimes(2)
  expect(secureStorageBridgeCalls().get).toBe(2)

  await SecureStorage.get({ key: 'auth_token' })
  await SecureStorage.get({ key: 'auth_user' })
  expect(mocks.native.get).toHaveBeenCalledTimes(2)
  expect(secureStorageBridgeCalls().get).toBe(2)
})
