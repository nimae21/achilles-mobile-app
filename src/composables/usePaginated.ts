import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Page } from '../services/api'
import { readCache, writeCache } from '../services/screen-cache'

type Filters = Record<string, unknown>

interface Options {
  filters?: () => Filters
  debounceMs?: number
  /** Enables the screen cache (60s in memory, also restored on cold start). */
  cacheKey?: string
  cacheMs?: number
}

type CachedPage<T, C> = {
  items: T[]
  counts?: C
  total: number
  lastPage: number
  savedAt: number
}

/**
 * Shared paging for every list screen: first load, pull-to-refresh, infinite
 * scroll and debounced filters.
 *
 * Three behaviours matter for a slow remote backend:
 *  - a warm cache paints instantly and then revalidates in the background,
 *  - a failed refresh keeps the last data on screen instead of blanking it, and
 *  - a response that arrives after newer filters were chosen is dropped (and
 *    its request cancelled), so the list can never show stale results.
 */
export function usePaginated<T, C = Record<string, number>>(
  fetcher: (params: Filters & { page: number }, signal: AbortSignal) => Promise<Page<T, C>>,
  options: Options = {},
) {
  const items = shallowRef<T[]>([])
  const counts = shallowRef<C | undefined>(undefined)
  const loading = ref(true)
  const refreshing = ref(false)
  const loadingMore = ref(false)
  const error = ref('')
  const stale = ref(false)
  const page = ref(1)
  const lastPage = ref(1)
  const total = ref(0)
  const hasMore = ref(false)

  const cacheMs = options.cacheMs ?? 60_000

  /** Each load takes a ticket; only the newest ticket may write to the screen. */
  let sequence = 0
  let inFlight: AbortController | undefined
  const lastLoadedAt = ref(0)

  function filterSnapshot(): Filters {
    return options.filters ? options.filters() : {}
  }

  function cacheId(): string {
    return `${options.cacheKey ?? ''}|${JSON.stringify(filterSnapshot())}`
  }

  function cacheCurrent(): void {
    if (!options.cacheKey) return
    const entry: CachedPage<T, C> = {
      items: items.value,
      counts: counts.value,
      total: total.value,
      lastPage: lastPage.value,
      savedAt: Date.now(),
    }
    writeCache(cacheId(), entry)
  }

  function hydrateFromCache(): boolean {
    if (!options.cacheKey) return false
    const cached = readCache<CachedPage<T, C>>(cacheId(), cacheMs)
    if (!cached) return false

    items.value = cached.items
    counts.value = cached.counts
    total.value = cached.total
    lastPage.value = cached.lastPage
    hasMore.value = false
    stale.value = true
    loading.value = false
    // Freshness is measured from when the data was fetched, not when it was
    // read back, so a cold start still revalidates immediately.
    lastLoadedAt.value = cached.savedAt
    return true
  }

  async function load(): Promise<void> {
    const ticket = ++sequence
    inFlight?.abort()
    const controller = new AbortController()
    inFlight = controller

    // Only show the skeleton when there is nothing to display yet.
    const hasData = items.value.length > 0
    loading.value = !hasData
    refreshing.value = hasData
    const snapshot = filterSnapshot()

    try {
      const result = await fetcher({ ...snapshot, page: 1 }, controller.signal)
      if (ticket !== sequence) return
      items.value = result.data
      counts.value = result.counts
      page.value = result.current_page
      lastPage.value = result.last_page
      total.value = result.total
      hasMore.value = result.current_page < result.last_page
      error.value = ''
      stale.value = false
      lastLoadedAt.value = Date.now()
      cacheCurrent()
    } catch (caught) {
      // A superseded or cancelled request says nothing about the current view.
      if (ticket !== sequence) return
      error.value = (caught as Error).message
      stale.value = items.value.length > 0
      if (items.value.length === 0) {
        total.value = 0
        hasMore.value = false
      }
    } finally {
      if (ticket === sequence) {
        loading.value = false
        refreshing.value = false
        inFlight = undefined
      }
    }
  }

  async function loadMore(event?: CustomEvent): Promise<void> {
    const complete = () => (event?.target as { complete?: () => void } | undefined)?.complete?.()
    if (loadingMore.value || !hasMore.value) {
      complete()
      return
    }
    const ticket = sequence
    loadingMore.value = true
    try {
      const result = await fetcher(
        { ...filterSnapshot(), page: page.value + 1 },
        new AbortController().signal,
      )
      if (ticket !== sequence) return
      items.value = [...items.value, ...result.data]
      page.value = result.current_page
      lastPage.value = result.last_page
      total.value = result.total
      hasMore.value = result.current_page < result.last_page
    } catch {
      // Keep what is already on screen; the user can pull to refresh.
    } finally {
      loadingMore.value = false
      complete()
    }
  }

  async function refresh(event?: CustomEvent): Promise<void> {
    await load()
    ;(event?.target as { complete?: () => void } | undefined)?.complete?.()
  }

  /**
   * Revalidates only when the screen's data has aged past `minAgeMs`. Used by
   * the resume handler: a tab visited seconds ago does not re-fetch just
   * because the phone was unlocked, while data older than the cache window is
   * refreshed straight away.
   */
  async function refreshIfStale(minAgeMs = cacheMs): Promise<void> {
    if (loading.value || refreshing.value || loadingMore.value) return
    if (Date.now() - lastLoadedAt.value < minAgeMs) return
    await load()
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  if (options.filters) {
    watch(
      () => JSON.stringify(options.filters?.() ?? {}),
      () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          if (!hydrateFromCache()) items.value = []
          void load()
        }, options.debounceMs ?? 300)
      },
    )
  }

  onMounted(() => {
    hydrateFromCache()
    void load()
  })

  onBeforeUnmount(() => {
    // The screen is gone: nothing it asked for may come back and write to it.
    sequence++
    inFlight?.abort()
  })

  return {
    items,
    counts,
    loading,
    refreshing,
    loadingMore,
    error,
    stale,
    page,
    lastPage,
    total,
    hasMore,
    lastLoadedAt,
    load,
    loadMore,
    refresh,
    refreshIfStale,
  }
}
