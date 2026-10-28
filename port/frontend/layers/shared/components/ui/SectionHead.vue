<script setup lang="ts">
/** Judul seksi, mis. "1 · Tahunan" (dashboard/Kit.tsx). */
defineProps<{ title: string; desc?: string }>();
</script>

<template>
  <div class="mb-3 mt-8 first:mt-0">
    <h2 class="text-[18px] font-bold tracking-tight text-ink">{{ title }}</h2>
    <p v-if="desc" class="apple-fine text-ink-muted-48">{{ desc }}</p>
  </div>
</template>
