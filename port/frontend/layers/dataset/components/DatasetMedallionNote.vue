<script setup lang="ts">
/** Lapisan medallion dataset ini + keterangannya (app/sdi/[slug]/page.tsx MedallionNote). */
import { MEDAL, type MedallionInfo } from "../constants";

const props = defineProps<{ info: MedallionInfo }>();
const m = computed(() => MEDAL[props.info.level]);
const path = computed(() =>
  props.info.level === "gold" ? ["Bronze", "Silver", "Gold"] : props.info.level === "silver" ? ["Bronze", "Silver"] : ["Bronze"],
);
</script>

<template>
  <div class="mt-4 inline-flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-white/10 border border-white/15 px-4 py-2.5">
    <span class="text-white/50 uppercase text-[11px] tracking-wider">Lapisan lakehouse:</span>
    <span class="inline-flex items-center gap-1.5 text-[12px] text-white/70">
      <span v-for="(p, i) in path" :key="p" class="inline-flex items-center gap-1.5">
        <span v-if="i > 0" class="text-white/30">→</span>
        <span
          v-if="p === m.label"
          class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
          :style="{ background: m.bg, color: m.fg }"
        >◆ {{ p }}</span>
        <span v-else>{{ p }}</span>
      </span>
    </span>
    <span class="text-[12.5px] text-white/70 max-w-[70ch]">{{ m.catatanDetail }}{{ info.mart ? ` (${info.mart})` : "" }}.</span>
  </div>
</template>
