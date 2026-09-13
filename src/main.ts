import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initializePush } from './services/push'
import { initializeSession } from './services/session'
import { clearCache, hydrateCache } from './services/screen-cache'
import { safeNotificationRedirect } from './services/notification-routing'
import { installPerfConsole, perfEnabled, setPerfScreen } from './services/perf'

import { IonicVue } from '@ionic/vue'

import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'
import '@ionic/vue/css/display.css'
import './theme/variables.css'

window.addEventListener('auth-cleared', () => {
  clearCache()
  if (router.currentRoute.value.meta.requiresAuth) void router.replace('/login')
})

window.addEventListener('auth-expired', () => {
  void router.replace({
    path: '/login',
    query: { redirect: safeNotificationRedirect(router.currentRoute.value.fullPath) },
  })
})

const app = createApp(App).use(IonicVue).use(router)

installPerfConsole()
if (perfEnabled()) router.afterEach((to) => setPerfScreen(to.fullPath))

// Paint the lightweight shell before any bridge call or route data request.
app.mount('#app')

// Legacy plaintext cache cleanup never loads screen payloads and stays off the
// startup path.
void hydrateCache().catch(() => undefined)

void initializeSession().finally(async () => {
  await router.isReady()
  initializePush(router)
})
