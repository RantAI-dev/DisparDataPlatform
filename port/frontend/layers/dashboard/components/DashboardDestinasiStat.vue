<script setup lang="ts">
/**
 * Kunjungan satu jenis wisatawan ke destinasi wisata (components/dashboard/DestinasiStat.tsx).
 * Tahun bawaan = tahun lengkap terakhir dari API; KPI dan catatan data dihitung Data API.
 */
import { NAMA_JENIS, SEMUA_DESTINASI, labelBulan } from "../constants";
import type { Jenis } from "../composables/useDashboard";

const props = defineProps<{ jenis: Jenis }>();
const api = useDashboard();
const nama = NAMA_JENIS[props.jenis];

const { data: meta } = await useAsyncData(`destinasi-meta-${props.jenis}`, () => api.destinasiMeta(props.jenis));
const year = ref(meta.value?.tahun_default ?? "");
const dest = ref(SEMUA_DESTINASI);
const pilihDest = computed(() => (dest.value === SEMUA_DESTINASI ? undefined : dest.value));

const { data: ringkas } = await useAsyncData(`destinasi-ringkasan-${props.jenis}`, () => api.destinasiRingkasan(props.jenis, year.value, pilihDest.value), {
  watch: [year, dest],
});
const { data: perDest } = await useAsyncData(`destinasi-per-${props.jenis}`, () => api.destinasiPerDestinasi(props.jenis, year.value), { watch: [year] });
const { data: bulanan } = await useAsyncData(`destinasi-bulanan-${props.jenis}`, () => api.destinasiBulanan(props.jenis, pilihDest.value), { watch: [dest] });

const yLabel = computed(() => perDest.value?.label ?? year.value);
const pilihan = computed(() => (meta.value?.tahun ?? []).map((t) => ({ value: t.value, label: t.label })));
const catatan = computed(() =>
  (ringkas.value?.catatan ?? []).map((c) => (c.startsWith("Catatan data:") ? { tebal: "Catatan data:", isi: c.slice("Catatan data:".length) } : { tebal: null, isi: c })),
);
const items = computed(() => perDest.value?.items ?? []);
</script>

<template>
  <div v-if="!meta?.tahun.length" class="rounded-xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
    Data kunjungan {{ nama }} ke destinasi wisata belum dapat ditampilkan. Coba muat ulang halaman.
  </div>
  <div v-else>
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <span class="apple-fine uppercase tracking-wider text-ink-muted-48">Tahun</span>
      <ModeToggle v-model="year" :options="pilihan" />
    </div>
    <div class="mb-5 flex flex-wrap items-center gap-2">
      <span class="apple-fine uppercase tracking-wider text-ink-muted-48">Destinasi</span>
      <select v-model="dest" class="rounded-lg border border-hairline bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-sm">
        <option v-for="d in [SEMUA_DESTINASI, ...meta.destinasi]" :key="d" :value="d">{{ d }}</option>
      </select>
    </div>
    <KpiRow>
      <Kpi v-for="k in ringkas?.kpi ?? []" :key="k.label" :label="k.label" :value="k.value" :sub="k.sub ?? undefined" :delta="k.delta" />
    </KpiRow>
    <p
      v-for="c in catatan"
      :key="c.isi"
      :class="c.tebal ? 'mt-2 apple-fine text-ink-muted-80' : 'mt-2 apple-fine text-ink-muted-48'"
    ><span v-if="c.tebal" class="font-semibold">{{ c.tebal }}</span>{{ c.isi }}</p>
    <div class="mt-4">
      <ChartGrid :cols="2">
        <ChartCard :title="`Kunjungan ${nama} per destinasi · ${yLabel}`" sub="kunjungan">
          <BarBreakdown :data="items.map((r) => ({ label: r.destinasi, value: r.jumlah }))" />
        </ChartCard>
        <ChartCard :title="`Kunjungan ${nama} per bulan · ${dest}`" sub="kunjungan; bulan yang tidak dilaporkan tidak digambar">
          <VerticalBars :data="bulanan?.items ?? []" unit=" kunjungan" :label-fmt="labelBulan" />
        </ChartCard>
      </ChartGrid>
    </div>
    <div class="mt-4">
      <ChartCard :title="`Rincian per destinasi · ${yLabel}`" :sub="`kunjungan ${nama}`">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-[12px] tabular-nums">
            <caption class="sr-only">Kunjungan {{ nama }} per destinasi, {{ yLabel }}</caption>
            <thead class="text-ink-muted-48">
              <tr>
                <th scope="col" class="py-2 pr-3">Destinasi</th>
                <th scope="col" class="py-2 px-2 text-right">Kunjungan</th>
                <th scope="col" class="py-2 px-2 text-right whitespace-nowrap">% dari total</th>
                <th scope="col" class="py-2 pl-2 text-right whitespace-nowrap">Bulan dilaporkan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in items" :key="r.destinasi" :class="`border-t border-hairline ${r.destinasi === dest ? 'bg-orange-50' : ''}`">
                <th scope="row" class="py-2 pr-3 font-medium text-ink">{{ r.destinasi }}</th>
                <td class="py-2 px-2 text-right font-semibold">{{ idNum(r.jumlah) }}</td>
                <td class="py-2 px-2 text-right">{{ r.persen === null ? "—" : `${idNum(r.persen, 1)}%` }}</td>
                <td class="py-2 pl-2 text-right">{{ r.bulan }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  </div>
</template>
