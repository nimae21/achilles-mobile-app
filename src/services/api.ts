import { SecureStorage } from './secure-storage'
import { recordRequest } from './perf'

const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://achilleswearyourweakness.shop/api'
).replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export type OrderStatusKey = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled'
export type RoleKey = 'user' | 'admin' | 'super_admin'

export interface Page<T, C = Record<string, number>> {
  data: T[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  /** Badge counts shipped with the page, so no second request is needed. */
  counts?: C
}

export interface OrderCounts {
  all: number
  pending: number
  paid: number
  shipped: number
  completed: number
  cancelled: number
}

export interface ApprovalCounts {
  pending: number
  approved: number
  rejected: number
}

export interface Badges {
  unread_notifications: number
  pending_approvals: number
}

export interface SessionUser {
  name: string
  email: string
  role: RoleKey
  role_label: string
  is_active: boolean
  initials: string
}

export interface ProfilePayload {
  user: SessionUser
  permissions: Record<string, boolean>
}

export interface OrderSummary {
  id: number
  customer: string
  customer_email: string | null
  recipient: string | null
  phone: string | null
  total: number | string
  created_at: string | null
  status: string
  status_key: OrderStatusKey
  payment_method: string | null
  items_count: number | null
  address: string
}

export interface OrderItemLine {
  product: string
  product_id: number | null
  size: string | null
  color: string | null
  quantity: number
  price: number | string
  subtotal: number
}

export interface OrderPayment {
  status: string
  method: string | null
  reference: string | null
  paid_at: string | null
  refund_status: string | null
  refund_label: string | null
  refund_amount: number | null
}

export interface OrderTimelineEntry {
  label: string
  at: string | null
  by: string | null
  status: string | null
  kind: string
}

export interface OrderDetail extends OrderSummary {
  items: OrderItemLine[]
  shipping: {
    recipient: string | null
    phone: string | null
    street: string | null
    barangay: string | null
    city: string | null
    province: string | null
    postal_code: string | null
    latitude: number | null
    longitude: number | null
    map_url: string | null
  }
  payment: OrderPayment | null
  timeline: OrderTimelineEntry[]
}

export interface ApprovalSummary {
  id: number
  entity_type: string
  entity_label: string
  action_type: string
  status: 'pending' | 'approved' | 'rejected'
  summary: string
  requester: { id: number; name: string; email: string; initials: string } | null
  reviewer: string | null
  submitted_at: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  image_count: number
}

export interface ApprovalDetail extends ApprovalSummary {
  fields: { key: string; label: string; value: string }[]
  images: { path: string; url: string }[]
  raw_payload: Record<string, unknown>
}

export interface AccountSummary {
  id: number
  name: string
  email: string
  initials: string
  role: RoleKey
  role_label: string
  is_active: boolean
  status: string
  email_verified: boolean
  created_at: string | null
  orders_count: number | null
}

export interface AccountActivity {
  id: number
  action: string
  event: string
  subject: string | null
  created_at: string | null
}

export interface AccountDetail extends AccountSummary {
  orders_count: number
  approvals_submitted: number
  approvals_pending: number
  invited_by: string | null
  can_suspend: boolean
  recent_activity: AccountActivity[]
}

export interface AdminDetail {
  id: number
  name: string
  email: string
  initials: string
  role: RoleKey
  role_label: string
  is_active: boolean
  status: string
  email_verified: boolean
  created_at: string | null
  approvals_submitted: number
  approvals_approved: number
  approvals_pending: number
  invited_by: string | null
  can_suspend: boolean
  recent_activity: AccountActivity[]
}

export interface Invitation {
  id: number
  email: string
  invited_by: string | null
  expires_at: string | null
  accepted: boolean
  accepted_at: string | null
  created_at: string | null
}

export interface AccountCounts {
  users: { total: number; active: number; suspended: number }
  admins: { total: number; active: number; suspended: number }
  invitations_pending: number
  approvals_pending: number
}

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  route: string | null
  meta: Record<string, unknown>
  read: boolean
  created_at: string | null
}

