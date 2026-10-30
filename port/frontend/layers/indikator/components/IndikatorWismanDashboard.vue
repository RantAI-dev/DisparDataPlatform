<script setup lang="ts">
/**
 * Dashboard wisman per tahun (components/pariwisata/WismanDashboard.tsx). Data per tahun dari
 * `komponen.WismanDashboard` endpoint pariwisata; KPI, kuartal, dan target dihitung di sini
 * seperti komponen React (presentasi saja).
 */
import { KONDISI_AWAL_WISMAN, TARGET_WISMAN, bulanLabel } from "../constants";

type Titik = { label: string; value: number };
type DataTahun = { total: number; monthly: Titik[]; quarterly: Titik[]; topNegara: Titik[]; donutNegara: Titik[]; peakMonth: Titik | null; partial?: boolean };
const props = defineProps<{ years: string[]; byYear: Record<string, DataTahun>; yearlyTotals: Titik[]; defaultYear: string }>();

const year = ref(props.defaultYear);
const activeYear = computed(() => (props.byYear[year.value] ? year.value : props.years[0]!));
const d = computed(() => (activeYear.value ? props.byYear[activeYear.value] : null));
const idx = computed(() => props.years.indexOf(activeYear.value));
const prev = computed(() => (idx.value > 0 ? props.byYear[props.years[idx.value - 1]!] : null));
const yoy = computed(() => (prev.value && prev.value.total && d.value ? ((d.value.total - prev.value.total) / prev.value.total) * 100 : null));
const quarterSeries = computed(() =>
  props.years.filter((y) => props.byYear[y]?.quarterly?.length).map((y) => ({ name: props.byYear[y]!.partial ? `${y} •` : y, data: props.byYear[y]!.quarterly })),
);
const quarterCats = computed(() => ["Q1", "Q2", "Q3", "Q4"].filter((q) => quarterSeries.value.some((s) => s.data.some((p) => p.label === q))));
const cmpYears = computed(() => Array.from(new Set([...props.years, ...Object.keys(TARGET_WISMAN)])).sort());
const realisasi = computed(() => cmpYears.value.flatMap((y) => (props.byYear[y]?.total != null ? [{ label: y, value: props.byYear[y]!.total }] : [])));
const target = computed(() => cmpYears.value.flatMap((y) => (TARGET_WISMAN[y] != null ? [{ label: y, value: TARGET_WISMAN[y]! }] : [])));
const tahunanBerjalan = computed(() => props.yearlyTotals.some((y) => props.byYear[y.label]?.partial));
</script>

<template>
  <section v-if="!years.length || !d" class="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400">Data wisman belum tersedia.</section>
  <section v-else>
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <span class="apple-fine uppercase tracking-wider text-ink-muted-48">Pilih tahun</span>
      <div class="inline-flex rounded-xl border border-hairline bg-white p-1 shadow-sm">
        <button
          v-for="y in years"
          :key="y"
          :aria-pressed="y === year"
          :class="`rounded-lg px-4 py-1.5 text-[13px] font-semibold tabular-nums transition-colors ${y === year ? 'text-white' : 'text-ink-muted-48 hover:text-ink'}`"
          :style="y === year ? { background: '#ed6b23' } : undefined"
          @click="year = y"
        >
          {{ y }}<span v-if="byYear[y]?.partial" class="ml-1 text-[10px] opacity-70">•</span>
        </button>
      </div>
      <span v-if="d.partial" class="apple-fine text-ink-muted-48">• {{ year }} masih berjalan (data parsial)</span>
    </div>
    <KpiRow>
      <Kpi :label="`Total wisman ${year}`" :value="d.total" sub="akumulasi bulanan" />
      <Kpi
        label="Negara asal terbanyak"
        :value="d.topNegara[0]?.label ?? '—'"
        :sub="d.topNegara[0] ? d.topNegara[0].value.toLocaleString('id-ID') + ' kunjungan' : undefined"
      />
      <Kpi
        label="Puncak bulan"
        :value="d.peakMonth ? bulanLabel(d.peakMonth.label) : '—'"
        :sub="d.peakMonth ? d.peakMonth.value.toLocaleString('id-ID') + ' kunjungan' : undefined"
      />
      <Kpi label="Pertumbuhan tahunan" :value="yoy != null ? `${yoy.toFixed(1)}%` : '—'" :delta="yoy" :sub="prev ? `vs ${years[idx - 1]}` : '—'" />
    </KpiRow>
    <div class="mt-4">
      <ChartGrid>
        <ChartCard :title="`Tren bulanan ${year}`" sub="kunjungan per bulan (batang)">
          <VerticalBars :data="d.monthly" unit=" kunjungan" :label-fmt="bulanLabel" />
        </ChartCard>
        <ChartCard :title="`Top 5 negara asal ${year}`" sub="kunjungan per negara">
          <BarBreakdown :data="d.topNegara" unit=" kunjungan" />
        </ChartCard>
        <ChartCard :title="`Peta komposisi negara ${year}`" sub="treemap · proporsi & detail">
          <Treemap :data="d.donutNegara" />
        </ChartCard>
        <ChartCard :title="`Komposisi negara ${year}`" sub="top 8 + lainnya (donut)">
          <Donut :data="d.donutNegara" />
        </ChartCard>
      </ChartGrid>
    </div>
    <div v-if="quarterSeries.length > 0 && quarterCats.length > 0" class="mt-4">
      <ChartCard
        title="Perbandingan kuartal antar tahun"
        :sub="`Q1–Q4 dibandingkan lintas tahun${quarterSeries.some((s) => s.name.includes('•')) ? ' · tahun berjalan ditandai •' : ''}`"
      >
        <GroupedBars :series="quarterSeries" :categories="quarterCats" unit=" kunjungan" />
      </ChartCard>
    </div>
    <div class="mt-4">
      <ChartCard title="Tren wisman per tahun" :sub="`total kunjungan tahunan${tahunanBerjalan ? ' · tahun berjalan ditandai •' : ''}`">
        <BarBreakdown
          :data="yearlyTotals.map((y) => ({ label: byYear[y.label]?.partial ? `${y.label} •` : y.label, value: y.value }))"
          unit=" kunjungan"
          :color="PALETTE[2]"
        />
      </ChartCard>
    </div>
    <div class="mt-4">
      <ChartCard title="Target vs Realisasi Wisman (RPJMD 2025–2029)" sub="Batang berdampingan: realisasi (asli) vs target Jumlah Tamu Mancanegara">
        <GroupedBars
          :categories="cmpYears"
          :series="[
            { name: 'Realisasi (asli)', data: realisasi },
            { name: 'Target (RPJMD)', data: target },
          ]"
          :colors="['#ed6b23', '#0e7c42']"
          unit=" org"
        />
        <p class="mt-2 apple-fine text-ink-muted-48">
          <span class="font-medium" style="color: #ed6b23">Oranye</span> = realisasi (asli) · <span class="font-medium" style="color: #0e7c42">hijau</span> =
          target RPJMD. Sumber target: Tabel III.2 indikator 2.1.c (kondisi awal {{ KONDISI_AWAL_WISMAN.toLocaleString("id-ID") }}). Tahun berjalan =
          data parsial.
        </p>
      </ChartCard>
    </div>
  </section>
</template>
