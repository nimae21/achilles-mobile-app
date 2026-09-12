<template>
  <ion-page>
    <AppHeader title="Settings" subtitle="Phone alerts and app info" back default-href="/tabs/more" />

    <ion-content>
      <div class="page">
        <section class="section">
          <div class="section-head"><h2 class="section-title">Phone notifications</h2></div>
          <div class="card">
            <div class="status-line">
              <ion-icon :icon="pushIcon" :class="['status-icon', statusClass]" />
              <div>
                <div class="row-title">{{ statusTitle }}</div>
                <div class="row-sub">{{ statusMessage }}</div>
              </div>
            </div>

            <div class="actions">
              <button
                v-if="pushState.status !== 'registered'"
                class="btn btn--primary"
                :disabled="pushState.busy || pushState.status === 'browser'"
                @click="enable"
              >
                {{ pushState.busy ? 'Checking…' : 'Enable notifications' }}
              </button>
              <button
                v-else
                class="btn btn--ghost"
                :disabled="pushState.busy"
                @click="sendTest"
              >
                <ion-icon :icon="paperPlaneOutline" />
                Send a test notification
              </button>
              <button
                v-if="pushState.status === 'registered'"
                class="btn btn--danger"
                :disabled="pushState.busy"
                @click="disable"
              >
                Turn alerts off
              </button>
              <button v-else class="btn btn--ghost" :disabled="pushState.busy" @click="recheck">
                <ion-icon :icon="refreshOutline" />
                Check status again
              </button>
            </div>

            <p v-if="pushState.testMessage" class="test-message">{{ pushState.testMessage }}</p>
          </div>
        </section>

        <section class="section">
          <div class="section-head"><h2 class="section-title">Delivery</h2></div>
          <div class="card">
            <KeyValue label="Provider" value="Firebase Cloud Messaging" />
            <KeyValue label="Worker" :value="pushState.workerRunning ? 'Running' : 'Not detected'" />
            <KeyValue label="Backend" :value="apiBase" />
          </div>
          <p class="note">
            Alerts are created by the Laravel backend when something happens on the website. The phone never
            decides that an order was paid.
          </p>
        </section>

        <section class="section">
          <div class="section-head"><h2 class="section-title">App</h2></div>
          <div class="card">
            <KeyValue label="Application" value="Achilles Super Admin" />
            <KeyValue label="Signed in as" :value="session.user?.email" />
            <KeyValue label="Role" :value="session.user?.role_label" />
          </div>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { IonContent, IonIcon, IonPage } from '@ionic/vue'
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  notificationsOffOutline,
  paperPlaneOutline,
  refreshOutline,
} from 'ionicons/icons'
import { disablePush, pushState, refreshPushStatus, sendTestPush } from '../services/push'
import { session } from '../services/session'
import AppHeader from '../components/AppHeader.vue'
import KeyValue from '../components/KeyValue.vue'

const apiBase = (import.meta.env.VITE_API_BASE_URL || 'https://achilleswearyourweakness.shop/api').replace(
  /\/api$/,
  '',
)

const pushIcon = computed(() => {
  if (pushState.status === 'registered') return checkmarkCircleOutline
  if (['error', 'denied'].includes(pushState.status)) return alertCircleOutline
  return notificationsOffOutline
})

const statusClass = computed(() =>
  pushState.status === 'registered' ? 'ok' : pushState.status === 'error' ? 'bad' : '',
)

const statusTitle = computed(() => {
  switch (pushState.status) {
    case 'registered':
      return 'Notifications are on'
    case 'registering':
      return 'Registering this phone…'
    case 'denied':
      return 'Permission denied'
    case 'not_configured':
      return 'Server push is not configured'
    case 'browser':
      return 'Android app required'
    case 'error':
      return 'Something went wrong'
    default:
      return 'Notifications are off'
  }
})

const statusMessage = computed(() => {
  switch (pushState.status) {
    case 'registered':
      return pushState.workerRunning
        ? 'This phone receives order, approval, account and inventory alerts.'
        : 'Registered. Background delivery resumes when the server worker is running.'
    case 'registering':
      return 'Waiting for Firebase to confirm this device.'
    case 'denied':
      return 'Allow notifications for Achilles in Android Settings, then check again.'
    case 'not_configured':
      return 'Push needs Firebase credentials and the delivery worker on the server.'
    case 'browser':
      return 'Push notifications only work in the installed Android app.'
    case 'error':
      return pushState.message || 'Please try again.'
    default:
      return 'Turn on alerts to hear about orders and approvals as they happen.'
  }
})

const enable = () => void refreshPushStatus(true)
const recheck = () => void refreshPushStatus()
const sendTest = () => void sendTestPush()
const disable = async () => {
  await disablePush()
}

onMounted(() => void refreshPushStatus())
</script>

<style scoped>
.status-line {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-icon {
  font-size: 1.5rem;
  color: var(--slate-400);
}

.status-icon.ok {
  color: var(--ok);
}

.status-icon.bad {
  color: var(--danger);
}

.test-message {
  margin: 12px 0 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--slate-600);
}

.note {
  margin: 12px 4px 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--slate-500);
}
</style>