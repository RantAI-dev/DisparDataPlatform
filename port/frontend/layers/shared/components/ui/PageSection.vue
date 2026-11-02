<script setup lang="ts">
/** Judul + deskripsi bagian di dalam halaman indikator (`Section` di PariwisataShell.tsx). Slot `desc` untuk deskripsi bermarkup. */
defineProps<{ title: string; desc?: string }>();
</script>

<template>
  <div>
    <h2 class="atlas-display-md text-ink">{{ title }}</h2>
    <p v-if="desc || $slots.desc" class="mt-1.5 apple-caption text-ink-muted-48 max-w-[80ch]">
      <slot name="desc">{{ desc }}</slot>
    </p>
    <div class="mt-4"><slot /></div>
  </div>
</template>
