<template>
  <component :is="to ? 'button' : 'div'" :class="['stat', accent ? 'stat--accent' : '']" @click="go">
    <span class="stat-label">{{ label }}</span>
    <strong class="stat-value">{{ value }}</strong>
    <span v-if="hint" class="stat-hint">{{ hint }}</span>
  </component>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    hint?: string
    accent?: boolean
    to?: string
  }>(),
  { hint: '', accent: false, to: '' },
)

const router = useRouter()
const go = () => {
  if (props.to) void router.push(props.to)
}
</script>