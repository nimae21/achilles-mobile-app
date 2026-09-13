<template>
  <div v-if="loading" class="card card--flush" aria-busy="true">
    <div v-for="row in skeletonRows" :key="row" class="skeleton-row">
      <div class="skeleton skeleton--avatar" />
      <div class="skeleton-copy">
        <div class="skeleton skeleton--title" />
        <div class="skeleton skeleton--subtitle" />
      </div>
      <div class="skeleton skeleton--side" />
    </div>
  </div>

  <!-- Only a failure with nothing to show replaces the whole screen. -->
  <div v-else-if="error && empty" class="state state--error">
    <div class="state-icon"><ion-icon :icon="alertCircleOutline" /></div>
    <p class="state-title">{{ errorTitle }}</p>
    <p class="state-body">{{ error }}</p>
    <button class="btn btn--ghost btn--narrow" @click="$emit('retry')">Try again</button>
  </div>

  <div v-else-if="empty" class="state">
    <div class="state-icon"><ion-icon :icon="icon" /></div>
    <p class="state-title">{{ emptyTitle }}</p>
    <p class="state-body">{{ emptyBody }}</p>
  </div>

  <template v-else>
    <!-- Background revalidation: the screen is already usable and readable,
         this only says that fresher records are on the way. -->
    <div v-if="refreshing" class="refresh-line" role="status" aria-live="polite">
      <ion-spinner name="crescent" />
      <span>Updating...</span>
    </div>
    <div v-if="error" class="notice notice--brand notice--below">
      <ion-icon :icon="cloudOfflineOutline" />
      <span>Couldn't refresh just now — showing the last loaded data.</span>
    </div>
    <slot />
  </template>
</template>

<script setup lang="ts">
import { IonIcon, IonSpinner } from '@ionic/vue'
import { alertCircleOutline, cloudOfflineOutline, fileTrayOutline } from 'ionicons/icons'

withDefaults(
  defineProps<{
    loading?: boolean
    refreshing?: boolean
    error?: string
    empty?: boolean
    emptyTitle?: string
    emptyBody?: string
    errorTitle?: string
    skeletonRows?: number
    icon?: string
  }>(),
  {
    loading: false,
    refreshing: false,
    error: '',
    empty: false,
    emptyTitle: 'Nothing here yet',
    emptyBody: 'Check back after the next activity on the website.',
    errorTitle: 'Could not load this screen',
    skeletonRows: 5,
    icon: fileTrayOutline,
  },
)

defineEmits<{ retry: [] }>()
</script>

<style scoped>
.skeleton-copy { flex: 1; }
.skeleton--avatar { width: 42px; height: 42px; border-radius: 14px; }
.skeleton--title { width: 62%; height: 12px; }
.skeleton--subtitle { width: 34%; height: 10px; margin-top: 9px; }
.skeleton--side { width: 52px; height: 12px; }
.btn--narrow { max-width: 220px; }
.notice--below { margin-bottom: 12px; }

.refresh-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 4px 10px;
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--slate-500);
}

.refresh-line ion-spinner {
  width: 13px;
  height: 13px;
  color: var(--slate-400);
}
</style>
