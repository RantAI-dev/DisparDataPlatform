<script setup lang="ts">
/** Leaderboard top-N dengan peringkat + nilai (charts/RankedList.tsx). */
withDefaults(defineProps<{ data: Point[]; unit?: string }>(), { unit: "" });
</script>

<template>
  <div v-if="!data.length" class="text-[13px] text-slate-400 py-6 text-center">Tidak ada data.</div>
  <ol v-else class="divide-y divide-slate-100">
    <li v-for="(d, i) in data" :key="i" class="flex items-center gap-3 py-2 text-[13px]">
      <span class="w-6 text-right tabular-nums text-slate-400">{{ i + 1 }}</span>
      <span class="flex-1 truncate text-slate-700" :title="d.label">{{ d.label }}</span>
      <span class="tabular-nums font-medium text-slate-900">{{ d.value.toLocaleString("id-ID") }}{{ unit }}</span>
    </li>
  </ol>
</template>
