<script setup lang="ts">
/** /gci/pariwisata/direktori-restoran (Dashboard, client-only). */
const { direktoriRestoran } = useAtlas();
const { data } = useLazyAsyncData("atlas-direktori-restoran", () => direktoriRestoran(), { server: false });
</script>

<template>
  <AtlasDirektoriView v-if="data" :data="data" />
  <AtlasMemuat v-else />
</template>
