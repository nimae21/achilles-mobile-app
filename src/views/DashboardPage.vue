<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="hero">
        <div class="hero-top">
          <div>
            <p class="hero-eyebrow">{{ today }}</p>
            <h1 class="hero-title">Hello, {{ firstName }}</h1>
            <p class="hero-sub">Everything happening in Achilles right now</p>
          </div>
          <button class="bell" type="button" aria-label="Notifications" @click="go('/tabs/notifications')">
            <ion-icon :icon="notificationsOutline" />
            <span v-if="notificationState.unread" class="badge-dot">{{
              notificationState.unread > 99 ? '99+' : notificationState.unread
            }}</span>
          </button>
        </div>

        <div class="hero-stats">
          <div class="hero-stat">
            <span>Sales today</span>
            <strong class="mono">{{ compactMoney(summary.sales_today) }}</strong>
          </div>
          <div class="hero-stat">
            <span>Orders today</span>
            <strong class="mono">{{ count(summary.orders_today) }}</strong>
          </div>
        </div>
      </div>

      <div class="page">
        <ListState :loading="loading" :error="error" :empty="data === null" @retry="load(true)">
          <section v-if="alerts.length" class="section">
            <div class="section-head"><h2 class="section-title">Needs attention</h2></div>
            <button
              v-for="alert in alerts"
              :key="alert.title"
              type="button"
              :class="['alert-row', `alert-row--${alert.severity}`]"
              @click="go(alert.route)"
            >
              <ion-icon :icon="alertIcon(alert.icon)" />
              <span class="alert-copy">
                <strong>{{ alert.title }}</strong>
                <small>{{ alert.body }}</small>
              </span>
              <ion-icon :icon="chevronForwardOutline" class="alert-chevron" />
            </button>
          </section>

          <section class="section">
            <div class="section-head">
              <h2 class="section-title">Revenue</h2>
            </div>
            <div class="card">
              <div class="trend">
                <div v-for="point in salesTrend" :key="point.date" class="trend-bar">
                  <svg class="trend-fill" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <rect x="0" :y="100 - barPercent(point.total)" width="100" :height="barPercent(point.total)" rx="5" />
                  </svg>
                  <span>{{ point.label }}</span>
                </div>
              </div>
              <div class="trend-legend">
                <span>Last 7 days</span>
                <strong class="mono">{{ money(summary.sales_7_days) }}</strong>
              </div>
            </div>
            <div class="stat-grid stat-grid--spaced">
              <StatCard label="Sales today" :value="money(summary.sales_today)" to="/tabs/orders?status=completed" />
              <StatCard label="All-time sales" :value="compactMoney(summary.sales_total)" />
              <StatCard label="Completed orders" :value="count(summary.orders_completed)" to="/tabs/orders?status=completed" />
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2 class="section-title">Orders</h2>
              <button class="section-action" type="button" @click="go('/tabs/orders')">View all</button>
            </div>
            <div class="stat-grid">
              <StatCard label="Total orders" :value="count(summary.orders_total)" to="/tabs/orders" />
              <StatCard label="Awaiting payment" :value="count(summary.orders_pending)" to="/tabs/orders?status=pending" />
              <StatCard label="Paid · to ship" :value="count(summary.orders_paid)" accent to="/tabs/orders?status=paid" />
              <StatCard label="Shipped" :value="count(summary.orders_shipped)" to="/tabs/orders?status=shipped" />
              <StatCard label="Completed" :value="count(summary.orders_completed)" to="/tabs/orders?status=completed" />
              <StatCard label="Cancelled" :value="count(summary.orders_cancelled)" to="/tabs/orders?status=cancelled" />
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2 class="section-title">Catalog &amp; inventory</h2>
              <button class="section-action" type="button" @click="go('/tabs/inventory')">Open</button>
            </div>
            <div class="stat-grid">
              <StatCard label="Products" :value="count(summary.products)" />
              <StatCard label="Variants" :value="count(summary.variants)" />
              <StatCard label="Stock on hand" :value="count(summary.inventory_quantity)" to="/tabs/inventory" />
              <StatCard label="Inventory value" :value="compactMoney(summary.inventory_value)" />
              <StatCard label="Low stock" :value="count(summary.low_stock)" to="/tabs/inventory?filter=low" />
              <StatCard label="Out of stock" :value="count(summary.out_of_stock)" to="/tabs/inventory?filter=out" />
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2 class="section-title">Accounts</h2>
              <button class="section-action" type="button" @click="go('/tabs/users')">Manage</button>
            </div>
            <div class="stat-grid">
              <StatCard label="Customers" :value="count(summary.users_total)" to="/tabs/users" />
              <StatCard label="Active customers" :value="count(summary.users_active)" to="/tabs/users?status=active" />
              <StatCard label="Suspended" :value="count(summary.users_suspended)" to="/tabs/users?status=suspended" />
              <StatCard label="Admins" :value="count(summary.admins_total)" to="/tabs/users/admins" />
              <StatCard
                label="Approvals waiting"
                :value="count(summary.approvals_pending)"
                to="/tabs/approvals"
              />
              <StatCard
                label="Pending invites"
                :value="count(summary.invitations_pending)"
                to="/tabs/users/admins/invitations"
              />
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2 class="section-title">Recent orders</h2>
              <button class="section-action" type="button" @click="go('/tabs/orders')">View all</button>
            </div>
            <div class="card card--flush">
              <button
                v-for="order in recentOrders"
                :key="order.id"
                class="row"
                type="button"
                @click="go(`/tabs/orders/${order.id}`)"
              >
                <div class="avatar">#{{ order.id }}</div>
                <div class="row-main">
                  <div class="row-title">{{ order.customer }}</div>
                  <div class="row-sub">{{ timeAgo(order.created_at) }} · {{ order.items_count ?? 0 }} item(s)</div>
                </div>
                <div class="row-side">
                  <div class="row-amount mono">{{ money(order.total) }}</div>
                  <StatusPill :label="order.status" :status="order.status_key" />
                </div>
              </button>
              <p v-if="!recentOrders.length" class="empty-line">No online orders yet.</p>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <h2 class="section-title">Recent activity</h2>
              <button class="section-action" type="button" @click="go('/tabs/logs')">Audit trail</button>
            </div>
            <div class="card card--flush">
              <button
                v-for="entry in recentActivity"
                :key="entry.id"
                class="row"
                type="button"
                @click="go(`/tabs/logs/${entry.id}`)"
              >
                <div class="avatar">{{ initialsOf(entry.user === 'System' ? 'Syst' : entry.user) }}</div>
                <div class="row-main">
                  <div class="row-title">{{ titleCase(entry.event) }} · {{ entry.category }}</div>
                  <div class="row-sub">
                    {{ entry.user }} · {{ entry.subject ?? 'system record' }} · {{ timeAgo(entry.created_at) }}
                  </div>
                </div>
                <ion-icon :icon="chevronForwardOutline" class="row-chevron" />
              </button>
              <p v-if="!recentActivity.length" class="empty-line">No recorded activity yet.</p>
            </div>
          </section>

          <p v-if="refreshing" class="update-note" role="status">Updating...</p>
          <p class="footer-note">
            Snapshot generated {{ dateLabel(generatedAt) }} · pull down to refresh
          </p>
        </ListState>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonContent,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/vue'
