import { reactive } from 'vue'
import type { Router } from 'vue-router'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Preferences } from '@capacitor/preferences'
import { PushNotifications } from '@capacitor/push-notifications'
import { api } from './api'
import { safeRoute, routeForAlert } from './notification-routing'
import { refreshUnread } from './notifications'

export const pushState = reactive({
  status: 'idle' as
    | 'idle'
    | 'browser'
    | 'not_configured'
    | 'off'
    | 'denied'
    | 'registering'
    | 'registered'
    | 'error',
  message: '',
  workerRunning: false,
  busy: false,
  testMessage: '',
})

const isAndroid = () => Capacitor.getPlatform() === 'android'
const buildEnabled = () => import.meta.env.VITE_PUSH_ENABLED === 'true'

let epoch = 0
let cleanup: Promise<void> = Promise.resolve()
let listeners: Promise<void> | undefined
let initialized = false
let appRouter: Router | undefined

type Registration = { epoch: number; resolve: () => void; reject: (error: Error) => void }
let registration: Registration | undefined

export async function installationId(): Promise<string> {
  const existing = await Preferences.get({ key: 'push_installation_id' })
  if (existing.value) return existing.value
  const id = crypto.randomUUID()
  await Preferences.set({ key: 'push_installation_id', value: id })
  return id
}

async function saveRegistration(value: string): Promise<void> {
  const current = epoch
  const pending = registration
  try {
    if (!(await api.isAuthenticated()) || current !== epoch) return
    // FCM can rotate its token after the initial registration has completed.
    if (!pending && (await Preferences.get({ key: 'push_opt_in' })).value !== 'true') return
    const id = await installationId()
    if (current !== epoch) return
    await api.registerPushDevice(id, value)
    if (current !== epoch) return
    pushState.status = 'registered'
    pushState.message = ''
    pending?.resolve()
  } catch (error) {
    if (current !== epoch) return
    if (pending) pending.reject(error as Error)
    else {
      pushState.status = 'error'
      pushState.message = 'Could not refresh this phone registration. Please check status again.'
    }
  }
}

function setupListeners(): Promise<void> {
  if (listeners) return listeners
  const handles: PluginListenerHandle[] = []
  listeners = (async () => {
    try {
      handles.push(
        await PushNotifications.addListener('registration', ({ value }) => {
          void saveRegistration(value)
        }),
      )
      handles.push(
        await PushNotifications.addListener('registrationError', () => {
          registration?.reject(
            new Error('Phone registration failed. Check your connection and notification setup, then retry.'),
          )
        }),
      )
      handles.push(
        await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
          if (!(await api.isAuthenticated())) return
          if (notification.data?.type === 'test') pushState.testMessage = 'Test notification received on this phone.'
          // Only the badge is refreshed here; screens reload from the API when opened.
          void refreshUnread()
          window.dispatchEvent(new Event('notifications-updated'))
        }),
      )
      handles.push(
        await PushNotifications.addListener('pushNotificationActionPerformed', async ({ notification }) => {
          const data = (notification.data ?? {}) as Record<string, unknown>
          const explicit = safeRoute(data.route)
          const path = explicit ?? routeForAlert(data)
          const notificationId = typeof data.notification_id === 'string' ? data.notification_id : ''
          if (notificationId) {
            try {
              await api.markNotificationRead(notificationId)
            } catch {
              // The notification may already be gone; navigation still matters.
            }
          }
          if (!appRouter) return
          if (await api.isAuthenticated()) {
            await appRouter.push(path ?? '/tabs/notifications')
          } else {
            await appRouter.replace({ path: '/login', query: path ? { redirect: path } : {} })
          }
          void refreshUnread()
          window.dispatchEvent(new Event('notifications-updated'))
        }),
      )
      handles.push(
        await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            void refreshPushStatus()
            void refreshUnread()
            window.dispatchEvent(new Event('app-resumed'))
          }
        }),
      )
    } catch (error) {
      await Promise.allSettled(handles.map((handle) => handle.remove()))
      listeners = undefined
      throw error
    }
  })()
  return listeners
}

async function registerPhone(current: number): Promise<void> {
  await setupListeners()
  if (current !== epoch) return
  await PushNotifications.createChannel({
    id: 'orders',
    name: 'Achilles alerts',
    description: 'Orders, approvals, accounts and inventory alerts',
    importance: 5,
    sound: 'default',
    visibility: 0,
  })
  if (current !== epoch) return
  pushState.status = 'registering'
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => pending.reject(new Error('Phone registration timed out. Please retry.')), 20000)
    const finish = () => {
      clearTimeout(timer)
      if (registration === pending) registration = undefined
    }
    const pending: Registration = {
      epoch: current,
      resolve: () => {
        finish()
        resolve()
      },
      reject: (error) => {
        finish()
        reject(error)
      },
    }
    registration = pending
    // Tie native rejections to this attempt, never a newer registration attempt.
    void PushNotifications.register().catch((error) => pending.reject(error))
  })
}

