import { Preferences } from '@capacitor/preferences'

type CacheEntry = { value: unknown; savedAt: number }

// Admin payloads contain personal data. Keep them only for the current process.
const store = new Map<string, CacheEntry>()
const MAX_ENTRIES = 40
let scope = 'anonymous'
let cleanup: Promise<void> | undefined

/** Account partition tag; never persisted and not a security credential. */
export function cacheScopeFor(email: string | null | undefined): string {
  return email?.trim().toLowerCase() || 'anonymous'
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
  store.delete(key)
  store.set(key, { value, savedAt: Date.now() })
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
}

export function clearCache(): void {
  store.clear()
  void hydrateCache().catch(() => undefined)
}

export function setCacheScope(next: string): void {
  if (next === scope) return
  scope = next
  store.clear()
}

/** Compatibility entry point: delete legacy plaintext snapshots, never load them. */
export function hydrateCache(): Promise<void> {
  if (cleanup) return cleanup
  cleanup = (async () => {
    const { keys } = await Preferences.keys()
    await Promise.all(keys
      .filter((key) => key.startsWith('screen_cache_entry:') || key === 'screen_cache_scope')
      .map((key) => Preferences.remove({ key })))
  })().catch((error) => {
    cleanup = undefined
    throw error
  })
  return cleanup
}