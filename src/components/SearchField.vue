<template>
  <div class="search-wrap">
    <div class="search-box">
      <ion-icon :icon="searchOutline" />
      <input
        :value="modelValue"
        :placeholder="placeholder"
        inputmode="search"
        enterkeyhint="search"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button v-if="modelValue" class="clear" type="button" aria-label="Clear search" @click="$emit('update:modelValue', '')">
        <ion-icon :icon="closeCircle" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { closeCircle, searchOutline } from 'ionicons/icons'

withDefaults(defineProps<{ modelValue: string; placeholder?: string }>(), {
  placeholder: 'Search',
})

defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<style scoped>
.clear {
  border: 0;
  background: none;
  padding: 0;
  display: grid;
  place-items: center;
  color: var(--slate-400);
  font-size: 1.15rem;
}
</style>