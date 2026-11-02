<script setup lang="ts">
/** Dua sumbu: batang (kiri) + garis (kanan) (ComboBarLine.tsx). Tanpa keadaan kosong, sama dengan v2. */
import { opsiComboBarLine, type ComboBarLineProps } from "../../utils/chart-options/combo-bar-line";
import { EXPANDED_HEIGHT } from "../../utils/chart-options/zoom";

const props = withDefaults(defineProps<ComboBarLineProps & { height?: number }>(), { height: 320, dualAxis: true });
const expanded = useChartExpanded();
const option = computed(() => opsiComboBarLine(props, expanded));
</script>

<template>
  <EChart :option="option" :height="expanded ? EXPANDED_HEIGHT : height" />
</template>
