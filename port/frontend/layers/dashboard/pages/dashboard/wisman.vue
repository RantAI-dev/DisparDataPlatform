<script setup lang="ts">
/**
 * Wisatawan mancanegara (app/dashboard/wisman/page.tsx + WismanStat + LosByClass + DestinasiStat
 * @ 464fc15). Angka turunan (target, YoY, top-8 + Lainnya, pintu bulanan/semesteran) dihitung Data API.
 */
import { NEGARA_COLORS, PINTU_COLORS, WARNA_YOY, labelBulan } from "../../constants";

definePageMeta({ layout: "dashboard" });
const api = useDashboard();

const [{ data: tahunan }, { data: los }] = await Promise.all([
  useAsyncData("wisman-tahunan", () => api.wismanTahunan()),
  useAsyncData("los-rata", () => api.losRataRata()),
]);
const year = ref(tahunan.value?.tahun_default ?? "");
const month = ref<string | undefined>(undefined);

const [{ data: bulanan }, { data: negaraTahun }, { data: pintuTahun }, { data: negaraBulan }, { data: pintuBulan }] = await Promise.all([
  useAsyncData("wisman-bulanan", () => api.wismanBulanan(month.value), { watch: [month] }),
  useAsyncData("wisman-negara-tahun", () => api.wismanKebangsaan({ tahun: year.value }), { watch: [year] }),
  useAsyncData("wisman-pintu-tahun", () => api.wismanPintuMasuk({ tahun: year.value }), { watch: [year] }),
  useAsyncData("wisman-negara-bulan", () => api.wismanKebangsaan({ periode: month.value ?? tahunan.value?.data_tersedia.sampai }), { watch: [month] }),
  useAsyncData("wisman-pintu-bulan", () => api.wismanPintuMasuk({ periode: month.value ?? tahunan.value?.data_tersedia.sampai }), { watch: [month] }),
]);

const tahun = computed(() => tahunan.value?.tahun ?? []);
const yLabel = (y: string) => tahun.value.find((t) => t.tahun === y)?.label ?? y;
const terakhir = computed(() => tahun.value[tahun.value.length - 1]);
const catatanParsial = computed(() => {
  const t = terakhir.value;
  const s = t && /\(s\/d (\w+)\)/.exec(t.label)?.[1];
  return s ? ` ${t!.tahun} masih berjalan — capaian parsial s/d ${s}.` : "";
});
const periods = computed(() => (bulanan.value?.rows ?? []).map((r) => r.periode));
const bulanAktif = computed(() => bulanan.value?.periode ?? "");
const pilihBulan = (e: Event) => (month.value = (e.target as HTMLSelectElement).value);
const losSeri = computed(() => [
  { name: "Wisman", data: (los.value?.wisman ?? []).map((r) => ({ label: r.periode, value: r.nilai })) },
  { name: "Wisnus", data: (los.value?.wisnus ?? []).map((r) => ({ label: r.periode, value: r.nilai })) },
]);
</script>

