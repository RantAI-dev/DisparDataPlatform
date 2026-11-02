<script setup lang="ts">
/**
 * Wisatawan nusantara (app/dashboard/wisnus/page.tsx + WisnusStat + WisnusLos + DestinasiStat
 * @ 464fc15). Filter kota tujuan, tahun, dan kota YoY memanggil ulang Data API.
 */
import { SELURUH_JAKARTA, SEMUA_KOTA, WARNA_YOY, labelBulan } from "../../constants";

definePageMeta({ layout: "dashboard" });
const api = useDashboard();

const { data: meta } = await useAsyncData("wisnus-meta", () => api.wisnusMeta());
const kota = ref(SEMUA_KOTA);
const yoyKota = ref(SELURUH_JAKARTA);
const year = ref(meta.value?.tahun_default ?? "");
const kotaQ = computed(() => (kota.value === SEMUA_KOTA ? undefined : kota.value));
const yoyQ = computed(() => (yoyKota.value === SELURUH_JAKARTA ? undefined : yoyKota.value));

const [{ data: tahunan }, { data: perKota }, { data: bulanan }, { data: yoy }, { data: seriLos }] = await Promise.all([
  useAsyncData("wisnus-tahunan", () => api.wisnusTahunan(kotaQ.value), { watch: [kota] }),
  useAsyncData("wisnus-per-kota", () => api.wisnusPerKota(year.value), { watch: [year] }),
  useAsyncData("wisnus-bulanan", () => api.wisnusBulanan(kotaQ.value), { watch: [kota] }),
  useAsyncData("wisnus-yoy", () => api.wisnusYoy(yoyQ.value), { watch: [yoyKota] }),
  useAsyncData("los-seri-wisnus", () => api.losSeri("wisnus")),
]);
const yLabel = computed(() => perKota.value?.label ?? year.value);
const kotaList = computed(() => meta.value?.kota ?? []);
</script>

