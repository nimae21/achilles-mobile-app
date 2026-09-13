export const CSP_NONCE = 'achilles-ionic'
export const DEFAULT_API_URL = 'https://achilleswearyourweakness.shop/api'

function originFor(value: string | undefined, production: boolean): string {
  const raw = value?.trim() || DEFAULT_API_URL
  const url = new URL(raw)

  if (production && url.protocol !== 'https:') {
    throw new Error('Production VITE_API_BASE_URL must use HTTPS.')
  }
  if (!production && !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('VITE_API_BASE_URL must use HTTP or HTTPS.')
  }
  return url.origin
}

export function buildContentSecurityPolicy(apiUrl: string | undefined, production: boolean): string {
  const apiOrigin = originFor(apiUrl, production)
  const connect = new Set(["'self'", apiOrigin])
  const images = new Set(["'self'", 'data:', 'blob:', apiOrigin])

  if (!production) {
    connect.add('http://localhost:*')
    connect.add('http://127.0.0.1:*')
    connect.add('http://10.0.2.2:*')
    connect.add('ws://localhost:*')
    connect.add('ws://127.0.0.1:*')
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "script-src 'self'",
    `style-src 'self' 'nonce-${CSP_NONCE}'`,
    "style-src-attr 'none'",
    `img-src ${[...images].join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${[...connect].join(' ')}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    production ? 'upgrade-insecure-requests' : '',
  ].filter(Boolean).join('; ')
}