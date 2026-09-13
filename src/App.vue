<template>
  <ion-app>
    <div v-if="!session.ready" class="boot-shell" role="status" aria-live="polite">
      <img src="/favicon.png" alt="" class="boot-shell__mark" />
      <p>Opening Achilles...</p>
    </div>
    <ion-router-outlet v-else />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue'
import { session } from './services/session'
</script>

<style scoped>
.boot-shell {
  min-height: 100%;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 14px;
  background: var(--page);
  color: var(--slate-500);
  font-size: 0.82rem;
  font-weight: 650;
}

.boot-shell__mark {
  width: 54px;
  height: 54px;
  border-radius: 17px;
}
</style>