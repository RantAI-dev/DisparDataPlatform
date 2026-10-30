<script setup lang="ts">
/** Lencana tier (CatalogView.tsx TierBadge). */
import { GREEN, NAVY } from "../constants";
import type { Tier } from "../composables/useDataset";

defineProps<{ tier: Tier }>();
</script>

<template>
  <span
    class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
    :style="{ background: tier === 'primer' ? '#eef2f9' : '#e8f5ee', color: tier === 'primer' ? NAVY : GREEN }"
  >{{ tier === "primer" ? "Data Primer" : "Data Sekunder" }}</span>
</template>
