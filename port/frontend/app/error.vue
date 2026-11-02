<script setup lang="ts">
// Meniru halaman 404 bawaan Next.js di produksi (SPEC §5.2), termasuk gaya inline dan judulnya.
// Markup acuan: https://dispar.rantai.dev/tidak-ada (28 Okt 2026). Nav tetap tampil lewat layout.
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();
const kode = computed(() => props.error.statusCode || 500);
// 404 persis Next.js; status lain memakai statusMessage-nya (mis. "Service Unavailable"), bukan selalu 500.
const pesan = computed(() =>
  kode.value === 404 ? "This page could not be found." : `${props.error.statusMessage || "Internal Server Error"}.`,
);

useHead({
  title: computed(() => `${kode.value}: ${pesan.value}`),
  meta: [{ name: "robots", content: "noindex" }],
});
</script>

<template>
  <NuxtLayout>
    <div
      style="
        font-family: system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
        height: 100vh;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      "
    >
      <div>
        <component :is="'style'">
          body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media
          (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid
          rgba(255,255,255,.3)}}
        </component>
        <h1
          class="next-error-h1"
          style="display: inline-block; margin: 0 20px 0 0; padding: 0 23px 0 0; font-size: 24px; font-weight: 500; vertical-align: top; line-height: 49px"
        >
          {{ kode }}
        </h1>
        <div style="display: inline-block">
          <h2 style="font-size: 14px; font-weight: 400; line-height: 49px; margin: 0">{{ pesan }}</h2>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>
