<script setup lang="ts">
/** Proporsi (donut): legenda scroll di bawah, pie di tengah (Donut.tsx). */
import { opsiDonut, type DonutProps } from "../../utils/chart-options/donut";
import { EXPANDED_HEIGHT } from "../../utils/chart-options/zoom";

const props = defineProps<DonutProps>();
const expanded = useChartExpanded();
const option = computed(() => opsiDonut(props, expanded));
</script>

<template>
  <div v-if="!data.length" class="text-[13px] text-slate-400 py-6 text-center">Tidak ada data.</div>
  <EChart v-else :option="option" :height="expanded ? EXPANDED_HEIGHT : 288" />
</template>
