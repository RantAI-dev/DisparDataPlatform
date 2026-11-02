<script setup lang="ts">
/** /gpci/hotel (app/gpci/hotel/page.tsx → HotelView, client-only). */
const { hotel } = useAtlas();
const { data } = useLazyAsyncData("atlas-hotel", () => hotel(), { server: false });
</script>

<template>
  <AtlasHotelView v-if="data" :data="data" />
  <AtlasMemuat v-else />
</template>
