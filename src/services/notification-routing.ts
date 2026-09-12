/*
|--------------------------------------------------------------------------
| Notification deep links
|--------------------------------------------------------------------------
| Alert payloads arrive from the backend (and from Firebase data messages), so
| every route is validated against an allow-list before the router sees it. A
| tampered payload can never push the app to an arbitrary location.
*/

const ORDER = /^\/tabs\/orders\/[1-9]\d{0,14}$/
const APPROVAL = /^\/tabs\/approvals\/[1-9]\d{0,14}$/
const CUSTOMER = /^\/tabs\/users\/[1-9]\d{0,14}$/
const ADMIN = /^\/tabs\/users\/admins\/[1-9]\d{0,14}$/
const LOG = /^\/tabs\/logs\/[1-9]\d{0,14}$/

const STATIC_ROUTES = [
  '/tabs/dashboard',
  '/tabs/orders',
  '/tabs/approvals',
  '/tabs/users',
  '/tabs/users/admins',
  '/tabs/users/admins/invitations',
  '/tabs/notifications',
  '/tabs/logs',
  '/tabs/inventory',
  '/tabs/profile',
  '/tabs/settings',
  '/tabs/more',
]

export const HOME_ROUTE = '/tabs/dashboard'

export function isSafeRoute(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const path = value.split('?')[0]
  return (
    STATIC_ROUTES.includes(path) ||
    ORDER.test(path) ||
    APPROVAL.test(path) ||
    CUSTOMER.test(path) ||
    ADMIN.test(path) ||
    LOG.test(path)
  )
}

/** Returns a validated in-app path, or null when the payload cannot be trusted. */
export function safeRoute(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const [path, search] = value.split('?')
  if (!isSafeRoute(path)) return null
  // Only the inventory screen uses a query string today, and only its filter.
  if (search) {
    const params = new URLSearchParams(search)
    const filter = params.get('filter')
    if (path === '/tabs/inventory' && filter && ['all', 'low', 'out'].includes(filter)) {
      return `${path}?filter=${filter}`
    }
    return path
  }
  return path
}

/** Numeric id -> resource path, with the same strict validation. */
export function numericPath(value: unknown, base: string): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value)
  if (!/^[1-9]\d{0,14}$/.test(text)) return null
  return `${base}/${text}`
}

export function notificationOrderPath(value: unknown): string | null {
  return numericPath(value, '/tabs/orders')
}

/** Redirect target after login, falling back to the dashboard. */
export function safeNotificationRedirect(value: unknown): string {
  return safeRoute(value) ?? HOME_ROUTE
}

/**
 * Resolves the destination for a push payload. The backend sends `route`; the
 * type/meta fallbacks keep older alerts tappable.
 */
export function routeForAlert(data: Record<string, unknown> | undefined | null): string | null {
  if (!data) return null
  const explicit = safeRoute(data.route)
  if (explicit) return explicit

  const type = String(data.type ?? '')
  const meta = (data.meta ?? {}) as Record<string, unknown>

  if (type.startsWith('order')) {
    return notificationOrderPath(data.order_id ?? meta.order_id)
  }
  if (type.startsWith('approval')) {
    return numericPath(meta.approval_id, '/tabs/approvals') ?? '/tabs/approvals'
  }
  if (type === 'invitation_accepted') return '/tabs/users/admins'
  if (type === 'account_suspended' || type === 'account_reactivated') {
    const id = numericPath(meta.user_id, '/tabs/users')
    if (!id) return '/tabs/users'
    return meta.role === 'admin' ? id.replace('/tabs/users/', '/tabs/users/admins/') : id
  }
  if (type.startsWith('inventory')) return '/tabs/inventory'
  if (type === 'security_alert') return '/tabs/logs'

  return null
}