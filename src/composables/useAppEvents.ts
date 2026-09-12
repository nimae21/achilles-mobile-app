import { onBeforeUnmount, onMounted } from 'vue'

/**
 * Window events are how the app signals work that happened elsewhere: a push
 * arrival, a list that another screen already updated, the phone coming back
 * to the foreground. Registering through here keeps the listener and its
 * cleanup in step, so a screen can never leave a handler behind.
 */
export function onAppEvent(name: string, handler: () => void): void {
  const listener = (): void => handler()
  onMounted(() => window.addEventListener(name, listener))
  onBeforeUnmount(() => window.removeEventListener(name, listener))
}

/** The phone returned to the foreground. */
export function onAppResume(handler: () => void): void {
  onAppEvent('app-resumed', handler)
}
