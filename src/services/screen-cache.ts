/*
|--------------------------------------------------------------------------
| Screen cache
|--------------------------------------------------------------------------
| The backend is remote, so reloading a screen costs real seconds. Keeping the
| last payload lets a screen paint instantly and refresh in the background.
|
| Two layers:
|  - memory, read synchronously by screens while they render, and
|  - Capacitor Preferences, so a cold start (app process killed) still shows
|    the last snapshot instead of a full skeleton.
|
| Entries are filed per signed-in account, sessions are cleared on sign-out,
| and the persisted copy only ever holds the payloads the screens already
| render: no tokens, no credentials, nothing the API does not already return
| to this device.
*/

import { Preferences } from '@capacitor/preferences'

type CacheEntry = { value: unknown; savedAt: number }

const PREFIX = 'screen_cache_entry:'
const SCOPE_KEY = 'screen_cache_scope'

/** Anything larger than this stays in memory; list payloads never need more. */
const MAX_ENTRY_BYTES = 128 * 1024
const MAX_PERSISTED_ENTRIES = 40
const MAX_AGE_MS = 24 * 60 * 60 * 1000

const store = new Map<string, CacheEntry>()

let scope = 'anonymous'
let hydrated = false
/** Persisted writes run one after another so a burst cannot interleave. */
let writes: Promise<void> = Promise.resolve()

function persistent(): boolean {
  return (
    typeof Preferences?.keys === 'function' &&
    typeof Preferences?.get === 'function' &&
    typeof Preferences?.set === 'function' &&
    typeof Preferences?.remove === 'function'
  )
}

function queue(action: () => Promise<void>): void {
  writes = writes.catch(() => undefined).then(action).catch(() => undefined)
}

function persistedKey(key: string): string {
  return `${PREFIX}${scope}:${encodeURIComponent(key)}`
}

/** Stable, non-reversible tag for the signed-in account. */
export function cacheScopeFor(email: string | null | undefined): string {
  if (!email) return 'anonymous'
  let hash = 0x811c9dc5
  const value = email.trim().toLowerCase()
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `u${hash.toString(16)}`
}

export function readCache<T>(key: string, maxAgeMs: number): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.savedAt > maxAgeMs) {
    store.delete(key)
    return null
  }
  return entry.value as T
}

export function writeCache<T>(key: string, value: T): void {
  const entry: CacheEntry = { value, savedAt: Date.now() }
  store.set(key, entry)
  if (!persistent()) return

  let serialised: string
  try {
    serialised = JSON.stringify(entry)
  } catch {
    return
  }
  if (serialised.length > MAX_ENTRY_BYTES) return

  queue(async () => {
    await Preferences.set({ key: persistedKey(key), value: serialised })
    await prune()
  })
}

export function clearCache(): void {
  store.clear()
  if (!persistent()) return
  queue(async () => {
    const { keys } = await Preferences.keys()
    await Promise.all(
      keys.filter((key) => key.startsWith(PREFIX)).map((key) => Preferences.remove({ key })),
    )
  })
}

/**
 * Points the cache at one account. Switching accounts (or signing out) drops
 * everything the previous one could have left behind, including the on-device
 * copy, so cached screens can never outlive a session.
 */
export function setCacheScope(next: string): void {
  if (next === scope) return
  scope = next
  store.clear()
  if (!persistent()) return
  queue(async () => {
    const { keys } = await Preferences.keys()
    await Promise.all(
      keys
        .filter((key) => key.startsWith(PREFIX) && !key.startsWith(`${PREFIX}${scope}:`))
        .map((key) => Preferences.remove({ key })),
    )
    await Preferences.set({ key: SCOPE_KEY, value: scope })
  })
}

/**
 * Restores the persisted entries for the current account. Called once during
 * boot, before the first screen renders, so the dashboard can paint from disk.
 */
export async function hydrateCache(): Promise<void> {
  if (hydrated || !persistent()) return
  hydrated = true

  try {
    const { keys } = await Preferences.keys()
    const mine = keys.filter((key) => key.startsWith(`${PREFIX}${scope}:`))
    const foreign = keys.filter(
      (key) => key.startsWith(PREFIX) && !key.startsWith(`${PREFIX}${scope}:`),
    )

    await Promise.all(foreign.map((key) => Preferences.remove({ key })))

    const entries = await Promise.all(
      mine.map(async (key) => {
        const { value } = await Preferences.get({ key })
        if (!value) return null

        const name = decodeURIComponent(key.slice(`${PREFIX}${scope}:`.length))
        try {
          const entry = JSON.parse(value) as CacheEntry
          if (typeof entry?.savedAt !== 'number') return null
          if (Date.now() - entry.savedAt > MAX_AGE_MS) {
            await Preferences.remove({ key })
            return null
          }
          return [name, entry] as const
        } catch {
          await Preferences.remove({ key })
          return null
        }
      }),
    )

    for (const entry of entries) {
      if (entry) store.set(entry[0], entry[1])
    }
  } catch {
    // A cache that cannot be read is simply an empty cache.
  }
}

/** Keeps the persisted copy small: oldest screens are dropped first. */
async function prune(): Promise<void> {
  if (store.size <= MAX_PERSISTED_ENTRIES) return
  const oldest = [...store.entries()].sort((a, b) => a[1].savedAt - b[1].savedAt)
  const excess = store.size - MAX_PERSISTED_ENTRIES

  for (const [key] of oldest.slice(0, excess)) {
    store.delete(key)
    await Preferences.remove({ key: persistedKey(key) })
  }
}