<template>
  <div class="mb-4">
    <div class="apple-fine uppercase tracking-wider text-ink-muted-48">Kinerja Pariwisata</div>
    <h2 class="text-[22px] font-bold tracking-tight text-ink">Wisatawan Mancanegara (2024–2026)</h2>
  </div>

  <div v-if="!bulanan?.rows.length" class="rounded-xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
    Data wisatawan mancanegara belum dapat ditampilkan. Coba muat ulang halaman.
  </div>
  <div v-else>
    <p class="mb-5 apple-fine text-ink-muted-48">
      Data tersedia {{ labelBulan(tahunan!.data_tersedia.dari) }} – {{ labelBulan(tahunan!.data_tersedia.sampai) }}
    </p>

    <SectionHead title="1 · Tahunan" desc="Capaian vs target RPJMD dan komposisi wisman per tahun." />
    <KpiRow>
      <Kpi v-for="k in tahunan!.kpi" :key="k.label" :label="k.label" :value="k.value" :sub="k.sub ?? undefined" :delta="k.delta" />
    </KpiRow>

    <div class="mt-4">
      <ChartCard title="Capaian vs Target Wisman" sub="Capaian = batang (kunjungan wisman) · Target RPJMD = garis">
        <ComboBarLine
          :categories="tahun.map((t) => t.label)"
          :bar="{ name: 'Capaian', values: tahun.map((t) => t.jumlah) }"
          :line="{ name: 'Target RPJMD', values: tahun.map((t) => t.target) }"
          :dual-axis="false"
        />
        <p class="mt-2 apple-fine text-ink-muted-48">
          RPJMD 2025–2029 mencantumkan target dimulai dari tahun 2025 (Tabel III.2 indikator 2.1.c).{{ catatanParsial }}
        </p>
      </ChartCard>
    </div>

    <div class="mt-6 mb-3 flex flex-wrap items-center gap-2">
      <span class="apple-fine uppercase tracking-wider text-ink-muted-48">Filter berdasarkan Tahun</span>
      <ModeToggle v-model="year" :options="tahun.map((t) => ({ value: t.tahun, label: t.tahun }))" />
    </div>
    <ChartGrid :cols="2">
      <ChartCard :title="`Persentase Wisman berdasarkan Kebangsaan · ${yLabel(year)}`" sub="8 negara terbesar + lainnya">
        <Donut show-percent :data="negaraTahun?.items ?? []" :color-map="NEGARA_COLORS" />
      </ChartCard>
      <ChartCard
        :title="`Persentase Wisman berdasarkan Pintu Masuk · ${year}`"
        :sub="`Soekarno-Hatta, Halim, Tanjung Priok · semester ${pintuTahun?.semester || '—'}`"
      >
        <Donut show-percent :data="pintuTahun?.items ?? []" :color-map="PINTU_COLORS" />
      </ChartCard>
    </ChartGrid>

    <SectionHead title="2 · Tren Bulanan" desc="Tren bulanan, perbandingan year-on-year, komposisi per bulan, dan lama menginap." />
    <ChartCard title="Grafik Wisman per bulan" sub="kunjungan wisman per bulan, seluruh periode">
      <VerticalBars :data="bulanan.rows.map((r) => ({ label: r.periode, value: r.jumlah }))" unit=" kunjungan" :label-fmt="labelBulan" />
    </ChartCard>

    <div class="mt-4">
      <ChartGrid :cols="2">
        <ChartCard title="Wisman year-on-year" sub="bulan yang sama dibandingkan lintas tahun · • = tahun berjalan">
          <GroupedBars :series="bulanan.yoy.seri" :categories="bulanan.yoy.kategori" unit=" kunjungan" :colors="WARNA_YOY" />
        </ChartCard>
        <ChartCard title="Pertumbuhan YoY per bulan (%)" sub="vs bulan yang sama tahun sebelumnya">
          <VerticalBars :data="bulanan.pertumbuhan.map((r) => ({ label: r.periode, value: r.persen }))" unit="%" :label-fmt="labelBulan" color="#0e7c42" />
        </ChartCard>
      </ChartGrid>
    </div>

    <div class="mt-6 mb-3 flex flex-wrap items-center gap-2">
      <span class="apple-fine uppercase tracking-wider text-ink-muted-48">Pilih bulan</span>
      <select :value="bulanAktif" class="rounded-lg border border-hairline bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-sm" @change="pilihBulan">
        <option v-for="p in periods" :key="p" :value="p">{{ labelBulan(p) }}</option>
      </select>
    </div>
    <KpiRow>
      <Kpi v-for="k in bulanan.kpi" :key="k.label" :label="k.label" :value="k.value" :sub="k.sub ?? undefined" :delta="k.delta" />
    </KpiRow>
    <div class="mt-4">
      <ChartGrid :cols="2">
        <ChartCard :title="`Persentase Wisman berdasarkan Kebangsaan · ${labelBulan(bulanAktif)}`" sub="8 negara terbesar + lainnya">
          <Donut show-percent :data="negaraBulan?.items ?? []" :color-map="NEGARA_COLORS" />
        </ChartCard>
        <ChartCard
          v-if="pintuBulan?.sumber === 'bps_bulanan'"
          :title="`Persentase Wisman berdasarkan Pintu Masuk · ${labelBulan(bulanAktif)}`"
          sub="data bulanan BPS DKI Jakarta"
        >
          <Donut show-percent :data="pintuBulan.items" :color-map="PINTU_COLORS" />
        </ChartCard>
        <ChartCard
          v-else
          :title="`Persentase Wisman berdasarkan Pintu Masuk · ${pintuBulan?.label ?? ''}`"
          sub="data bulanan BPS belum tersedia untuk bulan ini — ditampilkan data semesteran SDI"
        >
          <Donut v-if="pintuBulan?.items.length" show-percent :data="pintuBulan.items" :color-map="PINTU_COLORS" />
          <div v-else class="py-10 text-center text-[13px] text-ink-muted-48">Semester ini belum dirilis.</div>
        </ChartCard>
      </ChartGrid>
    </div>

    <SectionHead title="Length of Stay — rata-rata lama menginap" desc="Rata-rata lama menginap (hari) per bulan, wisman vs wisnus." />
    <ChartGrid :cols="2">
      <ChartCard title="RTL Bintang · tren bulanan" sub="rata-rata sederhana Bintang 1–5 (hari)">
        <GroupedLines :series="losSeri" />
      </ChartCard>
      <DashboardLosByClass guest="wisman" />
    </ChartGrid>
  </div>

  <SectionHead
    title="Kunjungan ke Destinasi Wisata"
    desc="Jumlah kunjungan wisatawan mancanegara ke obyek wisata di DKI Jakarta, per bulan (Dinas Pariwisata dan Ekonomi Kreatif)."
  />
  <DashboardDestinasiStat jenis="wisman" />
  <SourceNote>
    Sumber: Satu Data Jakarta (kunjungan bulanan dan kebangsaan, mulai 2024; pintu masuk semesteran), BPS Provinsi DKI Jakarta (pintu masuk
    bulanan 2024; rata-rata lama menginap hotel bintang); Dinas Pariwisata dan Ekonomi Kreatif DKI Jakarta (Jumlah Kunjungan Wisatawan ke Obyek
    Wisata Menurut Lokasi). Diperbarui otomatis setiap hari.
  </SourceNote>
</template>
