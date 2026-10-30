<script setup lang="ts">
/**
 * Pembungkus vue-echarts bersama semua chart (pengganti echarts-for-react di v2): mendaftarkan
 * modul ECharts yang dipakai, `notMerge` + `lazyUpdate`, dan ukur ulang otomatis.
 */
import { use } from "echarts/core";
import { BarChart, LineChart, PieChart, TreemapChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer } from "echarts/renderers";
// Build CSP: tidak menyuntik <style> lewat `document` saat diimpor (SSR); gayanya diberi inline di bawah.
import VChart from "vue-echarts/csp";

// LabelLayout menjalankan `labelLayout.hideOverlap`; UniversalTransition = transisi antaropsi. Keduanya
// ikut di build `echarts` lengkap yang dipakai v2 — tanpa LabelLayout label yang bertumpuk tidak disembunyikan.
use([CanvasRenderer, LabelLayout, UniversalTransition, BarChart, LineChart, PieChart, TreemapChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent]);

const props = defineProps<{ option: object; height: number | string }>();
const UPDATE = { notMerge: true, lazyUpdate: true };
// Pengganti CSS bawaan vue-echarts (x-vue-echarts{display:block;width:100%;min-width:0}).
const gaya = computed(() => ({ display: "block", width: "100%", minWidth: 0, height: typeof props.height === "number" ? `${props.height}px` : props.height }));
</script>

<template>
  <VChart :option="option as any" :update-options="UPDATE" :style="gaya" autoresize />
</template>
