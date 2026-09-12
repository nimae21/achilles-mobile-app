<template>
  <ion-page>
    <AppHeader title="Profile" subtitle="Super Admin account" back default-href="/tabs/more" />

    <ion-content>
      <div class="page">
        <div class="card profile">
          <div class="avatar avatar--lg avatar--red">{{ session.user?.initials ?? 'SA' }}</div>
          <div>
            <h2>{{ session.user?.name ?? 'Super Admin' }}</h2>
            <p class="muted">{{ session.user?.email }}</p>
            <span class="pill pill--brand">{{ session.user?.role_label ?? 'Super Admin' }}</span>
          </div>
        </div>

        <section class="section">
          <div class="section-head"><h2 class="section-title">Account</h2></div>
          <div class="card">
            <KeyValue label="Role" :value="profile?.user.role_label" />
            <KeyValue label="Email" :value="profile?.user.email" />
            <KeyValue label="Status" :value="profile?.user.is_active ? 'Active' : 'Suspended'" />
          </div>
        </section>

        <section class="section">
          <div class="section-head"><h2 class="section-title">Permissions</h2></div>
          <div class="card">
            <KeyValue
              v-for="permission in permissions"
              :key="permission.key"
              :label="permission.label"
              :value="permission.allowed ? 'Allowed' : 'Not permitted'"
            />
          </div>
          <p class="note">
            These mirror the Achilles website exactly. Super Admin accounts govern the system — they do not
            operate the store, so catalog, order and POS actions stay on the web.
          </p>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IonContent, IonPage } from '@ionic/vue'
import { api, type ProfilePayload } from '../services/api'
import { session } from '../services/session'
import AppHeader from '../components/AppHeader.vue'
import KeyValue from '../components/KeyValue.vue'

const profile = ref<ProfilePayload | null>(null)

const labels: Record<string, string> = {
  manage_orders: 'Ship, complete or cancel orders',
  manage_catalog: 'Create products, variants and stock',
  run_pos: 'Run point-of-sale sales',
  review_approvals: 'Review admin approval requests',
  manage_accounts: 'Suspend and reactivate accounts',
  invite_admins: 'Invite new admins',
  view_logs: 'View the audit trail',
}

const permissions = computed(() =>
  Object.entries(profile.value?.permissions ?? {}).map(([key, allowed]) => ({
    key,
    label: labels[key] ?? key,
    allowed,
  })),
)

onMounted(async () => {
  try {
    profile.value = await api.me()
  } catch {
    // The stored session user still renders the essentials.
  }
})
</script>

<style scoped>
.profile {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile h2 {
  margin: 0;
  font-size: 1.18rem;
  font-weight: 750;
  letter-spacing: -0.03em;
}

.profile .muted {
  margin: 3px 0 8px;
  font-size: 0.84rem;
}

.note {
  margin: 12px 4px 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--slate-500);
}
</style>