<template>
  <div class="mb-4">
    <div class="apple-fine uppercase tracking-wider text-ink-muted-48">Kinerja Pariwisata</div>
    <h2 class="text-[22px] font-bold tracking-tight text-ink">Wisatawan Nusantara</h2>
    <p class="apple-fine text-ink-muted-48">Wisatawan Nusantara Berdasarkan Kota Tujuan</p>
  </div>
  <SectionHead
    title="Tahunan · Capaian"
    desc="Jumlah perjalanan wisatawan nusantara menurut kabupaten/kota tujuan di DKI Jakarta, 2019–2026 (Berdasarkan data BPS)."
  />

  <div v-if="!meta?.tahun.length" class="rounded-xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
    Data wisatawan nusantara belum dapat ditampilkan. Coba muat ulang halaman.
  </div>
  <div v-else>
    <div class="mb-5 flex flex-wrap items-center gap-2">
      <span class="apple-fine uppercase tracking-wider text-ink-muted-48">Kota tujuan</span>
      <select v-model="kota" class="rounded-lg border border-hairline bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-sm">
        <option v-for="k in [SEMUA_KOTA, ...kotaList]" :key="k" :value="k">{{ k }}</option>
      </select>
      <span class="apple-fine text-ink-muted-48">Berdasarkan Kota/Kabupaten Tujuan Wisatawan Nusantara</span>
    </div>
    <KpiRow>
      <Kpi v-for="k in tahunan?.kpi ?? []" :key="k.label" :label="k.label" :value="k.value" :sub="k.sub ?? undefined" :delta="k.delta" />
    </KpiRow>
    <div class="mt-4">
      <ChartCard :title="`Capaian tahunan · ${kota}`" sub="jumlah perjalanan wisnus per tahun">
        <VerticalBars :data="tahunan?.tahun ?? []" unit=" perjalanan" />
        <p v-if="meta.tahun_hilang_teks" class="mt-2 apple-fine text-ink-muted-48">Tahun {{ meta.tahun_hilang_teks }} belum tersedia.</p>
      </ChartCard>
    </div>
    <div class="mt-6 mb-3 flex flex-wrap items-center gap-2">
      <span class="apple-fine uppercase tracking-wider text-ink-muted-48">Filter berdasarkan Tahun</span>
      <ModeToggle v-model="year" :options="meta.tahun.map((y) => ({ value: y, label: y }))" />
    </div>
    <ChartGrid :cols="2">
      <ChartCard :title="`Persentase per kota tujuan · ${yLabel}`" sub="% dari total perjalanan ke DKI Jakarta">
        <Donut show-percent :data="perKota?.items ?? []" />
      </ChartCard>
      <ChartCard :title="`Perjalanan per kota tujuan · ${yLabel}`" sub="perjalanan">
        <BarBreakdown :data="perKota?.items ?? []" unit=" perjalanan" />
      </ChartCard>
    </ChartGrid>
    <div class="mt-4">
      <ChartCard :title="`Tren bulanan · ${kota}`" sub="perjalanan per bulan menurut kota tujuan">
        <GroupedLines :series="bulanan?.seri ?? []" />
      </ChartCard>
    </div>
    <div class="mt-6 mb-3 flex flex-wrap items-center gap-2">
      <span class="apple-fine uppercase tracking-wider text-ink-muted-48">Kota/kabupaten (YoY)</span>
      <select v-model="yoyKota" class="rounded-lg border border-hairline bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-sm">
        <option v-for="k in [SELURUH_JAKARTA, ...kotaList]" :key="k" :value="k">{{ k }}</option>
      </select>
    </div>
    <ChartGrid :cols="2">
      <ChartCard :title="`Wisnus year-on-year · ${yoyKota}`" sub="bulan yang sama dibandingkan lintas tahun · • = tahun berjalan">
        <GroupedBars :series="yoy?.seri ?? []" :categories="yoy?.kategori ?? []" unit=" perjalanan" :colors="WARNA_YOY.slice(-(yoy?.seri.length ?? 3))" />
      </ChartCard>
      <ChartCard :title="`Pertumbuhan YoY per bulan (%) · ${yoyKota}`" sub="vs bulan yang sama tahun sebelumnya">
        <VerticalBars :data="(yoy?.pertumbuhan ?? []).map((r) => ({ label: r.periode, value: r.persen }))" unit="%" :label-fmt="labelBulan" color="#0e7c42" />
      </ChartCard>
    </ChartGrid>
  </div>

  <SectionHead title="Bulanan · Length of Stay" desc="Rata-rata lama menginap wisatawan nusantara di hotel bintang (hari)." />
  <div v-if="!seriLos?.seri.length" class="rounded-xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">Data lama menginap belum dapat ditampilkan.</div>
  <ChartGrid v-else :cols="2">
    <ChartCard title="Lama menginap wisnus per bulan" sub="hari · per kelas hotel bintang">
      <GroupedLines :series="seriLos.seri" />
    </ChartCard>
    <DashboardLosByClass guest="wisnus" />
  </ChartGrid>

  <SectionHead
    title="Kunjungan ke Destinasi Wisata"
    desc="Jumlah kunjungan wisatawan nusantara ke obyek wisata di DKI Jakarta, per bulan (Dinas Pariwisata dan Ekonomi Kreatif)."
  />
  <DashboardDestinasiStat jenis="wisnus" />
  <SourceNote>
    Sumber: BPS Provinsi DKI Jakarta (Jumlah Perjalanan Wisatawan Nusantara Menurut Kabupaten/Kota Tujuan; rata-rata lama menginap tamu hotel
    bintang via Satu Data Jakarta); Dinas Pariwisata dan Ekonomi Kreatif DKI Jakarta (Jumlah Kunjungan Wisatawan ke Obyek Wisata Menurut
    Lokasi, via Satu Data Jakarta).
  </SourceNote>
</template>
