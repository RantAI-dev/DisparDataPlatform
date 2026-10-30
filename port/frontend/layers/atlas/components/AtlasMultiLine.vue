<script setup lang="ts">
/** Grafik garis multi-seri tren bulanan (HotelView.tsx MultiLine). */
const props = defineProps<{ periods: string[]; series: { name: string; data: (number | null)[] }[]; unit: string; yName: string }>();
const fmt = (v: number, d: number) => v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const option = computed(() => ({
  color: PALETTE,
  grid: { left: 6, right: 16, top: 30, bottom: 40, containLabel: true },
  legend: { top: 0, textStyle: { fontSize: 11, color: "#475569" } },
  tooltip: { trigger: "axis", valueFormatter: (v: number) => (v == null ? "—" : fmt(v, props.unit === "%" ? 1 : 2) + " " + props.unit) },
  xAxis: {
    type: "category",
    data: props.periods.map(fmtPeriode),
    boundaryGap: false,
    axisLabel: { fontSize: 10, color: "#94a3b8", rotate: props.periods.length > 14 ? 45 : 0 },
  },
  yAxis: {
    type: "value",
    name: props.yName,
    nameTextStyle: { color: "#94a3b8", fontSize: 11 },
    axisLabel: { fontSize: 10, color: "#94a3b8" },
    splitLine: { lineStyle: { color: "#f1f5f9" } },
  },
  series: props.series.map((s) => ({ name: s.name, type: "line", smooth: true, showSymbol: false, connectNulls: true, data: s.data })),
}));
</script>

<template>
  <div v-if="periods.length < 2" class="py-6 text-center text-[13px] text-slate-400">Data tren belum cukup.</div>
  <EChart v-else :option="option" :height="300" />
</template>
