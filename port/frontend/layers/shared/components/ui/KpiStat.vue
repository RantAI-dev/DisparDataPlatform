<script setup lang="ts">
/** Angka besar + label (+ sub opsional) (charts/KpiStat.tsx). */
defineProps<{ label: string; value: string | number; sub?: string }>();
</script>

<template>
  <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
    <div class="text-[11px] font-mono uppercase tracking-wider text-slate-400">{{ label }}</div>
    <div class="text-[30px] font-bold tabular-nums text-slate-900 mt-1">
      {{ typeof value === "number" ? value.toLocaleString("id-ID") : value }}
    </div>
    <div v-if="sub" class="text-[12px] text-slate-500 mt-0.5">{{ sub }}</div>
  </div>
</template>
