<template>
  <ion-page>
    <AppHeader :title="admin?.name ?? 'Admin'" :subtitle="admin ? 'Operational Admin' : 'Loading'" back />

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="page">
        <ListState :loading="loading" :error="error" :skeleton-rows="4" @retry="load">
          <template v-if="admin">
            <div class="card profile">
              <div :class="['avatar avatar--lg', admin.is_active ? 'avatar--red' : 'avatar--muted']">
                {{ admin.initials }}
              </div>
              <div class="profile-main">
                <h2>{{ admin.name }}</h2>
                <p class="muted">{{ admin.email }}</p>
                <StatusPill :label="admin.status" :status="admin.is_active ? 'active' : 'suspended'" />
              </div>
            </div>

            <section class="section">
              <div class="section-head"><h2 class="section-title">Account</h2></div>
              <div class="card">
                <KeyValue label="Role" :value="admin.role_label" />
                <KeyValue label="Status" :value="admin.status" />
                <KeyValue label="Email verified" :value="admin.email_verified ? 'Yes' : 'No'" />
                <KeyValue label="Joined" :value="dateLabel(admin.created_at)" />
                <KeyValue label="Invited by" :value="admin.invited_by" />
              </div>
            </section>

            <section class="section">
              <div class="section-head"><h2 class="section-title">Approval activity</h2></div>
              <div class="stat-grid">
                <StatCard label="Submitted" :value="admin.approvals_submitted" />
                <StatCard label="Approved" :value="admin.approvals_approved" />
                <StatCard
                  label="Waiting"
                  :value="admin.approvals_pending"
                  :accent="admin.approvals_pending > 0"
                  to="/tabs/approvals"
                />
              </div>
            </section>

            <section v-if="admin.can_suspend" class="section">
              <div class="section-head"><h2 class="section-title">Access</h2></div>
              <div class="actions">
                <button v-if="admin.is_active" class="btn btn--danger" :disabled="busy" @click="toggle(false)">
                  <ion-icon :icon="banOutline" />
                  Suspend this admin
                </button>
                <button v-else class="btn btn--success" :disabled="busy" @click="toggle(true)">
                  <ion-icon :icon="checkmarkCircleOutline" />
                  Reactivate this admin
                </button>
              </div>
              <p class="note">
                Suspended admins lose their website session and every mobile token. Their pending approval
                requests stay in the queue until they are restored or rejected.
              </p>
            </section>

            <section class="section">
              <div class="section-head">
                <h2 class="section-title">Recent activity</h2>
                <button class="section-action" type="button" @click="goLogs(admin.id)">
                  Full trail
                </button>
              </div>
              <div class="card card--flush">
                <button
                  v-for="entry in admin.recent_activity"
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
                <p v-if="!admin.recent_activity.length" class="empty-line">No recorded activity yet.</p>
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
import { api, type AdminDetail } from '../services/api'
import { dateLabel, timeAgo, titleCase } from '../services/format'
import { confirmAction, toast } from '../services/ui'
import AppHeader from '../components/AppHeader.vue'
import KeyValue from '../components/KeyValue.vue'
import ListState from '../components/ListState.vue'
import StatCard from '../components/StatCard.vue'
import StatusPill from '../components/StatusPill.vue'

const route = useRoute()
const router = useRouter()
const go = (path: string) => void router.push(path)
const goLogs = (id: number) => go(`/tabs/logs?user_id=${id}`)
const adminId = String(route.params.id ?? '')
const admin = ref<AdminDetail | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)

async function load(): Promise<void> {
  loading.value = admin.value === null
  error.value = ''
  try {
    admin.value = await api.admin(adminId)
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
  if (!admin.value || busy.value) return
  const confirmed = await confirmAction({
    header: active ? 'Reactivate admin' : 'Suspend admin',
    message: active
      ? `${admin.value.name} regains operational access on the website.`
      : `${admin.value.name} is signed out of the website and mobile and cannot operate.`,
    confirmText: active ? 'Reactivate' : 'Suspend',
    danger: !active,
  })
  if (!confirmed) return

  busy.value = true
  try {
    const result = await api.setUserStatus(admin.value.id, active)
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