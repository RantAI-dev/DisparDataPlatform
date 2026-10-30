<script setup lang="ts">
/** Blok kode gelap dengan tombol salin (docs-client.tsx CodeBlock). `html` sudah di-escape. */
defineProps<{ label: string; code: string; html: string }>();
</script>

<template>
  <div class="docs-code overflow-hidden rounded-xl" style="background: #1f1a15; border: 1px solid #2e2721">
    <div class="flex items-center justify-between px-4 py-2" style="border-bottom: 1px solid #2e2721">
      <span class="atlas-mono" style="color: #8d8172">{{ label }}</span>
      <DocsCopyButton :text="code" />
    </div>
    <pre class="overflow-x-auto px-4 py-3.5 text-[12.5px] leading-[1.7]" style="font-family: var(--font-mono); color: #e8e0d4"><code v-html="html" /></pre>
  </div>
</template>
