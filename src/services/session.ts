import { reactive } from 'vue'
import { api, type SessionUser } from './api'
import { refreshUnread, resetUnread } from './notifications'

export const session = reactive({
  user: null as SessionUser | null,
  ready: false,
})

export async function hydrateSession(): Promise<void> {
  session.user = await api.getUser()
  session.ready = true
  if (session.user) void refreshUnread()
  else resetUnread()
}

export async function adoptSession(user: SessionUser): Promise<void> {
  session.user = user
  session.ready = true
  await refreshUnread()
}

export function dropSession(): void {
  session.user = null
  session.ready = true
  resetUnread()
}

/** Keeps the reactive session in step with the token store. */
export function initializeSession(): void {
  window.addEventListener('auth-changed', () => {
    void hydrateSession()
  })
  window.addEventListener('auth-cleared', () => dropSession())
  window.addEventListener('auth-expired', () => dropSession())
  void hydrateSession()
}