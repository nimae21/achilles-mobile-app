<template>
  <ion-page>
    <AppHeader title="Admin invitations" subtitle="Pending invitations" back default-href="/tabs/users/admins">
      <template #end>
        <ion-button fill="clear" size="small" @click="go('/tabs/users/admins/invite')">Invite</ion-button>
      </template>
    </AppHeader>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="refresh">
        <ion-refresher-content pulling-text="Pull to refresh" refreshing-spinner="crescent" />
      </ion-refresher>

      <div class="page">
        <div class="notice">
          <ion-icon :icon="mailOutline" />
          <span>
            Invitations expire 48 hours after they are sent. The recipient chooses their own password, and
            re-inviting an address replaces the previous link.
          </span>
        </div>

        <ListState
          :loading="loading"
          :refreshing="refreshing"
          :error="error"
          :empty="invitations.length === 0"
          empty-title="No pending invitations"
          empty-body="Invite an admin and they will appear here until they accept."
          :skeleton-rows="4"
          @retry="load"
        >
          <div class="card card--flush card--spaced">
            <div v-for="invitation in invitations" :key="invitation.id" class="row">
              <div class="avatar">
                <ion-icon :icon="mailOutline" />
              </div>
              <div class="row-main">
                <div class="row-title">{{ invitation.email }}</div>
                <div class="row-sub">
                  Invited by {{ invitation.invited_by ?? 'Super Admin' }} ·
                  expires {{ dateLabel(invitation.expires_at) }}
                </div>
              </div>
              <div class="row-side">
                <StatusPill label="Pending" status="pending" />
              </div>
            </div>
          </div>

          <ion-infinite-scroll :disabled="!hasMore" @ionInfinite="loadMore">
            <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more" />
          </ion-infinite-scroll>

          <p class="count-line">{{ total }} pending invitation(s)</p>
        </ListState>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/vue'
import { mailOutline } from 'ionicons/icons'
import { api, type Invitation } from '../services/api'
import { dateLabel } from '../services/format'
import { usePaginated } from '../composables/usePaginated'
import { onAppEvent, onAppResume } from '../composables/useAppEvents'
import AppHeader from '../components/AppHeader.vue'
import ListState from '../components/ListState.vue'
import StatusPill from '../components/StatusPill.vue'

const router = useRouter()
const go = (path: string) => void router.push(path)

const { items: invitations, loading, refreshing, error, total, hasMore, load, loadMore, refresh, refreshIfStale } =
  usePaginated<Invitation>((params, signal) => api.invitations({ page: params.page }, signal), {
    cacheKey: 'invitations',
  })

onAppEvent('accounts-updated', () => void load())
onAppResume(() => void refreshIfStale())
</script>

<style scoped>
.card--spaced { margin-top: 14px; }
.count-line {
  margin: 16px 4px 0;
  text-align: center;
  font-size: 0.74rem;
  color: var(--slate-400);
}
</style>