export interface AuditLog {
  id: number
  action: string
  category: string
  event: string
  subject: string | null
  subject_type: string | null
  subject_id: number | null
  user: string
  user_id: number | null
  user_email: string | null
  ip_address: string | null
  changes: Record<string, { old: unknown; new: unknown }> | null
  created_at: string | null
}

export interface InventoryRow {
  id: number
  product_id: number
  product: string
  size: string | null
  color: string | null
  price: number | null
  remaining: number
  value: number | null
  state: 'ok' | 'low' | 'out'
  is_active: boolean
}

export interface DashboardAlert {
  severity: 'critical' | 'warning' | 'info'
  title: string
  body: string
  route: string | null
  icon: string
}

export interface DashboardData {
  generated_at: string
  summary: Record<string, number>
  sales_trend: { date: string; label: string; total: number }[]
  recent_orders: OrderSummary[]
  recent_activity: {
    id: number
    action: string
    event: string
    category: string
    subject: string | null
    user: string
    created_at: string | null
  }[]
  alerts: DashboardAlert[]
  badges: Badges
}

export interface PushStatus {
  configured: boolean
  worker_running: boolean
  registered: boolean
}

type Query = Record<string, string | number | boolean | null | undefined>

function query(params: Query = {}): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

/*
|--------------------------------------------------------------------------
| Session plumbing
|--------------------------------------------------------------------------
| Every request funnels through here so an expired or revoked token clears the
| stored session exactly once, even when several screens refresh together.
*/

let sessionVersion = 0
let sessionUpdates: Promise<void> = Promise.resolve()

function updateSession<T>(action: () => Promise<T>): Promise<T> {
  const result = sessionUpdates.then(action)
  sessionUpdates = result.then(() => undefined, () => undefined)
  return result
}

function clearSession(expectedVersion: number): Promise<boolean> {
  return updateSession(async () => {
    if (expectedVersion !== sessionVersion) return false
    sessionVersion++
    await SecureStorage.remove({ key: 'auth_token' })
    await SecureStorage.remove({ key: 'auth_user' })
    window.dispatchEvent(new Event('auth-cleared'))
    return true
  })
}

