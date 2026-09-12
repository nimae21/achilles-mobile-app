import { reactive } from 'vue'
import { api } from './api'

/** Badges shared by the tab bar, the More menu and the notification list. */
export const notificationState = reactive({
  unread: 0,
  pendingApprovals: 0,
  refreshing: false,
})

export async function refreshUnread(): Promise<void> {
  if (!(await api.isAuthenticated())) {
    notificationState.unread = 0
    return
  }
  if (notificationState.refreshing) return
  notificationState.refreshing = true
  try {
    const { unread } = await api.unreadCount()
    notificationState.unread = unread
  } catch {
    // Keep the last known count: a failed badge refresh must never blank the UI.
  } finally {
    notificationState.refreshing = false
  }
}

export function setUnread(value: number): void {
  notificationState.unread = Math.max(0, value)
}

/**
 * The dashboard and the list screens already receive these numbers with their
 * own payload, so the badges cost no extra request.
 */
export function setBadges(badges: { unread?: number; approvals?: number }): void {
  if (badges.unread !== undefined) notificationState.unread = Math.max(0, badges.unread)
  if (badges.approvals !== undefined) notificationState.pendingApprovals = Math.max(0, badges.approvals)
}

export function resetUnread(): void {
  notificationState.unread = 0
  notificationState.pendingApprovals = 0
}