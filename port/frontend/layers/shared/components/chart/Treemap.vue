<script setup lang="ts">
/** Treemap komposisi untuk detail proporsi (Treemap.tsx). */
import { opsiTreemap, type TreemapProps } from "../../utils/chart-options/treemap";
import { EXPANDED_HEIGHT } from "../../utils/chart-options/zoom";

const props = withDefaults(defineProps<TreemapProps & { height?: number }>(), { height: 300 });
const expanded = useChartExpanded();
const option = computed(() => opsiTreemap(props, expanded));
</script>

<template>
  <div v-if="!data.length" class="text-[13px] text-slate-400 py-6 text-center">Tidak ada data.</div>
  <EChart v-else :option="option" :height="expanded ? EXPANDED_HEIGHT : height" />
</template>
