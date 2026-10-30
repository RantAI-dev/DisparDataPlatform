<script setup lang="ts">
/** Tombol ID/EN (AtlasNav.tsx). Hanya tampil di direktori restoran (SPEC §5.4). */
defineProps<{ lang: Lang; t: (k: string) => string }>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    :aria-label="`Switch language to ${t('nav.switch_to')}`"
    class="press-scale inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas px-2.5 py-1.5 hover:border-ink-muted-48 transition-colors"
    @click="$emit('toggle')"
  >
    <span class="apple-caption-strong tabular text-ink uppercase tracking-wider">
      {{ lang.toUpperCase() }}
    </span>
    <span class="apple-fine text-ink-muted-48">/</span>
    <span class="apple-fine tabular text-ink-muted-48 uppercase tracking-wider">
      {{ t("nav.switch_to") }}
    </span>
  </button>
</template>
