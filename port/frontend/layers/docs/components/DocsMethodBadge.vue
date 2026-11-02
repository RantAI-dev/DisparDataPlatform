<script setup lang="ts">
/** Lencana metode (docs-client.tsx MethodBadge). */
const props = defineProps<{ method: "GET" | "POST"; small?: boolean }>();
const gaya = computed(() =>
  props.method === "GET"
    ? { background: "rgba(22,128,90,0.1)", color: "#0f7a54", border: "1px solid rgba(22,128,90,0.25)" }
    : { background: "var(--accent-bg)", color: "var(--accent-deep)", border: "1px solid var(--accent-ring)" },
);
</script>

<template>
  <span :class="`inline-flex items-center rounded-md font-semibold tracking-wide ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[12px]'}`" :style="gaya">{{ method }}</span>
</template>
