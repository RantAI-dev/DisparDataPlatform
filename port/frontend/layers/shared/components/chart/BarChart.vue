<script setup lang="ts">
/** Bar vertikal per periode; tren framework & detail dataset (components/BarChart.tsx). Kosong = tidak dirender. */
import { opsiBarChart } from "../../utils/chart-options/bar-chart";

const props = defineProps<{ data: Point[] }>();
const option = computed(() => opsiBarChart(props));
</script>

<template>
  <EChart v-if="data.length" :option="option" :height="240" />
</template>
