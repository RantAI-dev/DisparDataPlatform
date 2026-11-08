<script setup lang="ts">
/** Tag sumber data per baris, kolom paling kanan tabel dataset (SumberTag di SdiTable.tsx v2). */
defineProps<{ label: string }>();
</script>

<template>
  <span class="inline-block min-w-[12rem] max-w-[22rem] rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[12px] leading-snug text-slate-600">{{
    label
  }}</span>
</template>