import {
  alertCircleOutline,
  alertOutline,
  bagHandleOutline,
  chevronForwardOutline,
  cubeOutline,
  notificationsOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons'
import { api, type DashboardAlert, type DashboardData } from '../services/api'
import { compactMoney, count, dateLabel, initialsOf, money, timeAgo, titleCase } from '../services/format'
import { notificationState, setBadges } from '../services/notifications'
import { readCache, writeCache } from '../services/screen-cache'
import { session } from '../services/session'
import { onAppResume } from '../composables/useAppEvents'
import ListState from '../components/ListState.vue'
import StatCard from '../components/StatCard.vue'
import StatusPill from '../components/StatusPill.vue'

const router = useRouter()
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const data = ref<DashboardData | null>(null)
/** When the snapshot on screen was last confirmed by the server. */
const lastLoadedAt = ref(0)

// Paint the last snapshot immediately, then revalidate in the background.
const cachedDashboard = readCache<DashboardData>('dashboard', 60_000)
if (cachedDashboard) {
  data.value = cachedDashboard
  loading.value = false
  // The cache only ever serves snapshots fetched within the last minute.
  lastLoadedAt.value = Date.now()
}

const summary = computed(() => data.value?.summary ?? {})
const salesTrend = computed(() => data.value?.sales_trend ?? [])
const recentOrders = computed(() => data.value?.recent_orders ?? [])
const recentActivity = computed(() => data.value?.recent_activity ?? [])
const alerts = computed<DashboardAlert[]>(() => data.value?.alerts ?? [])
const generatedAt = computed(() => data.value?.generated_at ?? '')
const firstName = computed(() => session.user?.name?.split(' ')[0] ?? 'Super Admin')
const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })

