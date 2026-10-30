<script setup lang="ts">
/** Beberapa seri per periode (multi-line), mis. okupansi per bintang (GroupedLines.tsx). */
import { opsiGroupedLines, type GroupedLinesProps } from "../../utils/chart-options/grouped-lines";
import { EXPANDED_HEIGHT } from "../../utils/chart-options/zoom";

const props = defineProps<GroupedLinesProps>();
const expanded = useChartExpanded();
const option = computed(() => opsiGroupedLines(props, expanded));
</script>

<template>
  <div v-if="!series.length" class="text-[13px] text-slate-400 py-6 text-center">Tidak ada data.</div>
  <EChart v-else :option="option" :height="expanded ? EXPANDED_HEIGHT : 300" />
</template>
