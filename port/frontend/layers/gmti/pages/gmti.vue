<script setup lang="ts">
/** /gmti (GmtiView, client-only seperti v2: "Memuat…" sampai ringkasan tiba). */
const { ringkasan } = useGmti();
const { data } = useLazyAsyncData("gmti-ringkasan", () => ringkasan(), { server: false });
</script>

<template>
  <GmtiView v-if="data" :ringkasan="data" />
  <div v-else class="min-h-screen flex items-center justify-center bg-canvas">
    <div class="apple-caption text-ink-muted-48">Memuat…</div>
  </div>
</template>