const trendMax = computed(() => Math.max(1, ...salesTrend.value.map((point) => point.total)))
function barPercent(total: number): number {
  return Math.max(4, Math.round((total / trendMax.value) * 100))
}

function alertIcon(kind: string): string {
  return (
    {
      approval: shieldCheckmarkOutline,
      inventory: cubeOutline,
      invitation: bagHandleOutline,
      alert: alertOutline,
    }[kind] ?? alertCircleOutline
  )
}

function go(path: string | null): void {
  if (path) void router.push(path)
}

async function load(fresh = false): Promise<void> {
  const hasData = data.value !== null
  loading.value = !hasData
  refreshing.value = hasData
  try {
    const payload = await api.dashboard(fresh)
    data.value = payload
    error.value = ''
    lastLoadedAt.value = Date.now()
    // The badge numbers are shipped with the dashboard, so no extra requests.
    setBadges({
      unread: payload.badges?.unread_notifications,
      approvals: payload.summary?.approvals_pending,
    })
    writeCache('dashboard', payload)
  } catch (caught) {
    // Keep the last snapshot on screen instead of replacing it with an error.
    error.value = (caught as Error).message
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

/**
 * A resume only re-fetches when the snapshot on screen has aged past the
 * window the cache considers fresh, so unlocking the phone twice in a row
 * costs no extra request.
 */
async function refreshIfStale(minAgeMs = 60_000): Promise<void> {
  if (loading.value || refreshing.value) return
  if (Date.now() - lastLoadedAt.value < minAgeMs) return
  await load()
}

async function refresh(event?: CustomEvent): Promise<void> {
  // Pull-to-refresh asks the server to bypass its short cache.
  await load(true)
  ;(event?.target as { complete?: () => void } | undefined)?.complete?.()
}

onMounted(() => void load())
onAppResume(() => void refreshIfStale())

</script>

<style scoped>
.bell {
  position: relative;
  width: 46px;
  height: 46px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 1.25rem;
  display: grid;
  place-items: center;
}

.bell .badge-dot {
  position: absolute;
  top: -6px;
  right: -6px;
  border: 2px solid #111827;
}

.alert-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px;
  margin-bottom: 10px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--line);
  background: var(--surface);
  text-align: left;
  box-shadow: var(--shadow-xs);
  color: var(--brand-red-dark);
  font-size: 1.15rem;
}

.alert-row--warning {
  color: var(--warn);
}

.alert-row--info {
  color: var(--info);
}

.alert-copy {
  flex: 1;
  min-width: 0;
  color: var(--ink-900);
}

.alert-copy strong {
  display: block;
  font-size: 0.9rem;
  font-weight: 700;
}

.alert-copy small {
  display: block;
  margin-top: 3px;
  font-size: 0.78rem;
  color: var(--slate-500);
}

.alert-chevron {
  color: var(--slate-400);
  font-size: 1rem;
}

.trend-fill {
  height: 100%;
}

.trend-fill rect {
  fill: var(--brand-red);
}

.stat-grid--spaced {
  margin-top: 10px;
}

.trend-legend {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 0.8rem;
  color: var(--slate-500);
}

.trend-legend strong {
  font-size: 1rem;
  color: var(--ink-900);
}

.empty-line {
  margin: 0;
  padding: 18px 16px;
  font-size: 0.84rem;
  color: var(--slate-500);
}

.footer-note {
  margin: 22px 4px 0;
  text-align: center;
  font-size: 0.72rem;
  color: var(--slate-400);
}

.update-note {
  margin: 22px 4px 0;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: 0.02em;
  color: var(--slate-500);
}

.update-note + .footer-note {
  margin-top: 6px;
}
</style>
