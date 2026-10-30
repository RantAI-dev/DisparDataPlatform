<script setup lang="ts">
/** Konteks indeks per indikator (components/indicators/IndexContext.tsx); isi dari `konteks` respons detail. */
import { STATUS_DATA } from "../constants";
import type { Konteks } from "../composables/useIndikator";

defineProps<{ b: Konteks }>();
</script>

<template>
  <div class="grid md:grid-cols-3 gap-5">
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div class="text-[11px] font-mono uppercase tracking-wider text-slate-400">Cara indeks mengukur</div>
      <div class="text-[14px] font-medium text-slate-800 mt-1">{{ b.index_metric }}</div>
      <div class="text-[12px] text-slate-500 mt-2">Sumber resmi indeks: <span class="text-slate-700">{{ b.index_source }}</span></div>
      <div class="text-[12px] text-slate-400 mt-1">Satuan: {{ b.unit }}</div>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div class="text-[11px] font-mono uppercase tracking-wider text-slate-400">Jakarta vs frontier</div>
      <div class="mt-2 text-[13px] space-y-1">
        <div class="flex justify-between gap-3">
          <span class="text-slate-500">Jakarta (data proksi)</span>
          <span class="font-semibold text-slate-800 text-right">{{ b.jakarta.value ?? "—" }}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-slate-500">Frontier ({{ b.frontier.city }})</span>
          <span class="font-semibold text-right" style="color: #ed6b23">{{ b.frontier.value }}</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-slate-500">Target</span>
          <span class="font-medium text-right" style="color: #b5651d">{{ b.target }}</span>
        </div>
      </div>
      <div v-if="b.jakarta.note" class="text-[11px] text-slate-400 mt-2">{{ b.jakarta.note }}</div>
    </div>
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div class="text-[11px] font-mono uppercase tracking-wider text-slate-400">Data pendukung yang dibutuhkan</div>
      <ul class="mt-2 space-y-2">
        <li v-for="(d, i) in b.data_needed" :key="i" class="text-[13px] leading-snug">
          <span
            class="text-[10px] font-semibold px-1.5 py-0.5 rounded mr-2 whitespace-nowrap"
            :style="{ background: STATUS_DATA[d.status].bg, color: STATUS_DATA[d.status].fg }"
          >{{ STATUS_DATA[d.status].label }}</span>
          <span class="text-slate-700">{{ d.label }}</span>
          <span class="text-slate-400"> · {{ d.owner }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
