<template>
  <ion-page>
    <AppHeader :title="approval ? approval.entity_label : 'Request'" :subtitle="approval ? `Request #${approval.id}` : 'Loading'" back />

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="page">
        <ListState
          :loading="loading"
          :error="error"
          :skeleton-rows="4"
          error-title="Could not load this request"
          @retry="load"
        >
          <template v-if="approval">
            <div class="card summary-card">
              <div class="summary-top">
                <div>
                  <p class="eyebrow">Proposed {{ approval.entity_label }}</p>
                  <h2>{{ approval.summary }}</h2>
                  <p class="muted">Submitted {{ dateLabel(approval.submitted_at) }}</p>
                </div>
                <StatusPill :label="approval.status" :status="approval.status" />
              </div>
            </div>

            <section class="section">
              <div class="section-head"><h2 class="section-title">Requested by</h2></div>
              <div class="card">
                <div class="person">
                  <div class="avatar avatar--red">{{ approval.requester?.initials ?? 'AD' }}</div>
                  <div>
                    <div class="row-title">{{ approval.requester?.name ?? 'Unknown admin' }}</div>
                    <div class="row-sub">{{ approval.requester?.email }}</div>
                  </div>
                </div>
              </div>
            </section>

            <section class="section">
              <div class="section-head"><h2 class="section-title">Proposed details</h2></div>
              <div class="card">
                <KeyValue v-for="field in approval.fields" :key="field.key" :label="field.label" :value="field.value" />
                <p v-if="!approval.fields.length" class="muted">No details recorded for this request.</p>
              </div>
            </section>

            <section v-if="approval.images.length" class="section">
              <div class="section-head"><h2 class="section-title">Images</h2></div>
              <div class="thumbs">
                <button v-for="image in approval.images" :key="image.path" type="button" @click="openImage(image.url)">
                  <img :src="image.url" alt="Proposed product image" loading="lazy" />
                </button>
              </div>
            </section>

            <section v-if="approval.status === 'pending'" class="section">
              <div class="section-head"><h2 class="section-title">Decision</h2></div>
              <div class="actions">
                <button class="btn btn--success" :disabled="busy" @click="decide('approved')">
                  <ion-icon :icon="checkmarkCircleOutline" />
                  Approve and publish
                </button>
                <button class="btn btn--danger" :disabled="busy" @click="decide('rejected')">
                  <ion-icon :icon="closeCircleOutline" />
                  Reject with a reason
                </button>
              </div>
              <p class="decide-note">
                Approving applies the change to the live catalog through the same approval workflow the
                website uses. Nothing is created until you decide.
              </p>
            </section>

            <section v-else class="section">
              <div class="section-head"><h2 class="section-title">Reviewed</h2></div>
              <div class="card">
                <KeyValue label="Status" :value="titleCase(approval.status)" />
                <KeyValue label="Reviewer" :value="approval.reviewer" />
                <KeyValue label="Reviewed at" :value="dateLabel(approval.reviewed_at)" />
                <KeyValue label="Reason" :value="approval.rejection_reason" />
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
import { useRoute, useRouter } from 'vue-router'
import { IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent } from '@ionic/vue'
import { checkmarkCircleOutline, closeCircleOutline } from 'ionicons/icons'
import { api, type ApprovalDetail } from '../services/api'
import { dateLabel, titleCase } from '../services/format'
import { confirmAction, promptReason, toast } from '../services/ui'
import AppHeader from '../components/AppHeader.vue'
import KeyValue from '../components/KeyValue.vue'
import ListState from '../components/ListState.vue'
import StatusPill from '../components/StatusPill.vue'

const route = useRoute()
const router = useRouter()
const approvalId = String(route.params.id ?? '')
const approval = ref<ApprovalDetail | null>(null)
const loading = ref(true)
const error = ref('')
const busy = ref(false)

async function load(): Promise<void> {
  loading.value = approval.value === null
  error.value = ''
  try {
    approval.value = await api.approval(approvalId)
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

function openImage(url: string): void {
  window.open(url, '_blank', 'noopener')
}

async function decide(decision: 'approved' | 'rejected'): Promise<void> {
  if (!approval.value || busy.value) return

  let reason: string | undefined
  if (decision === 'rejected') {
    const value = await promptReason({
      header: 'Reject this request',
      message: 'The requesting admin sees this reason. Be specific about what must change.',
    })
    if (!value) return
    reason = value
  } else {
    const confirmed = await confirmAction({
      header: 'Approve this request',
      message: 'The change is applied to the live catalog using the existing approval workflow.',
      confirmText: 'Approve',
    })
    if (!confirmed) return
  }

  busy.value = true
  try {
    const result = await api.reviewApprovals({ ids: [approval.value.id], decision, reason })
    await toast(result.message)
    window.dispatchEvent(new Event('approvals-updated'))
    await router.replace('/tabs/approvals')
  } catch (caught) {
    await toast((caught as Error).message, 'danger')
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  void load()
  window.addEventListener('approvals-updated', () => void load())
})
</script>

<style scoped>
.summary-card {
  background: linear-gradient(160deg, #0b0f14 0%, #171e29 100%);
  border-color: transparent;
  color: #fff;
  box-shadow: var(--shadow-md);
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
  margin: 8px 0 2px;
  font-size: 1.32rem;
  font-weight: 800;
  letter-spacing: -0.035em;
  line-height: 1.25;
  word-break: break-word;
}

.summary-top .muted {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8rem;
}

.person {
  display: flex;
  align-items: center;
  gap: 12px;
}

.thumbs {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
}

.thumbs button {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  padding: 6px;
  aspect-ratio: 1;
  overflow: hidden;
}

.thumbs img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.decide-note {
  margin: 12px 4px 0;
  font-size: 0.76rem;
  line-height: 1.5;
  color: var(--slate-500);
}
</style>