<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons v-if="back" slot="start">
        <ion-back-button :default-href="defaultHref" text="" />
      </ion-buttons>
      <ion-title>
        <span class="head-title">{{ title }}</span>
        <span v-if="subtitle" class="head-sub">{{ subtitle }}</span>
      </ion-title>
      <ion-buttons slot="end">
        <slot name="end" />
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<script setup lang="ts">
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton } from '@ionic/vue'

withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    back?: boolean
    defaultHref?: string
  }>(),
  { back: false, defaultHref: '/tabs/dashboard', subtitle: '' },
)
</script>

<style scoped>
.head-title {
  display: block;
  font-size: 1.02rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.head-sub {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--slate-500);
}
</style>