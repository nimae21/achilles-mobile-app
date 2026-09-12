<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="dashboard" href="/tabs/dashboard">
          <ion-icon :icon="speedometerOutline" />
          <ion-label>Dashboard</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="orders" href="/tabs/orders">
          <ion-icon :icon="receiptOutline" />
          <ion-label>Orders</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="approvals" href="/tabs/approvals">
          <span class="tab-icon">
            <ion-icon :icon="shieldCheckmarkOutline" />
            <span v-if="notificationState.pendingApprovals" class="badge-dot">{{
              notificationState.pendingApprovals > 99 ? '99+' : notificationState.pendingApprovals
            }}</span>
          </span>
          <ion-label>Approvals</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="users" href="/tabs/users">
          <ion-icon :icon="peopleOutline" />
          <ion-label>Users</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="more" href="/tabs/more">
          <span class="tab-icon">
            <ion-icon :icon="ellipsisHorizontalOutline" />
            <span v-if="notificationState.unread" class="badge-dot">{{
              notificationState.unread > 99 ? '99+' : notificationState.unread
            }}</span>
          </span>
          <ion-label>More</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { IonPage, IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonRouterOutlet } from '@ionic/vue'
import {
  ellipsisHorizontalOutline,
  peopleOutline,
  receiptOutline,
  shieldCheckmarkOutline,
  speedometerOutline,
} from 'ionicons/icons'
import { notificationState, refreshUnread } from '../services/notifications'

/*
 * The badge numbers arrive with the dashboard and list payloads, so the tab bar
 * itself makes no requests. Only the unread count is re-checked when the app
 * returns to the foreground.
 */
onMounted(() => {
  window.addEventListener('app-resumed', () => void refreshUnread())
})
</script>

<style scoped>
.tab-icon {
  position: relative;
  display: inline-flex;
}

.tab-icon .badge-dot {
  position: absolute;
  top: -6px;
  right: -12px;
  min-width: 17px;
  height: 17px;
  font-size: 0.6rem;
  padding: 0 4px;
  border: 2px solid #fff;
}
</style>