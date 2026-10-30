<script setup lang="ts">
/** Kesiapan data per framework (components/FrameworkView.tsx, showTrend=false di GCI dan GPCI). */
import { DOT_RINGKASAN, STATUS } from "../constants";
import type { DaftarIndikator } from "../composables/useIndikator";

const props = defineProps<{ title: string; subtitle: string; data: DaftarIndikator }>();
const LINK = "#2563eb";
const hasNo = computed(() => props.data.rows.some((r) => r.no != null));
const tableRows = computed(() => (hasNo.value ? [...props.data.rows].sort((a, b) => (a.no ?? 999) - (b.no ?? 999)) : props.data.rows));
const belumReady = computed(() => props.data.rows.filter((x) => x.status !== "ready"));
</script>

<template>
  <main class="min-h-screen bg-[#faf6f2]">
    <IndikatorFrameworkHeader :title="title" :subtitle="subtitle">
      <div class="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-[820px]">
        <div v-for="c in data.summary" :key="c.label" class="rounded-lg bg-white/10 border border-white/15 px-4 py-3 text-white">
          <div class="text-[11px] font-mono tracking-wider text-white/60 flex items-center gap-1.5">
            <span v-if="DOT_RINGKASAN[c.label]" class="inline-block w-1.5 h-1.5 rounded-full" :style="{ background: DOT_RINGKASAN[c.label] }" />
            {{ c.label }}
          </div>
          <div class="text-[22px] font-bold tabular-nums mt-1">{{ c.value }}</div>
        </div>
      </div>
    </IndikatorFrameworkHeader>
    <slot name="setelah-header" />
    <section class="mx-auto max-w-[1320px] px-6 py-8 pb-20 space-y-8">
      <div>
        <h2 class="text-[16px] font-bold text-slate-800 mb-3">Kesiapan indikator</h2>
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-[14px]">
              <thead>
                <tr style="background: #2a2521" class="text-white text-left text-[12px] uppercase tracking-wider">
                  <th v-if="hasNo" class="px-4 py-3 font-semibold w-14">No.</th>
                  <th class="px-4 py-3 font-semibold w-16">Kode</th>
                  <th class="px-4 py-3 font-semibold">Indikator</th>
                  <th class="px-4 py-3 font-semibold w-24">Status</th>
                  <th class="px-4 py-3 font-semibold">Dataset / Pemilik</th>
                  <th class="px-4 py-3 font-semibold w-44 text-right">Nilai terbaru</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="x in tableRows" :key="x.code" class="border-t border-slate-100 align-top">
                  <td v-if="hasNo" class="px-4 py-3 font-semibold text-slate-700 tabular-nums">{{ x.no ?? "—" }}</td>
                  <td class="px-4 py-3 text-slate-400 tabular-nums">{{ x.code }}</td>
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/${x.framework.toLowerCase()}/${x.code}`" class="font-medium hover:underline" :style="{ color: LINK }">{{ x.name }}</NuxtLink>
                    <div class="text-[12px] text-slate-400">{{ x.group }}</div>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full" :style="{ background: STATUS[x.status].bg, color: STATUS[x.status].fg }">{{
                      STATUS[x.status].label
                    }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <div v-if="x.datasets.length" class="flex flex-col gap-1">
                      <NuxtLink v-for="d in x.datasets" :key="d.slug" :to="`/sdi/${d.slug}`" class="text-[13px] hover:underline" :style="{ color: LINK }">{{
                        d.title
                      }}</NuxtLink>
                    </div>
                    <span v-else class="text-[13px] text-slate-500">{{ x.owner }}</span>
                  </td>
                  <td class="px-4 py-3 text-right tabular-nums text-slate-700">
                    <template v-if="x.latest">
                      <div class="font-semibold">{{ x.latest.value.toLocaleString("id-ID") }}</div>
                      <div class="text-[11px] text-slate-400">periode {{ x.latest.label }}</div>
                    </template>
                    <span v-else class="text-slate-300">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div v-if="belumReady.length > 0">
        <h2 class="text-[16px] font-bold text-slate-800 mb-3">Kelengkapan data ({{ belumReady.length }})</h2>
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          <div v-for="x in belumReady" :key="x.code" class="px-5 py-3 flex items-start gap-3">
            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5" :style="{ background: STATUS[x.status].bg, color: STATUS[x.status].fg }">{{
              STATUS[x.status].label
            }}</span>
            <div>
              <div class="text-[14px] font-medium text-slate-800">{{ x.name }}</div>
              <div class="text-[12px] text-slate-500">{{ x.note || "—" }} · <span class="text-slate-400">{{ x.owner }}</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
