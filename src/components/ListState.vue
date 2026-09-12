<template>
  <div v-if="loading" class="card card--flush" aria-busy="true">
    <div v-for="row in skeletonRows" :key="row" class="skeleton-row">
      <div class="skeleton" style="width: 42px; height: 42px; border-radius: 14px" />
      <div style="flex: 1">
        <div class="skeleton" style="height: 12px; width: 62%" />
        <div class="skeleton" style="height: 10px; width: 34%; margin-top: 9px" />
      </div>
      <div class="skeleton" style="height: 12px; width: 52px" />
    </div>
  </div>

  <!-- Only a failure with nothing to show replaces the whole screen. -->
  <div v-else-if="error && empty" class="state state--error">
    <div class="state-icon"><ion-icon :icon="alertCircleOutline" /></div>
    <p class="state-title">{{ errorTitle }}</p>
    <p class="state-body">{{ error }}</p>
    <button class="btn btn--ghost" style="max-width: 220px" @click="$emit('retry')">Try again</button>
  </div>

  <div v-else-if="empty" class="state">
    <div class="state-icon"><ion-icon :icon="icon" /></div>
    <p class="state-title">{{ emptyTitle }}</p>
    <p class="state-body">{{ emptyBody }}</p>
  </div>

  <template v-else>
    <div v-if="error" class="notice notice--brand" style="margin-bottom: 12px">
      <ion-icon :icon="cloudOfflineOutline" />
      <span>Couldn't refresh just now — showing the last loaded data.</span>
    </div>
    <slot />
  </template>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { alertCircleOutline, cloudOfflineOutline, fileTrayOutline } from 'ionicons/icons'

withDefaults(
  defineProps<{
    loading?: boolean
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