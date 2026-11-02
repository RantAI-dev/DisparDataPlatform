<script setup lang="ts">
/** /gpci/toko-suvenir (SouvenirView, client-only). */
const { suvenir } = useAtlas();
const { data } = useLazyAsyncData("atlas-suvenir", () => suvenir(), { server: false });
</script>

<template>
  <AtlasSuvenirView v-if="data" :data="data" />
  <AtlasMemuat v-else />
</template>