export async function refreshPushStatus(askPermission = false): Promise<void> {
  if (pushState.busy) return
  if (!isAndroid()) {
    pushState.status = 'browser'
    return
  }
  if (!buildEnabled()) {
    pushState.status = 'not_configured'
    pushState.message = 'Push notifications are not configured in this app build yet.'
    return
  }
  const current = epoch
  pushState.busy = true
  try {
    await cleanup
    if (current !== epoch || !(await api.isAuthenticated())) return
    const id = await installationId()
    if (current !== epoch) return
    const server = await api.getPushStatus(id)
    if (current !== epoch) return
    pushState.workerRunning = server.worker_running
    if (!server.configured) {
      pushState.status = 'not_configured'
      pushState.message = 'Push notifications are not configured on the server yet.'
      return
    }
    let permission = await PushNotifications.checkPermissions()
    if (current !== epoch) return
    if (askPermission && ['prompt', 'prompt-with-rationale'].includes(permission.receive)) {
      // Remember that this phone has been asked: a declined or dismissed
      // prompt must not be pushed at the Super Admin on every sign-in.
      await Preferences.set({ key: 'push_permission_asked', value: 'true' })
      if (current !== epoch) return
      permission = await PushNotifications.requestPermissions()
      if (current !== epoch) return
    }
    if (current !== epoch) return
    if (permission.receive === 'denied') {
      pushState.status = 'denied'
      pushState.message = 'Allow notifications for Achilles in Android Settings, then check again.'
      if (server.registered) await api.removePushDevice(id)
      return
    }
    const optedIn = (await Preferences.get({ key: 'push_opt_in' })).value === 'true'
    if (current !== epoch) return
    if (permission.receive !== 'granted' || (!askPermission && !optedIn)) {
      pushState.status = 'off'
      pushState.message = ''
      return
    }
    await registerPhone(current)
    if (current === epoch) await Preferences.set({ key: 'push_opt_in', value: 'true' })
  } catch (error) {
    if (current === epoch) {
      pushState.status = 'error'
      pushState.message = (error as Error).message
    }
  } finally {
    if (current === epoch) pushState.busy = false
  }
}

/**
 * Sign-in handoff. A Super Admin who has just signed in on this phone is asked
 * for notification permission once, the phone registers with FCM and Laravel
 * is handed the token. A phone where alerts were deliberately turned off is
 * never re-registered behind the Super Admin's back.
 */
export async function ensurePushRegistered(): Promise<void> {
  if (!isAndroid() || !buildEnabled()) return
  if (pushState.busy) return

  const [answered, asked] = await Promise.all([
    Preferences.get({ key: 'push_opt_in' }),
    Preferences.get({ key: 'push_permission_asked' }),
  ])

  await refreshPushStatus(!answered.value && asked.value !== 'true')
}

export async function disablePush(): Promise<void> {
  if (pushState.busy) return
  const current = ++epoch
  pushState.busy = true
  registration?.reject(new Error('Registration cancelled.'))
  // New logins wait for all old native cleanup, including a concurrent disable.
  cleanup = cleanup.catch(() => undefined).then(async () => {
    await Preferences.set({ key: 'push_opt_in', value: 'false' })
    if (current !== epoch) return
    const id = await installationId()
    if (current !== epoch) return
    const results = await Promise.allSettled([
      api.removePushDevice(id),
      PushNotifications.unregister(),
      PushNotifications.removeAllDeliveredNotifications(),
    ])
    if (current !== epoch) return
    if (results.some((result) => result.status === 'rejected')) {
      pushState.status = 'error'
      pushState.message = 'Could not fully disconnect alerts. Check your connection and try again.'
    } else {
      pushState.status = 'off'
      pushState.message = ''
      pushState.testMessage = ''
    }
  })
  try {
    await cleanup
  } catch {
    if (current === epoch) {
      pushState.status = 'error'
      pushState.message = 'Could not turn alerts off. Please retry.'
    }
  } finally {
    if (current === epoch) pushState.busy = false
  }
}

export async function sendTestPush(): Promise<void> {
  if (pushState.busy || pushState.status !== 'registered') return
  const current = epoch
  pushState.busy = true
  pushState.testMessage = ''
  try {
    const id = await installationId()
    if (current !== epoch) return
    const result = await api.testPush(id)
    if (current === epoch && !pushState.testMessage) pushState.testMessage = result.message
  } catch (error) {
    if (current === epoch) pushState.testMessage = (error as Error).message
  } finally {
    if (current === epoch) pushState.busy = false
  }
}

export async function clearPushSession(): Promise<void> {
  epoch++
  registration?.reject(new Error('Signed out.'))
  pushState.status = 'off'
  pushState.busy = false
  pushState.message = ''
  pushState.testMessage = ''
  pushState.workerRunning = false
  cleanup = cleanup.catch(() => undefined).then(async () => {
    if (isAndroid() && buildEnabled()) {
      await Promise.allSettled([PushNotifications.unregister(), PushNotifications.removeAllDeliveredNotifications()])
    }
  })
  await cleanup
}

export function initializePush(router: Router): void {
  appRouter = router
  if (initialized) return
  initialized = true
  window.addEventListener('auth-cleared', () => {
    void clearPushSession()
  })
  window.addEventListener('auth-changed', () => {
    // A fresh sign-in is exactly when the phone should be registered.
    void ensurePushRegistered()
  })
  if (isAndroid() && buildEnabled()) {
    void setupListeners()
      .then(() => ensurePushRegistered())
      .catch(() => {
        pushState.status = 'error'
        pushState.message = 'Could not initialize phone notifications.'
      })
  }
}
