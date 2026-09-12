<template>
  <ion-page>
    <AppHeader title="Inventory" subtitle="Read-only stock overview" back />

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <SearchField v-model="search" placeholder="Product, size or colour" />

      <div class="chip-row">
        <button
          v-for="chip in chips"
          :key="chip.key"
          type="button"
          :class="['chip', filter === chip.key ? 'chip--active' : '']"
          @click="selectFilter(chip.key)"
        >
          {{ chip.label }}
        </button>
      </div>

      <div class="page page--flush">
        <div class="card summary">
          <div>
            <p class="eyebrow">Matching variants</p>
            <strong class="mono">{{ total }}</strong>
          </div>
          <div>
            <p class="eyebrow">Value on this page</p>
            <strong class="mono">{{ compactMoney(pageValue) }}</strong>
          </div>
        </div>

        <ListState
          :loading="loading"
          :error="error"
          :empty="items.length === 0"
          empty-title="No variants in this view"
          empty-body="Try a different filter or search term."
          :skeleton-rows="7"
          @retry="load"
        >
          <div class="card card--flush">
            <div v-for="row in items" :key="row.id" class="row">
              <div :class="['avatar', row.state === 'ok' ? '' : 'avatar--alert']">
                <ion-icon :icon="row.state === 'ok' ? cubeOutline : alertOutline" />
              </div>
              <div class="row-main">
                <div class="row-title">{{ row.product }}</div>
                <div class="row-sub">
                  Size {{ row.size ?? '—' }} · {{ row.color ?? '—' }} ·
                  {{ row.price !== null ? money(row.price) : 'no price' }}
                </div>
              </div>
              <div class="row-side">
                <div class="row-amount mono">{{ row.remaining }}</div>
                <StatusPill
                  :label="row.state === 'out' ? 'Out of stock' : row.state === 'low' ? 'Low stock' : 'In stock'"
                  :status="row.state"
                />
              </div>
            </div>
          </div>

          <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
            <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more" />
          </ion-infinite-scroll>

          <p class="count-line">
            Stock is managed through admin stock submissions, which require Super Admin approval.
          </p>
        </ListState>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/vue'
import { alertOutline, cubeOutline } from 'ionicons/icons'
import { api, type InventoryRow } from '../services/api'
import { compactMoney, money } from '../services/format'
import { usePaginated } from '../composables/usePaginated'
import AppHeader from '../components/AppHeader.vue'
import ListState from '../components/ListState.vue'
import SearchField from '../components/SearchField.vue'
import StatusPill from '../components/StatusPill.vue'

const router = useRouter()
const route = useRoute()
const filter = ref(typeof route.query.filter === 'string' ? route.query.filter : 'all')
const search = ref('')

const chips = [
  { key: 'all', label: 'All variants' },
  { key: 'low', label: 'Low stock (1-5)' },
  { key: 'out', label: 'Out of stock' },
]

const { items, loading, error, total, hasMore, load, loadMore, refresh } = usePaginated<InventoryRow>(
  (params) => api.inventory({ filter: filter.value, search: search.value.trim(), page: params.page }),
  { filters: () => ({ filter: filter.value, search: search.value.trim() }), cacheKey: 'inventory' },
)

const pageValue = computed(() => items.value.reduce((sum, row) => sum + (row.value ?? 0), 0))

function selectFilter(key: string): void {
  filter.value = key
  void router.replace({ path: '/tabs/inventory', query: key === 'all' ? {} : { filter: key } })
}


onMounted(() => {
  window.addEventListener('app-resumed', () => void load())
})
</script>

<style scoped>
.summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.summary strong {
  display: block;
  margin-top: 6px;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.035em;
}

.eyebrow {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--slate-500);
}

.avatar--alert {
  background: var(--danger-soft);
  color: var(--brand-red-dark);
}

.count-line {
  margin: 16px 4px 0;
  text-align: center;
  font-size: 0.74rem;
  color: var(--slate-400);
}
</style>