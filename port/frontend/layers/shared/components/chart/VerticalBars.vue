<script setup lang="ts">
/** Bar vertikal, mis. tren bulanan / kuartal (VerticalBars.tsx). */
import { opsiVerticalBars, type VerticalBarsProps } from "../../utils/chart-options/vertical-bars";
import { EXPANDED_HEIGHT } from "../../utils/chart-options/zoom";

const props = withDefaults(defineProps<VerticalBarsProps & { height?: number }>(), { height: 280 });
const expanded = useChartExpanded();
const option = computed(() => opsiVerticalBars(props, expanded));
</script>

<template>
  <div v-if="!data.length" class="text-[13px] text-slate-400 py-6 text-center">Tidak ada data.</div>
  <EChart v-else :option="option" :height="expanded ? EXPANDED_HEIGHT : height" />
</template>
