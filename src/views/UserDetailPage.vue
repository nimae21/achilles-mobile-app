<template>
  <ion-page>
    <AppHeader :title="account?.name ?? 'Customer'" :subtitle="account ? `Customer #${account.id}` : 'Loading'" back />

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="page">
        <ListState :loading="loading" :error="error" :skeleton-rows="4" @retry="load">
          <template v-if="account">
            <div class="card profile">
              <div :class="['avatar avatar--lg', account.is_active ? '' : 'avatar--muted']">{{ account.initials }}</div>
              <div class="profile-main">
                <h2>{{ account.name }}</h2>
                <p class="muted">{{ account.email }}</p>
                <StatusPill :label="account.status" :status="account.is_active ? 'active' : 'suspended'" />
              </div>
            </div>

            <section class="section">
              <div class="section-head"><h2 class="section-title">Account</h2></div>
              <div class="card">
                <KeyValue label="Role" :value="account.role_label" />
                <KeyValue label="Status" :value="account.status" />
                <KeyValue label="Email verified" :value="account.email_verified ? 'Yes' : 'No'" />
                <KeyValue label="Joined" :value="dateLabel(account.created_at)" />
                <KeyValue label="Orders placed" :value="account.orders_count" />
              </div>
            </section>

            <section v-if="account.can_suspend" class="section">
              <div class="section-head"><h2 class="section-title">Access</h2></div>
              <div class="actions">
                <button
                  v-if="account.is_active"
                  class="btn btn--danger"
                  :disabled="busy"
                  @click="toggle(false)"
                >
                  <ion-icon :icon="banOutline" />
                  Suspend this customer
                </button>
                <button v-else class="btn btn--success" :disabled="busy" @click="toggle(true)">
                  <ion-icon :icon="checkmarkCircleOutline" />
                  Reactivate this customer
                </button>
              </div>
              <p class="note">
                Suspending immediately revokes the customer's active sessions and mobile tokens, exactly
                like the website governance screen.
              </p>
            </section>

            <section class="section">
              <div class="section-head">
                <h2 class="section-title">Recent activity</h2>
                <button class="section-action" type="button" @click="goLogs(account.id)">
                  Full trail
                </button>
              </div>
              <div class="card card--flush">
                <button
                  v-for="entry in account.recent_activity"
                  :key="entry.id"
                  type="button"
                  class="row"
                  @click="go(`/tabs/logs/${entry.id}`)"
                >
                  <div class="row-main">
                    <div class="row-title">{{ titleCase(entry.event) }}</div>
                    <div class="row-sub">{{ entry.action }} · {{ entry.subject ?? 'account' }}</div>
                  </div>
                  <div class="row-side">
                    <div class="row-sub">{{ timeAgo(entry.created_at) }}</div>
                  </div>
                </button>
                <p v-if="!account.recent_activity.length" class="empty-line">No recorded activity yet.</p>
              </div>
            </section>
          </template>
        </ListState>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent } from '@ionic/vue'
import { banOutline, checkmarkCircleOutline } from 'ionicons/icons'
import { api, type AccountDetail } from '../services/api'
import { dateLabel, timeAgo, titleCase } from '../services/format'
import { confirmAction, toast } from '../services/ui'
import AppHeader from '../components/AppHeader.vue'
import KeyValue from '../components/KeyValue.vue'
import ListState from '../components/ListState.vue'
import StatusPill from '../components/StatusPill.vue'

const route = useRoute()
const router = useRouter()
const go = (path: string) => void router.push(path)
const goLogs = (id: number) => go(`/tabs/logs?user_id=${id}`)
const accountId = String(route.params.id ?? '')
const account = ref<AccountDetail | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)

async function load(): Promise<void> {
  loading.value = account.value === null
  error.value = ''
  try {
    account.value = await api.user(accountId)
  } catch (caught) {
    error.value = (caught as Error).message
  } finally {
    loading.value = false
  }
}

async function refresh(event?: CustomEvent): Promise<void> {
  await load()
  ;(event?.target as { complete?: () => void } | undefined)?.complete?.()
}

async function toggle(active: boolean): Promise<void> {
  if (!account.value || busy.value) return
  const confirmed = await confirmAction({
    header: active ? 'Reactivate account' : 'Suspend account',
    message: active
      ? `${account.value.name} will be able to sign in and shop again.`
      : `${account.value.name} will be signed out everywhere and blocked from the store.`,
    confirmText: active ? 'Reactivate' : 'Suspend',
    danger: !active,
  })
  if (!confirmed) return

  busy.value = true
  try {
    const result = await api.setUserStatus(account.value.id, active)
    await toast(result.message)
    await load()
    window.dispatchEvent(new Event('accounts-updated'))
  } catch (caught) {
    await toast((caught as Error).message, 'danger')
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  void load()
  window.addEventListener('accounts-updated', () => void load())
})
</script>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-main h2 {
  margin: 0;
  font-size: 1.16rem;
  font-weight: 750;
  letter-spacing: -0.03em;
}

.profile-main .muted {
  margin: 3px 0 8px;
  font-size: 0.84rem;
}

.avatar--muted {
  background: var(--danger-soft);
  color: var(--brand-red-dark);
}

.note {
  margin: 12px 4px 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--slate-500);
}

.empty-line {
  margin: 0;
  padding: 18px 16px;
  font-size: 0.84rem;
  color: var(--slate-500);
}
</style>