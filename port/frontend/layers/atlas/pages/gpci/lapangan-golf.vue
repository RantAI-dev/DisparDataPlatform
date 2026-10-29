<script setup lang="ts">
/** /gpci/lapangan-golf (GolfView, client-only). */
const { golf } = useAtlas();
const { data } = useLazyAsyncData("atlas-golf", () => golf(), { server: false });
</script>

<template>
  <AtlasGolfView v-if="data" :data="data" />
  <AtlasMemuat v-else />
</template>
