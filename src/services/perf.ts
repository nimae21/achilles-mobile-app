/*
|--------------------------------------------------------------------------
| Development performance log
|--------------------------------------------------------------------------
| Answers the questions that matter when a screen feels slow: which endpoint
| was called, how long it took, how many requests a screen made, which ones
| failed and how many were reused instead of being sent again.
|
| Everything here is behind `import.meta.env.DEV`, so production bundles ship
| no instrumentation and no verbose output. In development open the browser
| console and use:
|
|   __achillesPerf.report()   per-screen table for this session
|   __achillesPerf.entries    every raw sample
|   __achillesPerf.reset()    start a clean measurement
*/

export type PerfOutcome = 'ok' | 'failed' | 'cancelled' | 'reused'

export interface PerfEntry {
  /** Route that was on screen when the request was made. */
  screen: string
  method: string
  endpoint: string
  status: number
  outcome: PerfOutcome
  ms: number
}

export interface PerfScreenSummary {
  screen: string
  requests: number
  reused: number
  failed: number
  cancelled: number
  totalMs: number
  averageMs: number
  slowestMs: number
}

export interface PerfReport {
  screens: PerfScreenSummary[]
  slowest: PerfEntry[]
  failures: PerfEntry[]
}

const enabled = import.meta.env.DEV && import.meta.env.MODE !== 'test'

const MAX_SAMPLES = 500

const entries: PerfEntry[] = []

let screen = 'boot'
/** Index of the first sample that has not been summarised yet. */
let summarised = 0

export function perfEnabled(): boolean {
  return enabled
}

/** Called on every navigation so samples can be attributed to a screen. */
export function setPerfScreen(path: string): void {
  if (!enabled || path === screen) return
  summarise(screen)
  screen = path
}

export function recordRequest(entry: Omit<PerfEntry, 'screen'>): void {
  if (!enabled) return

  const sample: PerfEntry = { ...entry, screen }
  entries.push(sample)
  if (entries.length > MAX_SAMPLES) entries.splice(0, entries.length - MAX_SAMPLES)
  if (summarised > entries.length) summarised = entries.length

  const mark = entry.outcome === 'ok' ? 'ok' : entry.outcome === 'reused' ? 'reused' : entry.outcome
  const status = entry.status ? ` ${entry.status}` : ''
  console.debug(
    `[perf] ${mark} ${entry.method} ${entry.endpoint} ${Math.round(entry.ms)}ms${status}`,
  )
}

/** One line per screen describing what that screen actually cost. */
function summarise(label: string): void {
  if (summarised >= entries.length) return
  const part = entries.slice(summarised)
  summarised = entries.length

  const reused = part.filter((entry) => entry.outcome === 'reused').length
  const failed = part.filter((entry) => entry.outcome === 'failed').length
  const totalMs = part.reduce((sum, entry) => sum + entry.ms, 0)
  const slowest = part.reduce<PerfEntry | null>(
    (worst, entry) => (worst === null || entry.ms > worst.ms ? entry : worst),
    null,
  )

  console.info(
    `[perf] ${label} - ${part.length} request(s), ${reused} reused, ${failed} failed, ${Math.round(totalMs)}ms total` +
      (slowest ? `, slowest ${slowest.method} ${slowest.endpoint} ${Math.round(slowest.ms)}ms` : ''),
  )
}

function summariseScreen(name: string, samples: PerfEntry[]): PerfScreenSummary {
  const totalMs = samples.reduce((sum, entry) => sum + entry.ms, 0)

  return {
    screen: name,
    requests: samples.length,
    reused: samples.filter((entry) => entry.outcome === 'reused').length,
    failed: samples.filter((entry) => entry.outcome === 'failed').length,
    cancelled: samples.filter((entry) => entry.outcome === 'cancelled').length,
    totalMs: Math.round(totalMs),
    averageMs: samples.length ? Math.round(totalMs / samples.length) : 0,
    slowestMs: samples.reduce((worst, entry) => Math.max(worst, entry.ms), 0),
  }
}

export function perfReport(): PerfReport {
  const grouped = new Map<string, PerfEntry[]>()
  for (const entry of entries) {
    const bucket = grouped.get(entry.screen)
    if (bucket) bucket.push(entry)
    else grouped.set(entry.screen, [entry])
  }

  return {
    screens: [...grouped.entries()].map(([name, samples]) => summariseScreen(name, samples)),
    slowest: [...entries].sort((a, b) => b.ms - a.ms).slice(0, 10),
    failures: entries.filter((entry) => entry.outcome !== 'ok' && entry.outcome !== 'reused'),
  }
}

export function resetPerf(): void {
  entries.length = 0
  summarised = 0
}

declare global {
  interface Window {
    __achillesPerf?: {
      entries: PerfEntry[]
      report: () => PerfReport
      reset: () => void
    }
  }
}

/** Exposes the report in the console without leaking it into production. */
export function installPerfConsole(): void {
  if (!enabled) return
  window.__achillesPerf = {
    entries,
    report: () => {
      const report = perfReport()
      console.table(report.screens)
      if (report.failures.length) console.table(report.failures)
      return report
    },
    reset: resetPerf,
  }
}
