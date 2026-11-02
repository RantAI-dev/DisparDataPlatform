<script setup lang="ts">
/** Grid penata ChartCard (DashboardKit.tsx). */
withDefaults(defineProps<{ cols?: 2 | 3 }>(), { cols: 3 });
</script>

<template>
  <div :class="`grid gap-4 ${cols === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`"><slot /></div>
</template>
