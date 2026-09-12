import { createApp } from 'vue'
import App from './App.vue'
import router from './router';
import { initializePush } from './services/push'
import { initializeSession } from './services/session'
import { clearCache } from './services/screen-cache'
import { safeNotificationRedirect } from './services/notification-routing'

import { IonicVue } from '@ionic/vue';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/* Theme variables (light-only by design: the Super Admin console is a single
   deliberate palette rather than a half-themed dark mode). */
import './theme/variables.css';

// Never leave one account's cached screens behind for the next sign-in.
window.addEventListener('auth-cleared', () => clearCache())

window.addEventListener('auth-expired', () => {
  void router.replace({
    path: '/login',
    query: { redirect: safeNotificationRedirect(router.currentRoute.value.fullPath) },
  })
})

const app = createApp(App)
  .use(IonicVue)
  .use(router);

initializeSession()

router.isReady().then(() => {
  app.mount('#app');
  initializePush(router)
});