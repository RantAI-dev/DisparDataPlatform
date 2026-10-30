<script setup lang="ts">
/** /gci/pariwisata/pertunjukan-budaya (EventsView, client-only). */
const { pertunjukan } = useAtlas();
const { data } = useLazyAsyncData("atlas-pertunjukan", () => pertunjukan(), { server: false });
</script>

<template>
  <AtlasEventsView v-if="data" :data="data" />
  <AtlasMemuat v-else />
</template>
