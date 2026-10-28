<script setup lang="ts">
/**
 * Hero gelap bersama (inventaris A §8): pendar oranye kanan atas di atas gradien arang. Di v2 pola
 * ini ditulis ulang di PariwisataShell, IndicatorShell, CatalogView, FrameworkView, GciOfficial, dan
 * sdi/[slug]; padding vertikalnya berbeda per halaman, jadi diberikan lewat `pad`.
 */
withDefaults(defineProps<{ pad?: string }>(), { pad: "pt-8 pb-10" });
const HERO =
  "radial-gradient(900px 320px at 88% -25%, rgba(237,107,35,0.28), transparent 62%), linear-gradient(160deg, #2a2521 0%, #16130f 100%)";
</script>

<template>
  <section :style="{ background: HERO }" class="text-white">
    <div :class="`mx-auto max-w-[1320px] px-6 ${pad}`"><slot /></div>
  </section>
</template>
