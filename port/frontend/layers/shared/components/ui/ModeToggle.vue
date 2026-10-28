<script setup lang="ts" generic="T extends string">
/** Toggle pilihan, mis. Tahunan / Bulanan (dashboard/Kit.tsx). Dipakai dengan v-model. */
defineProps<{ options: { value: T; label: string }[] }>();
const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="inline-flex max-w-full flex-wrap rounded-xl border border-hairline bg-white p-1 shadow-sm">
    <button
      v-for="o in options"
      :key="o.value"
      :aria-pressed="o.value === model"
      :class="`whitespace-nowrap rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors ${
        o.value === model ? 'text-white' : 'text-ink-muted-48 hover:text-ink'
      }`"
      :style="o.value === model ? { background: '#ed6b23' } : undefined"
      @click="model = o.value"
    >
      {{ o.label }}
    </button>
  </div>
</template>
