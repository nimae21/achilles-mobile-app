<template>
  <ion-page>
    <AppHeader title="Approvals" subtitle="Admin submissions waiting for review">
      <template #end>
        <ion-button v-if="status === 'pending' && items.length" fill="clear" size="small" @click="toggleSelecting">
          {{ selecting ? 'Cancel' : 'Select' }}
        </ion-button>
      </template>
    </AppHeader>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <SearchField v-model="search" placeholder="Requester, type or request #" />

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

      <div v-if="selecting" class="bulk">
        <span>{{ selected.length }} selected</span>
        <div class="bulk-actions">
          <button class="btn btn--success bulk-btn" :disabled="!selected.length || busy" @click="reviewSelected('approved')">
            Approve
          </button>
          <button class="btn btn--danger bulk-btn" :disabled="!selected.length || busy" @click="reviewSelected('rejected')">
            Reject
          </button>
        </div>
      </div>

      <div class="page page--flush">
        <ListState
          :loading="loading"
          :error="error"
          :empty="items.length === 0"
          empty-title="Queue is clear"
          empty-body="No admin submissions are waiting in this status."
          :skeleton-rows="6"
          @retry="load"
        >
          <div class="card card--flush">
            <div v-for="item in items" :key="item.id" class="row">
              <label v-if="selecting" class="picker" @click.stop>
                <input type="checkbox" :value="item.id" :checked="selected.includes(item.id)" @change="toggle(item.id)" />
              </label>
              <button class="row-body" type="button" @click="open(item)">
                <div class="avatar avatar--red">{{ item.requester?.initials ?? 'AD' }}</div>
                <div class="row-main">
                  <div class="row-title">{{ item.summary }}</div>
                  <div class="row-sub">
                    {{ item.entity_label }} · {{ item.requester?.name ?? 'Unknown admin' }} ·
                    {{ timeAgo(item.submitted_at) }}
                  </div>
                </div>
                <div class="row-side">
                  <StatusPill :label="item.status" :status="item.status" />
                  <div v-if="item.image_count" class="row-sub" style="margin-top: 6px">
                    {{ item.image_count }} image(s)
                  </div>
                </div>
              </button>
            </div>
          </div>

          <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
            <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more" />
          </ion-infinite-scroll>

          <p class="count-line">{{ total }} request(s)</p>
        </ListState>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
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
import { api, type ApprovalCounts, type ApprovalSummary } from '../services/api'
import { timeAgo } from '../services/format'
import { confirmAction, promptReason, toast } from '../services/ui'
import { setBadges } from '../services/notifications'
import { usePaginated } from '../composables/usePaginated'
import AppHeader from '../components/AppHeader.vue'
import ListState from '../components/ListState.vue'
import SearchField from '../components/SearchField.vue'
import StatusPill from '../components/StatusPill.vue'

const router = useRouter()
const route = useRoute()
const status = ref(typeof route.query.status === 'string' ? route.query.status : 'pending')
const search = ref('')

const selecting = ref(false)
const selected = ref<number[]>([])
const busy = ref(false)

const chips = computed(() => [
  { key: 'pending', label: 'Pending', count: counts.value?.pending ?? null },
  { key: 'approved', label: 'Approved', count: counts.value?.approved ?? null },
  { key: 'rejected', label: 'Rejected', count: counts.value?.rejected ?? null },
])

const { items, counts, loading, error, total, hasMore, load, loadMore, refresh } =
  usePaginated<ApprovalSummary, ApprovalCounts>(
    (params) => api.approvals({ status: status.value, search: search.value.trim(), page: params.page }),
    { filters: () => ({ status: status.value, search: search.value.trim() }), cacheKey: 'approvals' },
  )

// The queue counts double as the tab badge, with no extra request.
watch(counts, (value) => {
  if (value) setBadges({ approvals: value.pending })
})

function selectStatus(key: string): void {
  status.value = key
  selecting.value = false
  selected.value = []
}

function toggleSelecting(): void {
  selecting.value = !selecting.value
  selected.value = []
}

function toggle(id: number): void {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((value) => value !== id)
    : [...selected.value, id]
}

function open(item: ApprovalSummary): void {
  if (selecting.value) {
    toggle(item.id)
    return
  }
  void router.push(`/tabs/approvals/${item.id}`)
}

async function reviewSelected(decision: 'approved' | 'rejected'): Promise<void> {
  if (!selected.value.length || busy.value) return
  const count = selected.value.length

  let reason: string | undefined
  if (decision === 'rejected') {
    const value = await promptReason({
      header: `Reject ${count} request(s)`,
      message: 'The requesting admin sees this reason. Be specific about what must change.',
    })
    if (!value) return
    reason = value
  } else {
    const confirmed = await confirmAction({
      header: `Approve ${count} request(s)`,
      message: 'Approved items are applied to the live catalog using the existing approval workflow.',
      confirmText: 'Approve',
    })
    if (!confirmed) return
  }

  busy.value = true
  try {
    const result = await api.reviewApprovals({ ids: selected.value, decision, reason })
    await toast(result.message)
    selecting.value = false
    selected.value = []
    await load()
    window.dispatchEvent(new Event('approvals-updated'))
  } catch (caught) {
    await toast((caught as Error).message, 'danger')
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  window.addEventListener('approvals-updated', () => void load())
  window.addEventListener('app-resumed', () => void load())
})
</script>

<style scoped>
.chip-count {
  margin-left: 6px;
  font-size: 0.7rem;
  opacity: 0.6;
}

.bulk {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 16px 12px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background: var(--ink-900);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 650;
}

.bulk-actions {
  display: flex;
  gap: 8px;
}

.bulk-btn {
  width: auto;
  min-height: 38px;
  padding: 0 16px;
  font-size: 0.8rem;
}

.picker {
  display: grid;
  place-items: center;
  padding-right: 4px;
}

.picker input {
  width: 20px;
  height: 20px;
  accent-color: var(--brand-red);
}

.row-body {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  padding: 0;
  text-align: left;
  color: inherit;
}

.count-line {
  margin: 16px 4px 0;
  text-align: center;
  font-size: 0.74rem;
  color: var(--slate-400);
}
</style>