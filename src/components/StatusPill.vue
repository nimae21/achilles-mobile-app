<template>
  <span :class="statusPillClass(status)">{{ label }}</span>
</template>

<script setup lang="ts">
import { statusPillClass } from '../services/format'

defineProps<{ label: string; status: string }>()
</script>