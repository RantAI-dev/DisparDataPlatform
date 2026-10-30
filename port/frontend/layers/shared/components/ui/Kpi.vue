<script setup lang="ts">
/** Satu KPI; `delta` menjadi teks tren ▲/▼ di depan sub (DashboardKit.tsx, tanpa warna). */
const props = defineProps<{ label: string; value: string | number; sub?: string; delta?: number | null }>();

const subTeks = computed(() => {
  const d = props.delta;
  if (d == null || !Number.isFinite(d)) return props.sub;
  const pct = Math.abs(d).toLocaleString("id-ID", { maximumFractionDigits: 1 });
  return `${d >= 0 ? "▲" : "▼"} ${pct}% ${props.sub ?? ""}`.trim();
});
</script>

<template>
  <KpiStat :label="label" :value="value" :sub="subTeks" />
</template>
