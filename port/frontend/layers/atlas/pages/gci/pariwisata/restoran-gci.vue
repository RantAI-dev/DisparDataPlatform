<script setup lang="ts">
/** /gci/pariwisata/restoran-gci (GciView, client-only). */
const { restoranGci } = useAtlas();
const { data } = useLazyAsyncData("atlas-restoran-gci", () => restoranGci(), { server: false });
</script>

<template>
  <AtlasGciView v-if="data" :data="data" />
  <AtlasMemuat v-else />
</template>
