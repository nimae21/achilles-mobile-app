<template>
  <ion-page>
    <AppHeader :title="order ? `Order #${order.id}` : 'Order'" :subtitle="order?.status ?? 'Loading'" back />

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="page">
        <ListState
          :loading="loading"
          :error="error"
          :skeleton-rows="4"
          error-title="Could not load this order"
          @retry="load"
        >
          <template v-if="order">
            <div class="card summary-card">
              <div class="summary-top">
                <div>
                  <p class="eyebrow">Order</p>
                  <h2>#{{ order.id }}</h2>
                  <p class="muted">{{ dateLabel(order.created_at) }}</p>
                </div>
                <StatusPill :label="order.status" :status="order.status_key" />
              </div>
              <div class="summary-total">
                <span>Order total</span>
                <strong class="mono">{{ money(order.total) }}</strong>
              </div>
            </div>

            <div class="notice notice--brand">
              <ion-icon :icon="informationCircleOutline" />
              <span>
                Order fulfilment stays on the website. The Super Admin account has read-only access to
                order status here, exactly as it does on the web.
              </span>
            </div>

            <section class="section">
              <div class="section-head"><h2 class="section-title">Customer</h2></div>
              <div class="card">
                <KeyValue label="Account" :value="order.customer" />
                <KeyValue label="Email" :value="order.customer_email" />
                <KeyValue label="Recipient" :value="order.recipient" />
                <KeyValue label="Phone" :value="order.phone" />
              </div>
            </section>

            <section class="section">
              <div class="section-head">
                <h2 class="section-title">Delivery</h2>
                <button v-if="order.shipping.map_url" class="section-action" type="button" @click="openMap">
                  Open map
                </button>
              </div>
              <div class="card">
                <p class="address">{{ order.address || 'No address recorded' }}</p>
                <KeyValue label="Barangay" :value="order.shipping.barangay" />
                <KeyValue label="City" :value="order.shipping.city" />
                <KeyValue label="Province" :value="order.shipping.province" />
                <KeyValue label="Postal code" :value="order.shipping.postal_code" />
              </div>
            </section>

            <section class="section">
              <div class="section-head"><h2 class="section-title">Items</h2></div>
              <div class="card card--flush">
                <div v-for="(line, index) in order.items" :key="index" class="row row--static">
                  <div class="row-main">
                    <div class="row-title">{{ line.product }}</div>
                    <div class="row-sub">
                      Size {{ line.size ?? '—' }} · {{ line.color ?? '—' }} · {{ line.quantity }} ×
                      {{ money(line.price) }}
                    </div>
                  </div>
                  <div class="row-side">
                    <div class="row-amount mono">{{ money(line.subtotal) }}</div>
                  </div>
                </div>
                <p v-if="!order.items.length" class="empty-line">No line items recorded.</p>
              </div>
            </section>

            <section class="section">
              <div class="section-head"><h2 class="section-title">Payment</h2></div>
              <div class="card">
                <template v-if="order.payment">
                  <KeyValue label="Status" :value="titleCase(order.payment.status)" />
                  <KeyValue label="Method" :value="order.payment.method ? titleCase(order.payment.method) : null" />
                  <KeyValue label="Reference" :value="order.payment.reference" />
                  <KeyValue label="Paid at" :value="dateLabel(order.payment.paid_at)" />
                  <KeyValue label="Refund" :value="order.payment.refund_label" />
                  <KeyValue
                    label="Refund amount"
                    :value="order.payment.refund_amount !== null ? money(order.payment.refund_amount) : null"
                  />
                </template>
                <p v-else class="muted">No payment record yet. Pending orders only become paid once PayMongo confirms.</p>
              </div>
            </section>

            <section class="section">
              <div class="section-head"><h2 class="section-title">History</h2></div>
              <div class="card">
                <ul v-if="order.timeline.length" class="timeline">
                  <li v-for="(entry, index) in order.timeline" :key="index">
                    <span class="dot" />
                    <div class="label">{{ entry.label }}</div>
                    <div class="meta">
                      {{ dateLabel(entry.at) }}<template v-if="entry.by"> · {{ entry.by }}</template>
                    </div>
                  </li>
                </ul>
                <p v-else class="muted">No status history recorded for this order.</p>
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
import { useRoute } from 'vue-router'
import { IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent } from '@ionic/vue'
import { informationCircleOutline } from 'ionicons/icons'
import { api, type OrderDetail } from '../services/api'
import { dateLabel, money, titleCase } from '../services/format'
import AppHeader from '../components/AppHeader.vue'
import KeyValue from '../components/KeyValue.vue'
import ListState from '../components/ListState.vue'
import StatusPill from '../components/StatusPill.vue'

const route = useRoute()
const orderId = String(route.params.id ?? '')
const order = ref<OrderDetail | null>(null)
const loading = ref(true)
const error = ref('')

async function load(): Promise<void> {
  loading.value = order.value === null
  error.value = ''
  try {
    order.value = await api.order(orderId)
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

function openMap(): void {
  const url = order.value?.shipping.map_url
  if (url) window.open(url, '_blank', 'noopener')
}

onMounted(() => {
  void load()
  window.addEventListener('orders-updated', () => void load())
})
</script>

<style scoped>
.summary-card {
  background: linear-gradient(160deg, #0b0f14 0%, #171e29 100%);
  border-color: transparent;
  color: #fff;
  box-shadow: var(--shadow-md);
}

.summary-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
}

.summary-top h2 {
  margin: 6px 0 2px;
  font-size: 1.7rem;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.summary-top .muted {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
}

.summary-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.65);
}

.summary-total strong {
  font-size: 1.3rem;
  color: #fff;
  letter-spacing: -0.03em;
}

.address {
  margin: 0 0 10px;
  font-size: 0.95rem;
  font-weight: 650;
  line-height: 1.45;
}

.row--static {
  border-bottom: 1px solid var(--line);
}

.empty-line {
  margin: 0;
  padding: 18px 16px;
  font-size: 0.84rem;
  color: var(--slate-500);
}
</style>