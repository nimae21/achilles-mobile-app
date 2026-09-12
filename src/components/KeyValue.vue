<template>
  <dl class="kv">
    <dt>{{ label }}</dt>
    <dd>{{ value ?? '—' }}</dd>
  </dl>
</template>

<script setup lang="ts">
defineProps<{ label: string; value: string | number | null | undefined }>()
</script>