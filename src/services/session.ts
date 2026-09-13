import { reactive } from 'vue'
import { api, type SessionUser } from './api'
import { refreshUnread, resetUnread } from './notifications'
import { cacheScopeFor, setCacheScope } from './screen-cache'

export const session = reactive({
  user: null as SessionUser | null,
  ready: false,
})

let restoration: Promise<void> | undefined
let listenersInstalled = false

export async function hydrateSession(): Promise<void> {
  try {
    session.user = await api.getUser()
  } catch {
    await api.clearLocalSession()
    session.user = null
  }

  setCacheScope(cacheScopeFor(session.user?.email))
  session.ready = true
  if (session.user) void refreshUnread()
  else resetUnread()
}

export async function adoptSession(user: SessionUser): Promise<void> {
  session.user = user
  setCacheScope(cacheScopeFor(user.email))
  session.ready = true
  await refreshUnread()
}

export function dropSession(): void {
  session.user = null
  session.ready = true
  resetUnread()
}

export function initializeSession(): Promise<void> {
  if (!listenersInstalled) {
    listenersInstalled = true
    window.addEventListener('auth-changed', () => {
      void hydrateSession()
    })
    window.addEventListener('auth-cleared', () => dropSession())
    window.addEventListener('auth-expired', () => dropSession())
  }

  restoration ??= hydrateSession()
  return restoration
}