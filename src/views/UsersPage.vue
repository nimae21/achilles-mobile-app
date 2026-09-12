<template>
  <ion-page>
    <AppHeader title="Accounts" subtitle="Customer accounts" />

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <SearchField v-model="search" placeholder="Name or email" />
      <RoleSegment active="users" />

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
      </div>

      <div class="page page--flush">
        <ListState
          :loading="loading"
          :refreshing="refreshing"
          :error="error"
          :empty="items.length === 0"
          empty-title="No customers found"
          empty-body="Try a different search or status filter."
          :skeleton-rows="6"
          @retry="load"
        >
          <div class="card card--flush">
            <button v-for="user in items" :key="user.id" type="button" class="row" @click="open(user.id)">
              <div :class="['avatar', user.is_active ? '' : 'avatar--muted']">{{ user.initials }}</div>
              <div class="row-main">
                <div class="row-title">{{ user.name }}</div>
                <div class="row-sub">{{ user.email }}</div>
              </div>
              <div class="row-side">
                <StatusPill :label="user.status" :status="user.is_active ? 'active' : 'suspended'" />
              </div>
            </button>
          </div>

          <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
            <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more" />
          </ion-infinite-scroll>

          <p class="count-line">{{ total }} customer(s)</p>
        </ListState>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/vue'
import { api, type AccountCounts, type AccountSummary } from '../services/api'
import { usePaginated } from '../composables/usePaginated'
import { onAppEvent, onAppResume } from '../composables/useAppEvents'
import AppHeader from '../components/AppHeader.vue'
import ListState from '../components/ListState.vue'
import RoleSegment from '../components/RoleSegment.vue'
import SearchField from '../components/SearchField.vue'
import StatusPill from '../components/StatusPill.vue'

const router = useRouter()
const route = useRoute()
const status = ref(typeof route.query.status === 'string' ? route.query.status : 'all')
const search = ref('')


const chips = computed(() => [
  { key: 'all', label: 'All', count: counts.value?.users.total ?? null },
  { key: 'active', label: 'Active', count: counts.value?.users.active ?? null },
  { key: 'suspended', label: 'Suspended', count: counts.value?.users.suspended ?? null },
])

const { items, counts, loading, refreshing, error, total, hasMore, load, loadMore, refresh, refreshIfStale } =
  usePaginated<AccountSummary, AccountCounts>(
    (params, signal) =>
      api.users(
        { role: 'user', status: status.value, search: search.value.trim(), page: params.page },
        signal,
      ),
    { filters: () => ({ status: status.value, search: search.value.trim() }), cacheKey: 'users' },
  )

function open(id: number): void {
  void router.push(`/tabs/users/${id}`)
}

onAppEvent('accounts-updated', () => void load())
onAppResume(() => void refreshIfStale())
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
