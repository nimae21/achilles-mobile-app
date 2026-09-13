<template>
  <ion-page>
    <AppHeader title="Invite admin" subtitle="Existing invitation workflow" back default-href="/tabs/users/admins" />

    <ion-content>
      <div class="page">
        <div class="card">
          <p class="lede">
            The recipient receives an email link, sets their own password, and becomes an operational Admin
            on the Achilles website. This is the same invitation system the web console uses.
          </p>

          <form class="form" @submit.prevent="submit">
            <ion-item lines="none" class="field">
              <ion-label position="stacked">Email address</ion-label>
              <ion-input
                v-model="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                enterkeyhint="send"
                placeholder="new.admin@achilles.com"
              />
            </ion-item>

            <p v-if="error" class="error-text">{{ error }}</p>

            <button class="btn btn--primary" type="submit" :disabled="sending || !email">
              <ion-spinner v-if="sending" name="crescent" />
              <span v-else>Send invitation</span>
            </button>
          </form>
        </div>

        <div class="notice notice--spaced">
          <ion-icon :icon="informationCircleOutline" />
          <span>
            Invitations expire after 48 hours. Re-inviting the same address invalidates the previous link
            and sends a new one.
          </span>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { IonContent, IonIcon, IonInput, IonItem, IonLabel, IonPage, IonSpinner } from '@ionic/vue'
import { informationCircleOutline } from 'ionicons/icons'
import { api } from '../services/api'
import { toast } from '../services/ui'
import AppHeader from '../components/AppHeader.vue'

const router = useRouter()
const email = ref('')
const sending = ref(false)
const error = ref('')

async function submit(): Promise<void> {
  if (sending.value) return
  sending.value = true
  error.value = ''
  try {
    const result = await api.inviteAdmin(email.value.trim())
    await toast(result.message)
    window.dispatchEvent(new Event('accounts-updated'))
    await router.replace('/tabs/users/admins/invitations')
  } catch (caught) {
    error.value = (caught as Error).message
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.notice--spaced { margin-top: 14px; }
.lede {
  margin: 0 0 16px;
  font-size: 0.86rem;
  line-height: 1.55;
  color: var(--slate-500);
}

.form {
  display: grid;
  gap: 14px;
}
</style>