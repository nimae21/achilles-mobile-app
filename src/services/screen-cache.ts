/*
|--------------------------------------------------------------------------
| Screen cache
|--------------------------------------------------------------------------
| The backend is remote, so reloading a screen costs real seconds. Keeping the
| last payload in memory lets a screen paint instantly and refresh in the
| background. It is cleared on sign-out so one account never shows another's
| data.
*/

type CacheEntry = { value: unknown; savedAt: number }

const store = new Map<string, CacheEntry>()

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
  store.set(key, { value, savedAt: Date.now() })
}

export function clearCache(): void {
  store.clear()
}