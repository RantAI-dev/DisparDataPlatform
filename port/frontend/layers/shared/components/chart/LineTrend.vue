<script setup lang="ts">
/** Tren per periode, garis berarea (LineTrend.tsx). */
import { opsiLineTrend, type LineTrendProps } from "../../utils/chart-options/line-trend";
import { EXPANDED_HEIGHT } from "../../utils/chart-options/zoom";

const props = defineProps<LineTrendProps>();
const expanded = useChartExpanded();
const option = computed(() => opsiLineTrend(props, expanded));
</script>

<template>
  <div v-if="data.length < 2" class="text-[13px] text-slate-400 py-6 text-center">Data tren belum cukup.</div>
  <EChart v-else :option="option" :height="expanded ? EXPANDED_HEIGHT : 260" />
</template>
