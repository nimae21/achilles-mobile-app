import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

type SessionKey = 'auth_token' | 'auth_user'
interface Storage {
  get(options: { key: SessionKey }): Promise<{ value: string | null }>
  set(options: { key: SessionKey; value: string }): Promise<void>
  remove(options: { key: SessionKey }): Promise<void>
}
const native = registerPlugin<Storage>('SecureSession')
const memory = new Map<SessionKey, string | null>()
const pending = new Map<SessionKey, Promise<{ value: string | null }>>()
const bridgeCalls = { get: 0, set: 0, remove: 0 }

export function secureStorageBridgeCalls(): Readonly<typeof bridgeCalls> {
  return { ...bridgeCalls }
}

export const SecureStorage: Storage = {
  async get({ key }) {
    if (memory.has(key)) return { value: memory.get(key) ?? null }
    const existing = pending.get(key)
    if (existing) return existing
    const work = (async () => {
      let value: string | null = null
      if (Capacitor.getPlatform() === 'android') {
        bridgeCalls.get++
        value = (await native.get({ key })).value
        if (value === null) {
          value = (await Preferences.get({ key })).value
          // Commit encryption before deleting a legacy value. Failure never
          // falls back to writing or authenticating from plaintext storage.
          if (value !== null) {
            bridgeCalls.set++
            await native.set({ key, value })
          }
        }
      }
      await Preferences.remove({ key })
      memory.set(key, value)
      return { value }
    })()
    pending.set(key, work)
    try { return await work } finally { pending.delete(key) }
  },
  async set({ key, value }) {
    await pending.get(key)
    if (Capacitor.getPlatform() === 'android') {
      bridgeCalls.set++
      await native.set({ key, value })
    }
    await Preferences.remove({ key })
    memory.set(key, value)
  },
  async remove({ key }) {
    // Wait for restoration so it cannot resurrect a signed-out session.
    await pending.get(key)?.catch(() => undefined)
    memory.set(key, null)
    if (Capacitor.getPlatform() === 'android') {
      bridgeCalls.remove++
      await native.remove({ key })
    }
    await Preferences.remove({ key })
  },
}