<template>
  <ion-page>
    <AppHeader title="Audit logs" subtitle="Read-only activity trail" back>
      <template #end>
        <ion-button fill="clear" size="small" @click="showFilters = !showFilters">
          {{ showFilters ? 'Hide' : 'Filters' }}
        </ion-button>
      </template>
    </AppHeader>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <SearchField v-model="search" placeholder="Action, IP or user" />

      <div class="chip-row">
        <button
          v-for="chip in categoryChips"
          :key="chip"
          type="button"
          :class="['chip', category === chip ? 'chip--active' : '']"
          @click="category = chip"
        >
          {{ chip === 'all' ? 'All modules' : titleCase(chip) }}
        </button>
      </div>

      <div v-if="showFilters" class="filters">
        <div class="filter-grid">
          <label class="filter-field">
            <span>Admin or user</span>
            <select v-model="userId">
              <option value="">Anyone</option>
              <option v-for="user in options.users" :key="user.id" :value="String(user.id)">
                {{ user.name }} · {{ titleCase(user.role) }}
              </option>
            </select>
          </label>
          <label class="filter-field">
            <span>Action</span>
            <select v-model="event">
              <option value="">Any action</option>
              <option v-for="option in options.events" :key="option" :value="option">{{ titleCase(option) }}</option>
            </select>
          </label>
          <label class="filter-field">
            <span>From</span>
            <input v-model="from" type="date" />
          </label>
          <label class="filter-field">
            <span>To</span>
            <input v-model="to" type="date" />
          </label>
        </div>
        <button class="btn btn--ghost" type="button" @click="resetFilters">Clear filters</button>
      </div>

      <div class="page page--flush">
        <ListState
          :loading="loading"
          :refreshing="refreshing"
          :error="error"
          :empty="items.length === 0"
          empty-title="No matching activity"
          empty-body="Widen the filters or search for a different record."
          :skeleton-rows="7"
          @retry="load"
        >
          <div class="card card--flush">
            <button v-for="log in items" :key="log.id" type="button" class="row" @click="open(log.id)">
              <div class="avatar">{{ initialsOf(log.user === 'System' ? 'Syst' : log.user) }}</div>
              <div class="row-main">
                <div class="row-title">{{ titleCase(log.event) }} · {{ titleCase(log.category) }}</div>
                <div class="row-sub">
                  {{ log.user }}<template v-if="log.subject"> · {{ log.subject }}</template>
                </div>
              </div>
              <div class="row-side">
                <div class="row-sub">{{ timeAgo(log.created_at) }}</div>
              </div>
            </button>
          </div>

          <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
            <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more" />
          </ion-infinite-scroll>

          <p class="count-line">{{ total }} log entr(y/ies)</p>
        </ListState>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonButton,
  IonContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/vue'
import { api, type AuditLog } from '../services/api'
import { initialsOf, timeAgo, titleCase } from '../services/format'
import { usePaginated } from '../composables/usePaginated'
import { onAppResume } from '../composables/useAppEvents'
import AppHeader from '../components/AppHeader.vue'
import ListState from '../components/ListState.vue'
import SearchField from '../components/SearchField.vue'

const router = useRouter()
const route = useRoute()
const search = ref('')
const category = ref(typeof route.query.category === 'string' ? route.query.category : 'all')
const event = ref(typeof route.query.event === 'string' ? route.query.event : '')
const userId = ref(typeof route.query.user_id === 'string' ? route.query.user_id : '')
const from = ref('')
const to = ref('')
const showFilters = ref(Boolean(route.query.user_id || route.query.event))
const options = ref<{ categories: string[]; events: string[]; users: { id: number; name: string; role: string }[] }>({
  categories: [],
  events: [],
  users: [],
})

const categoryChips = computed(() => ['all', ...options.value.categories])

const { items, loading, refreshing, error, total, hasMore, load, loadMore, refresh, refreshIfStale } =
  usePaginated<AuditLog>(
    (params, signal) =>
      api.logs(
        {
          category: category.value,
          event: event.value,
          user_id: userId.value ? Number(userId.value) : undefined,
          search: search.value.trim(),
          from: from.value || undefined,
          to: to.value || undefined,
          page: params.page,
        },
        signal,
      ),
    {
      cacheKey: 'logs',
      filters: () => ({
        category: category.value,
        event: event.value,
        user_id: userId.value,
        search: search.value.trim(),
        from: from.value,
        to: to.value,
      }),
    },
  )

function resetFilters(): void {
  event.value = ''
  userId.value = ''
  from.value = ''
  to.value = ''
  category.value = 'all'
}

function open(id: number): void {
  void router.push(`/tabs/logs/${id}`)
}

onMounted(async () => {
  try {
    options.value = await api.logFilters()
  } catch {
    // Filters degrade to search-only if the options call fails.
  }
})

onAppResume(() => void refreshIfStale())
</script>

<style scoped>
.filters {
  margin: 0 16px 14px;
  padding: 14px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-xs);
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.filter-field {
  display: grid;
  gap: 5px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--slate-500);
}

.filter-field select,
.filter-field input {
  width: 100%;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong);
  background: var(--surface-muted);
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--ink-900);
  text-transform: none;
  letter-spacing: 0;
}

.count-line {
  margin: 16px 4px 0;
  text-align: center;
  font-size: 0.74rem;
  color: var(--slate-400);
}
</style>
