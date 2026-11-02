<script setup lang="ts">
/** Tombol salin (docs-client.tsx CopyButton). */
const props = defineProps<{ text: string }>();
const copied = ref(false);
function salin() {
  navigator.clipboard.writeText(props.text).then(() => {
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
  });
}
</script>

<template>
  <button
    aria-label="Salin ke clipboard"
    class="press-scale inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
    :style="{ color: copied ? '#7fd6ab' : '#a89c8d', background: 'rgba(255,255,255,0.06)' }"
    @click="salin"
  >
    <template v-if="copied">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
      Tersalin
    </template>
    <template v-else>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      Salin
    </template>
  </button>
</template>
