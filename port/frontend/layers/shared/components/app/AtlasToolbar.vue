<script setup lang="ts">
/**
 * Toolbar daftar tematik (kontrol verifikasi & bahasa), components/atlas/AtlasNav.tsx. Toggle
 * Daftar|Peta dihapus — peta bersama diakses lewat menu Spatial. Halaman tanpa `view` tidak
 * merender toolbar agar tidak menggandakan navigasi global. Isi lewat slot `right` dan `lang`.
 */
defineProps<{ view?: "list" | "map" }>();
const slots = useSlots();
</script>

<template>
  <div v-if="view && (slots.right || slots.lang)" class="border-b border-hairline bg-canvas">
    <div class="mx-auto max-w-[1320px] px-6 h-[52px] flex items-center gap-3">
      <div class="ml-auto flex items-center gap-2.5">
        <slot name="right" />
        <slot name="lang" />
      </div>
    </div>
  </div>
</template>
