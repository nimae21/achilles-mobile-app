<template>
  <ion-page>
    <AppHeader title="Notifications" subtitle="Alerts from the Achilles backend" back>
      <template #end>
        <ion-button
          v-if="unread > 0"
          fill="clear"
          size="small"
          :disabled="busy"
          @click="markAll"
        >
          Mark all read
        </ion-button>
      </template>
    </AppHeader>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="chip-row" style="padding-top: 14px">
        <button
          v-for="chip in chips"
          :key="chip.key"
          type="button"
          :class="['chip', filter === chip.key ? 'chip--active' : '']"
          @click="filter = chip.key"
        >
          {{ chip.label }}
        </button>
      </div>

      <div class="page page--flush">
        <ListState
          :loading="loading"
          :error="error"
          :empty="items.length === 0"
          empty-title="No notifications"
          empty-body="Order, approval, account and inventory alerts land here in real time."
          :skeleton-rows="6"
          @retry="load"
        >
          <div class="card card--flush">
            <button
              v-for="alert in items"
              :key="alert.id"
              type="button"
              :class="['row notification', alert.read ? '' : 'notification--unread']"
              @click="open(alert)"
            >
              <div :class="['avatar', alert.read ? '' : 'avatar--red']">
                <ion-icon :icon="iconFor(alert.type)" />
              </div>
              <div class="row-main">
                <div class="row-title">{{ alert.title }}</div>
                <div class="row-sub notification-body">{{ alert.body }}</div>
                <div class="row-sub">{{ timeAgo(alert.created_at) }}</div>
              </div>
              <span v-if="!alert.read" class="unread-dot" />
            </button>
          </div>

          <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
            <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more" />
          </ion-infinite-scroll>
        </ListState>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/vue'
import {
  alertCircleOutline,
  bagCheckOutline,
  bagHandleOutline,
  cubeOutline,
  mailOutline,
  notificationsOutline,
  personCircleOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons'
import { api, type AppNotification } from '../services/api'
import { timeAgo } from '../services/format'
import { routeForAlert, safeRoute } from '../services/notification-routing'
import { setUnread } from '../services/notifications'
import { toast } from '../services/ui'
import { usePaginated } from '../composables/usePaginated'
import AppHeader from '../components/AppHeader.vue'
import ListState from '../components/ListState.vue'

const router = useRouter()
const filter = ref('all')
const busy = ref(false)
const unread = ref(0)

const chips = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
]

const { items, counts, loading, error, hasMore, load, loadMore, refresh } =
  usePaginated<AppNotification, { unread: number }>(
    (params) => api.notifications({ filter: filter.value, page: params.page }),
    { filters: () => ({ filter: filter.value }), cacheKey: 'notifications' },
  )

// The unread badge arrives with the list, so the screen needs no extra request.
watch(counts, (value) => {
  if (value) {
    unread.value = value.unread
    setUnread(value.unread)
  }
})

function iconFor(type: string): string {
  if (type.startsWith('order_paid')) return bagCheckOutline
  if (type.startsWith('order')) return bagHandleOutline
  if (type.startsWith('approval')) return shieldCheckmarkOutline
  if (type.startsWith('inventory')) return cubeOutline
  if (type.startsWith('invitation')) return mailOutline
  if (type.startsWith('account')) return personCircleOutline
  if (type === 'security_alert') return alertCircleOutline
  return notificationsOutline
}



async function open(alert: AppNotification): Promise<void> {
  if (!alert.read) {
    try {
      const result = await api.markNotificationRead(alert.id)
      alert.read = true
      unread.value = result.unread
      setUnread(result.unread)
    } catch {
      // Navigation still matters even if the read call failed.
    }
  }
  const path = safeRoute(alert.route) ?? routeForAlert({ type: alert.type, meta: alert.meta })
  if (path) await router.push(path)
}

async function markAll(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const result = await api.markAllNotificationsRead()
    await toast(result.message)
    unread.value = 0
    setUnread(0)
    items.value = items.value.map((item) => ({ ...item, read: true }))
    await load()
  } catch (caught) {
    await toast((caught as Error).message, 'danger')
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  // A pushed alert is the one case where the list has to be re-fetched.
  window.addEventListener('notifications-updated', () => void load())
  window.addEventListener('app-resumed', () => void load())
})

</script>

<style scoped>
.notification--unread {
  background: linear-gradient(90deg, rgba(220, 38, 38, 0.045) 0%, transparent 60%);
}

.notification-body {
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.unread-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--brand-red);
  flex-shrink: 0;
}

.avatar ion-icon {
  font-size: 1.05rem;
}
</style>