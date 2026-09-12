<template>
  <ion-page>
    <AppHeader title="Orders" subtitle="Read-only · website handles fulfilment" />

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <SearchField v-model="search" placeholder="Order #, customer, email or phone" />

      <div class="chip-row">
        <button
          v-for="chip in chips"
          :key="chip.key"
          type="button"
          :class="['chip', status === chip.key ? 'chip--active' : '']"
          @click="selectStatus(chip.key)"
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
          empty-title="No orders here"
          empty-body="Orders placed on the website appear here as soon as checkout starts."
          :skeleton-rows="6"
          @retry="load"
        >
          <div class="card card--flush">
            <button
              v-for="order in items"
              :key="order.id"
              type="button"
              class="row"
              @click="open(order.id)"
            >
              <div class="avatar avatar--red">#{{ order.id }}</div>
              <div class="row-main">
                <div class="row-title">{{ order.customer }}</div>
                <div class="row-sub">
                  {{ timeAgo(order.created_at) }} · {{ order.items_count ?? 0 }} item(s) ·
                  {{ order.payment_method ? titleCase(order.payment_method) : 'Awaiting payment' }}
                </div>
              </div>
              <div class="row-side">
                <div class="row-amount mono">{{ money(order.total) }}</div>
                <StatusPill :label="order.status" :status="order.status_key" />
              </div>
            </button>
          </div>

          <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
            <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more orders" />
          </ion-infinite-scroll>

          <p class="count-line">{{ total }} order(s)</p>
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
import { api, type OrderCounts, type OrderSummary } from '../services/api'
import { money, timeAgo, titleCase } from '../services/format'
import { usePaginated } from '../composables/usePaginated'
import { onAppEvent, onAppResume } from '../composables/useAppEvents'
import AppHeader from '../components/AppHeader.vue'
import ListState from '../components/ListState.vue'
import SearchField from '../components/SearchField.vue'
import StatusPill from '../components/StatusPill.vue'

const router = useRouter()
const route = useRoute()
const status = ref(typeof route.query.status === 'string' ? route.query.status : 'all')
const search = ref('')


const chips = computed(() => [
  { key: 'all', label: 'All', count: counts.value?.all ?? null },
  { key: 'pending', label: 'Pending', count: counts.value?.pending ?? null },
  { key: 'paid', label: 'Paid', count: counts.value?.paid ?? null },
  { key: 'shipped', label: 'Shipped', count: counts.value?.shipped ?? null },
  { key: 'completed', label: 'Completed', count: counts.value?.completed ?? null },
  { key: 'cancelled', label: 'Cancelled', count: counts.value?.cancelled ?? null },
])

const { items, counts, loading, refreshing, error, total, hasMore, load, loadMore, refresh, refreshIfStale } =
  usePaginated<OrderSummary, OrderCounts>(
    (params, signal) =>
      api.orders({ status: status.value, search: search.value.trim(), page: params.page }, signal),
    { filters: () => ({ status: status.value, search: search.value.trim() }), cacheKey: 'orders' },
  )

function selectStatus(key: string): void {
  status.value = key
  void router.replace({ path: '/tabs/orders', query: key === 'all' ? {} : { status: key } })
}

function open(id: number): void {
  void router.push(`/tabs/orders/${id}`)
}

onAppEvent('orders-updated', () => void load())
onAppResume(() => void refreshIfStale())
</script>

<style scoped>
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
