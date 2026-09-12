<template>
  <ion-page>
    <AppHeader title="Log entry" :subtitle="log ? `#${log.id}` : 'Loading'" back default-href="/tabs/logs" />

    <ion-content>
      <div class="page">
        <ListState :loading="loading" :error="error" :skeleton-rows="3" @retry="load">
          <template v-if="log">
            <div class="card">
              <p class="eyebrow">{{ titleCase(log.category) }}</p>
              <h2>{{ titleCase(log.event) }}</h2>
              <p class="muted mono">{{ log.action }}</p>
            </div>

            <section class="section">
              <div class="section-head"><h2 class="section-title">Performed by</h2></div>
              <div class="card">
                <KeyValue label="User" :value="log.user" />
                <KeyValue label="Email" :value="log.user_email" />
                <KeyValue label="IP address" :value="log.ip_address" />
                <KeyValue label="When" :value="dateLabel(log.created_at)" />
              </div>
            </section>

            <section class="section">
              <div class="section-head"><h2 class="section-title">Affected record</h2></div>
              <div class="card">
                <KeyValue label="Record" :value="log.subject" />
                <KeyValue label="Type" :value="log.subject_type" />
                <KeyValue label="Identifier" :value="log.subject_id" />
              </div>
            </section>

            <section class="section">
              <div class="section-head"><h2 class="section-title">Changes</h2></div>
              <div class="card">
                <template v-if="changes.length">
                  <KeyValue v-for="change in changes" :key="change.key" :label="change.label" :value="change.value" />
                </template>
                <p v-else class="muted">
                  This entry recorded an action without field-level changes (for example a sign-in or a
                  record deletion).
                </p>
              </div>
            </section>
          </template>
        </ListState>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { IonContent, IonPage } from '@ionic/vue'
import { api, type AuditLog } from '../services/api'
import { dateLabel, titleCase } from '../services/format'
import AppHeader from '../components/AppHeader.vue'
import KeyValue from '../components/KeyValue.vue'
import ListState from '../components/ListState.vue'

const route = useRoute()
const logId = String(route.params.id ?? '')
const log = ref<AuditLog | null>(null)
const loading = ref(true)
const error = ref('')

const changes = computed(() => {
  const payload = log.value?.changes ?? null
  if (!payload) return []
  return Object.entries(payload).map(([key, value]) => ({
    key,
    label: titleCase(key),
    value: `${format(value?.old)} → ${format(value?.new)}`,
  }))
})

function format(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

async function load(): Promise<void> {
  loading.value = log.value === null
  error.value = ''
  try {
    log.value = await api.log(logId)
  } catch (caught) {
    error.value = (caught as Error).message
  } finally {
    loading.value = false
  }
}

onMounted(() => void load())
</script>

<style scoped>
.eyebrow {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--brand-red);
}

h2 {
  margin: 8px 0 4px;
  font-size: 1.24rem;
  font-weight: 780;
  letter-spacing: -0.03em;
}

.muted {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.5;
}
</style>