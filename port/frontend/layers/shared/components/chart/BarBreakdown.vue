<script setup lang="ts">
/** Bar horizontal untuk breakdown kategori/wilayah (BarBreakdown.tsx). */
import { opsiBarBreakdown, tinggiBarBreakdown, type BarBreakdownProps } from "../../utils/chart-options/bar-breakdown";

const props = defineProps<BarBreakdownProps>();
const expanded = useChartExpanded();
const option = computed(() => opsiBarBreakdown(props, expanded));
</script>

<template>
  <div v-if="!data.length" class="text-[13px] text-slate-400 py-6 text-center">Tidak ada data.</div>
  <EChart v-else :option="option" :height="tinggiBarBreakdown(data.length, expanded)" />
</template>
