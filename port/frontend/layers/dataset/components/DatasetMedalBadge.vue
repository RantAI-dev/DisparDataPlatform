<script setup lang="ts">
/** Lencana lapisan medallion (CatalogView.tsx MedalBadge): `◆ {Label}`, atau `—` bila belum ada. */
import { MEDAL, type MedallionInfo } from "../constants";

const props = defineProps<{ info?: MedallionInfo | null }>();
const m = computed(() => (props.info ? MEDAL[props.info.level] : null));
const judul = computed(() =>
  m.value && props.info
    ? `${m.value.label} — ${m.value.catatanKatalog}${props.info.mart ? ` (${props.info.mart})` : ""}`
    : undefined,
);
</script>

<template>
  <span v-if="!m" class="text-[12px] text-slate-300">—</span>
  <span
    v-else
    class="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded whitespace-nowrap"
    :style="{ background: m.bg, color: m.fg }"
    :title="judul"
  >◆ {{ m.label }}</span>
</template>
