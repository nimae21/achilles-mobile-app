<template>
  <ion-page>
    <AppHeader title="Accounts" subtitle="Operational Admins">
      <template #end>
        <ion-button fill="clear" size="small" @click="go('/tabs/users/admins/invite')">Invite</ion-button>
      </template>
    </AppHeader>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <SearchField v-model="search" placeholder="Name or email" />
      <RoleSegment active="admins" />

      <div class="chip-row">
        <button
          v-for="chip in chips"
          :key="chip.key"
          type="button"
          :class="['chip', status === chip.key ? 'chip--active' : '']"
          @click="status = chip.key"
        >
          {{ chip.label }}<span v-if="chip.count !== null" class="chip-count">{{ chip.count }}</span>
        </button>
        <button type="button" class="chip" @click="go('/tabs/users/admins/invitations')">
          Pending invites<span v-if="counts" class="chip-count">{{ counts.invitations_pending }}</span>
        </button>
      </div>

      <div class="page page--flush">
        <ListState
          :loading="loading"
          :error="error"
          :empty="items.length === 0"
          empty-title="No admins found"
          empty-body="Invite an admin to give someone operational access."
          :skeleton-rows="5"
          @retry="load"
        >
          <div class="card card--flush">
            <button v-for="admin in items" :key="admin.id" type="button" class="row" @click="open(admin.id)">
              <div :class="['avatar', admin.is_active ? 'avatar--red' : 'avatar--muted']">{{ admin.initials }}</div>
              <div class="row-main">
                <div class="row-title">{{ admin.name }}</div>
                <div class="row-sub">{{ admin.email }}</div>
              </div>
              <div class="row-side">
                <StatusPill :label="admin.status" :status="admin.is_active ? 'active' : 'suspended'" />
              </div>
            </button>
          </div>

          <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
            <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more" />
          </ion-infinite-scroll>

          <p class="count-line">{{ total }} admin(s)</p>
        </ListState>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonButton,
  IonContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/vue'
import { api, type AccountCounts, type AccountSummary } from '../services/api'
import { usePaginated } from '../composables/usePaginated'
import AppHeader from '../components/AppHeader.vue'
import ListState from '../components/ListState.vue'
import RoleSegment from '../components/RoleSegment.vue'
import SearchField from '../components/SearchField.vue'
import StatusPill from '../components/StatusPill.vue'

const router = useRouter()
const status = ref('all')
const search = ref('')


const chips = computed(() => [
  { key: 'all', label: 'All', count: counts.value?.admins.total ?? null },
  { key: 'active', label: 'Active', count: counts.value?.admins.active ?? null },
  { key: 'suspended', label: 'Suspended', count: counts.value?.admins.suspended ?? null },
])

const { items, counts, loading, error, total, hasMore, load, loadMore, refresh } =
  usePaginated<AccountSummary, AccountCounts>(
    (params) => api.users({ role: 'admin', status: status.value, search: search.value.trim(), page: params.page }),
    { filters: () => ({ status: status.value, search: search.value.trim() }), cacheKey: 'admins' },
  )

function open(id: number): void {
  void router.push(`/tabs/users/admins/${id}`)
}

function go(path: string): void {
  void router.push(path)
}

onMounted(() => {
  window.addEventListener('accounts-updated', () => void load())
  window.addEventListener('app-resumed', () => void load())
})
</script>

<style scoped>
.avatar--muted {
  background: var(--danger-soft);
  color: var(--brand-red-dark);
}

.chip-count {
  margin-left: 6px;
  font-size: 0.7rem;
  opacity: 0.6;
}

.count-line {
  margin: 16px 4px 0;
  text-align: center;
  font-size: 0.74rem;
  color: var(--slate-400);
}
</style>