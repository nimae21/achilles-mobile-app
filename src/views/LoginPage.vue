<template>
  <ion-page>
    <ion-content :fullscreen="true" class="login-bg">
      <div class="login-shell">
        <div class="brand">
          <div class="mark">A</div>
          <h1>Achilles</h1>
          <p class="eyebrow">Super Admin Console</p>
        </div>

        <form class="card login-card" @submit.prevent="login">
          <p class="lede">Sign in with your Super Admin account to monitor the Achilles system.</p>

          <ion-item lines="none" class="field">
            <ion-label position="stacked">Email</ion-label>
            <ion-input
              v-model="email"
              type="email"
              inputmode="email"
              autocomplete="email"
              enterkeyhint="next"
              placeholder="you@achilles.com"
            />
          </ion-item>

          <ion-item lines="none" class="field">
            <ion-label position="stacked">Password</ion-label>
            <ion-input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              enterkeyhint="go"
              placeholder="••••••••"
            />
            <ion-button fill="clear" slot="end" class="reveal" @click="showPassword = !showPassword">
              <ion-icon :icon="showPassword ? eyeOffOutline : eyeOutline" />
            </ion-button>
          </ion-item>

          <p v-if="error" class="error-text">{{ error }}</p>

          <button class="btn btn--primary" type="submit" :disabled="loading">
            <ion-spinner v-if="loading" name="crescent" />
            <span v-else>Sign in</span>
          </button>

          <p class="hint">
            Admin and Customer accounts cannot use this app. If you are an Admin, sign in on the Achilles
            website instead.
          </p>
        </form>

        <p class="footnote">Achilles Wear Your Weakness · Secure session with bearer tokens</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IonContent, IonPage, IonItem, IonLabel, IonInput, IonButton, IonIcon, IonSpinner } from '@ionic/vue'
import { eyeOffOutline, eyeOutline } from 'ionicons/icons'
import { api } from '../services/api'
import { safeNotificationRedirect } from '../services/notification-routing'
import { adoptSession } from '../services/session'

const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function login(): Promise<void> {
  if (loading.value) return
  if (!email.value || !password.value) {
    error.value = 'Please enter your email and password.'
    return
  }

  loading.value = true
  error.value = ''
  try {
    const data = await api.login(email.value.trim(), password.value)
    await adoptSession(data.user)
    await router.replace(safeNotificationRedirect(route.query.redirect))
  } catch (caught) {
    error.value = (caught as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-bg {
  --background: radial-gradient(120% 90% at 50% 0%, #1c2230 0%, #0b0f14 55%, #05070b 100%);
}

.login-shell {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 26px;
  padding: 48px 20px calc(32px + env(safe-area-inset-bottom));
  max-width: 480px;
  margin: 0 auto;
}

.brand {
  text-align: center;
  color: #fff;
}

.mark {
  width: 66px;
  height: 66px;
  margin: 0 auto 14px;
  display: grid;
  place-items: center;
  border-radius: 22px;
  font-size: 1.7rem;
  font-weight: 800;
  background: linear-gradient(150deg, #ef4444 0%, var(--brand-red) 45%, var(--brand-red-dark) 100%);
  box-shadow: 0 22px 40px -22px rgba(220, 38, 38, 0.95);
}

.brand h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.045em;
}

.eyebrow {
  margin: 6px 0 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.58);
}

.login-card {
  display: grid;
  gap: 14px;
  padding: 20px;
  border-radius: var(--radius-xl);
  box-shadow: 0 30px 60px -30px rgba(0, 0, 0, 0.8);
}

.lede {
  margin: 0 0 2px;
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--slate-500);
}

.reveal {
  --color: var(--slate-400);
  margin-right: -8px;
}

.hint {
  margin: 2px 0 0;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--slate-500);
}

.footnote {
  margin: 0;
  text-align: center;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.42);
}
</style>