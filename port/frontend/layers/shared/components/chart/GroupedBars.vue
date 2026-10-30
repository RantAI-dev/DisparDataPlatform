<script setup lang="ts">
/** Bar berkelompok (multi-seri), mis. Q1–Q4 dibandingkan antar tahun (GroupedBars.tsx). */
import { opsiGroupedBars, type GroupedBarsProps } from "../../utils/chart-options/grouped-bars";
import { EXPANDED_HEIGHT } from "../../utils/chart-options/zoom";

const props = withDefaults(defineProps<GroupedBarsProps & { height?: number }>(), { height: 300, missingValue: 0 });
const expanded = useChartExpanded();
const option = computed(() => opsiGroupedBars(props, expanded));
</script>

<template>
  <div v-if="!series.length" class="text-[13px] text-slate-400 py-6 text-center">Tidak ada data.</div>
  <EChart v-else :option="option" :height="expanded ? EXPANDED_HEIGHT : height" />
</template>
