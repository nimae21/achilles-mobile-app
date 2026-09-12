<template>
  <div class="segment">
    <button type="button" :class="active === 'users' ? 'is-active' : ''" @click="go('users')">Customers</button>
    <button type="button" :class="active === 'admins' ? 'is-active' : ''" @click="go('admins')">Admins</button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{ active: 'users' | 'admins' }>()
const router = useRouter()

function go(target: 'users' | 'admins'): void {
  void router.replace(target === 'users' ? '/tabs/users' : '/tabs/users/admins')
}
</script>