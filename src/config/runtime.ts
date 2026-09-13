const numberFromEnv = (
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.round(parsed))) : fallback
}

export const requestPolicy = Object.freeze({
  timeoutMs: numberFromEnv(import.meta.env.VITE_API_TIMEOUT_MS, 8_000, 3_000, 20_000),
  longTimeoutMs: numberFromEnv(import.meta.env.VITE_API_LONG_TIMEOUT_MS, 20_000, 5_000, 30_000),
  getRetries: numberFromEnv(import.meta.env.VITE_API_GET_RETRIES, 1, 0, 2),
  retryBaseMs: numberFromEnv(import.meta.env.VITE_API_RETRY_BASE_MS, 350, 100, 2_000),
  maxRetryAfterMs: numberFromEnv(import.meta.env.VITE_API_MAX_RETRY_AFTER_MS, 5_000, 500, 15_000),
})