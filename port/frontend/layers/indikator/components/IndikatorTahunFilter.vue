<script setup lang="ts">
/** Filter tahun lewat query `?tahun=` (components/pariwisata/TahunFilter.tsx). */
defineProps<{ years: string[]; value: string }>();
const route = useRoute();
const ganti = (v: string) => navigateTo({ path: route.path, query: v ? { tahun: v } : {} }, { replace: true });
</script>

<template>
  <label class="flex items-center gap-2 text-[13px] text-ink-muted-48">
    <span class="font-mono text-[11px] uppercase tracking-wider">Tahun</span>
    <select :value="value" class="rounded-lg border border-hairline bg-white px-3 py-1.5 text-[13px] font-medium text-ink" @change="ganti(($event.target as HTMLSelectElement).value)">
      <option value="">Semua tahun</option>
      <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
    </select>
  </label>
</template>