async function attempt<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
  timeoutMs = 15000,
  signal?: AbortSignal,
): Promise<T> {
  await sessionUpdates
  const requestVersion = sessionVersion
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  if (authenticated) {
    const { value } = await SecureStorage.get({ key: 'auth_token' })
    if (value) headers.set('Authorization', `Bearer ${value}`)
  }

  const controller = new AbortController()
  // The caller's signal (screen left, filters changed) and the timeout both
  // end up on one controller so `fetch` is always cancelled exactly once.
  let cancelled = false
  const cancel = () => {
    cancelled = true
    controller.abort()
  }
  if (signal?.aborted) cancel()
  else signal?.addEventListener('abort', cancel, { once: true })

  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${BASE_URL}${path}`, { ...options, headers, signal: controller.signal })
    if (response.status === 401 && authenticated && (await clearSession(requestVersion))) {
      window.dispatchEvent(new Event('auth-expired'))
    }
    const body = await response.text()
    let data: unknown
    try {
      data = body ? JSON.parse(body) : {}
    } catch {
      throw new ApiError('The server returned an unexpected response. Please try again.', response.status)
    }

    if (!response.ok) {
      const message =
        (data as { message?: string })?.message ||
        (response.status === 403
          ? 'You do not have permission to view this.'
          : 'Unable to complete the request.')
      throw new ApiError(message, response.status)
    }
    return data as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (cancelled) throw new ApiError('Request cancelled.', 0)
    throw new ApiError(
      controller.signal.aborted
        ? 'The server took too long to respond. Pull down to refresh and try again.'
        : 'Unable to reach the Achilles server. Check your connection and try again.',
      0,
    )
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', cancel)
  }
}

interface RequestConfig {
  timeoutMs?: number
  retries?: number
  /** Cancels the request when the screen leaves or newer filters replace it. */
  signal?: AbortSignal
}

/**
 * Identical GETs that overlap are served from the request already in flight.
 * Two screens asking for the same list at the same moment (or a screen
 * refreshing while the app resumes) cost one round trip instead of two.
 */
const inFlight = new Map<string, Promise<unknown>>()

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * A GET is retried once: mobile networks drop requests often and GETs are safe
 * to repeat. Mutations are never retried automatically - a duplicated approval
 * decision or account suspension would be a real problem.
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
  config: RequestConfig = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const retries = config.retries ?? (method === 'GET' ? 1 : 0)
  const timeoutMs = config.timeoutMs ?? 15000
  const startedAt = now()

  if (method === 'GET') {
    const shared = inFlight.get(path)
    if (shared) {
      recordRequest({ method, endpoint: path, status: 0, outcome: 'reused', ms: 0 })
      return shared as Promise<T>
    }
  }

  const run = async (): Promise<T> => {
    for (let attemptNumber = 0; ; attemptNumber++) {
      try {
        return await attempt<T>(path, options, authenticated, timeoutMs, config.signal)
      } catch (error) {
        // A cancelled request is not a failure worth retrying.
        const retryable = error instanceof ApiError && error.status === 0 && !config.signal?.aborted
        if (!retryable || attemptNumber >= retries) throw error
        await new Promise((resolve) => setTimeout(resolve, 350 * (attemptNumber + 1)))
      }
    }
  }

  const pending = run()
  if (method === 'GET') {
    inFlight.set(path, pending)
    const release = () => inFlight.delete(path)
    void pending.then(release, release)
  }

  try {
    const result = await pending
    recordRequest({ method, endpoint: path, status: 200, outcome: 'ok', ms: now() - startedAt })
    return result
  } catch (error) {
    recordRequest({
      method,
      endpoint: path,
      status: error instanceof ApiError ? error.status : 0,
      outcome: config.signal?.aborted ? 'cancelled' : 'failed',
      ms: now() - startedAt,
    })
    throw error
  }
}

export const api = {
  async login(email: string, password: string) {
    const data = await request<{ token: string; user: SessionUser }>(
      '/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false,
    )
    if (!data.token) throw new ApiError('The server did not return a login session.', 0)
    await updateSession(async () => {
      sessionVersion++
      await SecureStorage.set({ key: 'auth_token', value: data.token })
      await SecureStorage.set({ key: 'auth_user', value: JSON.stringify(data.user) })
      window.dispatchEvent(new Event('auth-changed'))
    })
    return data
  },

  async logout() {
    await sessionUpdates
    const logoutVersion = sessionVersion
    try {
      await request('/logout', { method: 'POST' })
    } finally {
      await clearSession(logoutVersion)
    }
  },

  async getUser(): Promise<SessionUser | null> {
    const { value } = await SecureStorage.get({ key: 'auth_user' })
    if (!value) return null
    try {
      return JSON.parse(value) as SessionUser
    } catch {
      return null
    }
  },

  async isAuthenticated(): Promise<boolean> {
    await sessionUpdates
    const { value } = await SecureStorage.get({ key: 'auth_token' })
    return !!value
  },

  me() {
    return request<ProfilePayload>('/me')
  },

  /** `fresh` bypasses the server-side 30s cache (used by pull-to-refresh). */
  dashboard(fresh = false, signal?: AbortSignal) {
    return request<DashboardData>(`/dashboard${fresh ? '?fresh=1' : ''}`, {}, true, {
      timeoutMs: 30000,
      signal,
    })
  },

  orders(params: { status?: string; search?: string; page?: number } = {}, signal?: AbortSignal) {
    return request<Page<OrderSummary, OrderCounts>>(`/orders${query(params)}`, {}, true, { signal })
  },
  orderCounts() {
    return request<Record<string, number>>('/orders/counts')
  },
  order(id: number | string, signal?: AbortSignal) {
    return request<OrderDetail>(`/orders/${encodeURIComponent(String(id))}`, {}, true, { signal })
  },

  approvals(params: { status?: string; search?: string; page?: number } = {}, signal?: AbortSignal) {
    return request<Page<ApprovalSummary, ApprovalCounts>>(`/approvals${query(params)}`, {}, true, { signal })
  },
  approvalCounts() {
    return request<{ pending: number; approved: number; rejected: number }>('/approvals/counts')
  },
  approval(id: number | string, signal?: AbortSignal) {
    return request<ApprovalDetail>(`/approvals/${encodeURIComponent(String(id))}`, {}, true, { signal })
  },
  reviewApprovals(payload: { ids: number[]; decision: 'approved' | 'rejected'; reason?: string }) {
    return request<{ message: string; reviewed: number[]; failed: { id: number; message: string }[] }>(
      '/approvals/review',
      { method: 'POST', body: JSON.stringify(payload) },
      true,
      { timeoutMs: 45000 },
    )
  },

  users(
    params: { role?: string; status?: string; search?: string; page?: number } = {},
    signal?: AbortSignal,
  ) {
    return request<Page<AccountSummary, AccountCounts>>(`/users${query(params)}`, {}, true, { signal })
  },
  userCounts() {
    return request<AccountCounts>('/users/counts')
  },
  user(id: number | string, signal?: AbortSignal) {
    return request<AccountDetail>(`/users/${encodeURIComponent(String(id))}`, {}, true, { signal })
  },
  setUserStatus(id: number | string, isActive: boolean) {
    return request<{ message: string; user: AccountSummary }>(
      `/users/${encodeURIComponent(String(id))}/status`,
      { method: 'PATCH', body: JSON.stringify({ is_active: isActive }) },
    )
  },
  admin(id: number | string, signal?: AbortSignal) {
    return request<AdminDetail>(`/admins/${encodeURIComponent(String(id))}`, {}, true, { signal })
  },
  invitations(params: { page?: number } = {}, signal?: AbortSignal) {
    return request<Page<Invitation>>(`/admin-invitations${query(params)}`, {}, true, { signal })
  },
  inviteAdmin(email: string) {
    return request<{ message: string; invitation: Invitation }>('/admin-invitations', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  inventory(params: { filter?: string; search?: string; page?: number } = {}, signal?: AbortSignal) {
    return request<Page<InventoryRow>>(`/inventory${query(params)}`, {}, true, { signal })
  },

  logs(
    params: {
      category?: string
      event?: string
      user_id?: number
      search?: string
      from?: string
      to?: string
      page?: number
    } = {},
    signal?: AbortSignal,
  ) {
    return request<Page<AuditLog>>(`/activity-logs${query(params)}`, {}, true, { signal })
  },
  logFilters() {
    return request<{
      categories: string[]
      events: string[]
      users: { id: number; name: string; role: string }[]
    }>('/activity-logs/filters')
  },
  log(id: number | string, signal?: AbortSignal) {
    return request<AuditLog>(`/activity-logs/${encodeURIComponent(String(id))}`, {}, true, { signal })
  },

  notifications(params: { filter?: string; page?: number } = {}, signal?: AbortSignal) {
    return request<Page<AppNotification, { unread: number }>>(
      `/notifications${query(params)}`,
      {},
      true,
      { signal },
    )
  },
  unreadCount() {
    return request<{ unread: number }>('/notifications/unread-count')
  },
  markNotificationRead(id: string) {
    return request<{ message: string; notification: AppNotification; unread: number }>(
      `/notifications/${encodeURIComponent(id)}/read`,
      { method: 'POST' },
    )
  },
  markAllNotificationsRead() {
    return request<{ message: string; unread: number }>('/notifications/read-all', { method: 'POST' })
  },

  getPushStatus(installationId: string) {
    return request<PushStatus>(`/push/status${query({ installation_id: installationId })}`)
  },
  registerPushDevice(installationId: string, token: string) {
    return request('/push/device', {
      method: 'PUT',
      body: JSON.stringify({ installation_id: installationId, token }),
    })
  },
  removePushDevice(installationId: string) {
    return request('/push/device', {
      method: 'DELETE',
      body: JSON.stringify({ installation_id: installationId }),
    })
  },
  testPush(installationId: string) {
    return request<{ message: string }>('/push/test', {
      method: 'POST',
      body: JSON.stringify({ installation_id: installationId }),
    })
  },
}
