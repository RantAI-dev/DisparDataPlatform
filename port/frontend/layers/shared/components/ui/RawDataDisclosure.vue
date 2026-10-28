<script setup lang="ts">
/** Disclosure tabel data mentah, tertutup bawaan (DashboardKit.tsx). */
withDefaults(defineProps<{ slug: string; title: string; count: number; columns?: string[]; label?: string }>(), {
  columns: undefined,
  label: "Lihat data mentah",
});
</script>

<template>
  <details class="group rounded-xl border border-hairline bg-white/60">
    <summary class="cursor-pointer list-none px-5 py-3.5 text-[13px] font-semibold text-ink-muted-48 hover:text-ink">
      <span class="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
      {{ label }} · {{ title }} ({{ count.toLocaleString("id-ID") }} baris)
    </summary>
    <div class="border-t border-hairline p-5">
      <SdiTable :slug="slug" :columns="columns" />
    </div>
  </details>
</template>
