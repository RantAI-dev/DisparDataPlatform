<script setup lang="ts">
/**
 * Satu blok halaman indikator (Block di IndicatorShell.tsx + chart view per indikator). Tipe dari
 * Data API memetakan komponen yang dipakai 19 view v2: bar → BarBreakdown, ranked → RankedList,
 * line → LineTrend, donut → Donut, map_points → PointMap, grouped_lines → GroupedLines,
 * table_events → tabel event.
 */
import type { Blok } from "../composables/useIndikator";

defineProps<{ blok: Blok; warna?: string }>();
const kosong = (rows: string[][]) => rows.length === 1 && rows[0]!.length === 1;
const KELAS_SEL = ["py-2 pr-3 tabular-nums text-slate-500 whitespace-nowrap", "py-2 pr-3 text-slate-800", "py-2 pr-3 text-slate-600"];
</script>

<template>
  <div>
    <h2 class="text-[15px] font-semibold text-slate-800 mb-3">{{ blok.title }}</h2>
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <BarBreakdown v-if="blok.type === 'bar'" :data="blok.data" :color="warna" />
      <RankedList v-else-if="blok.type === 'ranked'" :data="blok.data" />
      <LineTrend v-else-if="blok.type === 'line'" :data="blok.data" />
      <Donut v-else-if="blok.type === 'donut'" :data="blok.data" />
      <PointMap v-else-if="blok.type === 'map_points'" :points="blok.data" />
      <GroupedLines v-else-if="blok.type === 'grouped_lines'" :series="blok.data.series" />
      <div v-else-if="blok.type === 'table_events'" class="overflow-x-auto">
        <table class="w-full text-[13px]">
          <thead>
            <tr class="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th v-for="h in blok.data.header" :key="h" class="py-2 pr-3 font-semibold">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="kosong(blok.data.rows)">
              <td :colspan="blok.data.header.length" class="py-6 text-center text-slate-400">{{ blok.data.rows[0][0] }}</td>
            </tr>
            <template v-else>
              <tr v-for="(r, i) in blok.data.rows" :key="i" class="border-b border-slate-100">
                <td v-for="(c, j) in r" :key="j" :class="KELAS_SEL[Number(j)]">{{ c }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
