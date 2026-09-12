import { onMounted, ref, shallowRef, watch } from 'vue'
import type { Page } from '../services/api'
import { readCache, writeCache } from '../services/screen-cache'

type Filters = Record<string, unknown>

interface Options {
  filters?: () => Filters
  debounceMs?: number
  /** Enables the in-memory screen cache (60s by default). */
  cacheKey?: string
  cacheMs?: number
}

type CachedPage<T, C> = {
  items: T[]
  counts?: C
  total: number
  lastPage: number
}

/**
 * Shared paging for every list screen: first load, pull-to-refresh, infinite
 * scroll and debounced filters.
 *
 * Two behaviours matter for a slow remote backend:
 *  - a warm cache paints instantly and then revalidates in the background, and
 *  - a failed refresh keeps the last data on screen instead of blanking it.
 */
export function usePaginated<T, C = Record<string, number>>(
  fetcher: (params: Filters & { page: number }) => Promise<Page<T, C>>,
  options: Options = {},
) {
  const items = shallowRef<T[]>([])
  const counts = shallowRef<C | undefined>(undefined)
  const loading = ref(true)
  const loadingMore = ref(false)
  const error = ref('')
  const stale = ref(false)
  const page = ref(1)
  const lastPage = ref(1)
  const total = ref(0)
  const hasMore = ref(false)

  const cacheMs = options.cacheMs ?? 60_000

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
    return true
  }

  async function load(): Promise<void> {
    // Only show the skeleton when there is nothing to display yet.
    loading.value = items.value.length === 0
    const snapshot = filterSnapshot()

    try {
      const result = await fetcher({ ...snapshot, page: 1 })
      items.value = result.data
      counts.value = result.counts
      page.value = result.current_page
      lastPage.value = result.last_page
      total.value = result.total
      hasMore.value = result.current_page < result.last_page
      error.value = ''
      stale.value = false
      cacheCurrent()
    } catch (caught) {
      error.value = (caught as Error).message
      stale.value = items.value.length > 0
      if (items.value.length === 0) {
        total.value = 0
        hasMore.value = false
      }
    } finally {
      loading.value = false
    }
  }

  async function loadMore(event?: CustomEvent): Promise<void> {
    const complete = () => (event?.target as { complete?: () => void } | undefined)?.complete?.()
    if (loadingMore.value || !hasMore.value) {
      complete()
      return
    }
    loadingMore.value = true
    try {
      const result = await fetcher({ ...filterSnapshot(), page: page.value + 1 })
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

  return {
    items,
    counts,
    loading,
    loadingMore,
    error,
    stale,
    page,
    lastPage,
    total,
    hasMore,
    load,
    loadMore,
    refresh,
  }
}