<template>
  <ion-page>
    <AppHeader title="More" subtitle="Tools, logs and account" />

    <ion-content>
      <div class="page">
        <div class="card profile-card">
          <div class="avatar avatar--lg avatar--red">{{ session.user?.initials ?? 'SA' }}</div>
          <div class="profile-main">
            <h2>{{ session.user?.name ?? 'Super Admin' }}</h2>
            <p class="muted">{{ session.user?.email }}</p>
            <span class="pill pill--brand">{{ session.user?.role_label ?? 'Super Admin' }}</span>
          </div>
        </div>

        <section class="section">
          <div class="section-head"><h2 class="section-title">Monitoring</h2></div>
          <div class="card card--flush">
            <button type="button" class="row" @click="go('/tabs/notifications')">
              <div class="avatar"><ion-icon :icon="notificationsOutline" /></div>
              <div class="row-main">
                <div class="row-title">Notifications</div>
                <div class="row-sub">Order, approval, account and inventory alerts</div>
              </div>
              <div class="row-side">
                <span v-if="notificationState.unread" class="badge-dot">{{
                  notificationState.unread > 99 ? '99+' : notificationState.unread
                }}</span>
                <ion-icon v-else :icon="chevronForwardOutline" class="row-chevron" />
              </div>
            </button>

            <button type="button" class="row" @click="go('/tabs/logs')">
              <div class="avatar"><ion-icon :icon="documentTextOutline" /></div>
              <div class="row-main">
                <div class="row-title">Audit logs</div>
                <div class="row-sub">Who did what, when and to which record</div>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="row-chevron" />
            </button>

            <button type="button" class="row" @click="go('/tabs/inventory')">
              <div class="avatar"><ion-icon :icon="cubeOutline" /></div>
              <div class="row-main">
                <div class="row-title">Inventory overview</div>
                <div class="row-sub">Stock on hand, low stock and out of stock</div>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="row-chevron" />
            </button>
          </div>
        </section>

        <section class="section">
          <div class="section-head"><h2 class="section-title">Governance</h2></div>
          <div class="card card--flush">
            <button type="button" class="row" @click="go('/tabs/approvals')">
              <div class="avatar"><ion-icon :icon="shieldCheckmarkOutline" /></div>
              <div class="row-main">
                <div class="row-title">Approval queue</div>
                <div class="row-sub">Review what admins have submitted</div>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="row-chevron" />
            </button>
            <button type="button" class="row" @click="go('/tabs/users/admins')">
              <div class="avatar"><ion-icon :icon="peopleOutline" /></div>
              <div class="row-main">
                <div class="row-title">Admin accounts</div>
                <div class="row-sub">Invite, suspend and review admins</div>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="row-chevron" />
            </button>
            <button type="button" class="row" @click="go('/tabs/users')">
              <div class="avatar"><ion-icon :icon="personOutline" /></div>
              <div class="row-main">
                <div class="row-title">Customers</div>
                <div class="row-sub">View and manage customer accounts</div>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="row-chevron" />
            </button>
          </div>
        </section>

        <section class="section">
          <div class="section-head"><h2 class="section-title">Account</h2></div>
          <div class="card card--flush">
            <button type="button" class="row" @click="go('/tabs/profile')">
              <div class="avatar"><ion-icon :icon="idCardOutline" /></div>
              <div class="row-main">
                <div class="row-title">Profile</div>
                <div class="row-sub">Your Super Admin account and permissions</div>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="row-chevron" />
            </button>
            <button type="button" class="row" @click="go('/tabs/settings')">
              <div class="avatar"><ion-icon :icon="optionsOutline" /></div>
              <div class="row-main">
                <div class="row-title">Settings</div>
                <div class="row-sub">Phone notifications and app information</div>
              </div>
              <ion-icon :icon="chevronForwardOutline" class="row-chevron" />
            </button>
          </div>
        </section>

        <section class="section">
          <button class="btn btn--danger" :disabled="loggingOut" @click="logout">
            <ion-icon :icon="logOutOutline" />
            Sign out
          </button>
          <p class="footnote">Achilles Super Admin · connected to the live Achilles backend</p>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { IonContent, IonIcon, IonPage } from '@ionic/vue'
import {
  chevronForwardOutline,
  cubeOutline,
  documentTextOutline,
  idCardOutline,
  logOutOutline,
  notificationsOutline,
  optionsOutline,
  peopleOutline,
  personOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons'
import { api } from '../services/api'
import { notificationState } from '../services/notifications'
import { session } from '../services/session'
import { confirmAction } from '../services/ui'
import AppHeader from '../components/AppHeader.vue'

const router = useRouter()
const loggingOut = ref(false)

function go(path: string): void {
  void router.push(path)
}

async function logout(): Promise<void> {
  if (loggingOut.value) return
  const confirmed = await confirmAction({
    header: 'Sign out',
    message: 'You will need your Super Admin credentials to sign back in.',
    confirmText: 'Sign out',
    danger: true,
  })
  if (!confirmed) return

  loggingOut.value = true
  try {
    await api.logout()
  } catch {
    // The local session is cleared either way.
  } finally {
    loggingOut.value = false
    await router.replace('/login')
  }
}
</script>

<style scoped>
.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-main h2 {
  margin: 0;
  font-size: 1.18rem;
  font-weight: 750;
  letter-spacing: -0.03em;
}

.profile-main .muted {
  margin: 3px 0 8px;
  font-size: 0.84rem;
}

.footnote {
  margin: 14px 0 0;
  text-align: center;
  font-size: 0.72rem;
  color: var(--slate-400);
}
</style>