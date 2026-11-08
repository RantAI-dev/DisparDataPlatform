<script setup lang="ts">
/** Tenaga kerja ekonomi kreatif (app/dashboard/tenaga-kerja/page.tsx + TkSubsektor @ 464fc15). */
import { TK_DATA_SUMBER } from "../../constants";

definePageMeta({ layout: "dashboard" });
const api = useDashboard();
const tahun = ref<string | undefined>(undefined);
const [{ data: dki }, { data: sub }, { data: sebaran }, { data: sert }, { data: jumlah }] = await Promise.all([
  useAsyncData("tk-dki", () => api.tkDki()),
  useAsyncData("tk-subsektor", () => api.tkSubsektor(tahun.value), { watch: [tahun] }),
  useAsyncData("tk-sebaran-dki", () => api.tkSebaranDki()),
  useAsyncData("tk-sertifikasi", () => api.tkSertifikasi()),
  useAsyncData("tk-jumlah-baris", () => Promise.all(TK_DATA_SUMBER.map((d) => api.jumlahBaris(d.slug)))),
]);
const rows = computed(() => dki.value?.rows ?? []);
const tahunAktif = computed({ get: () => sub.value?.tahun ?? "", set: (v: string) => (tahun.value = v) });
</script>

<template>
  <div class="mb-4">
    <div class="apple-fine uppercase tracking-wider text-ink-muted-48">Kinerja Ekonomi Kreatif</div>
    <h2 class="text-[22px] font-bold tracking-tight text-ink">Tenaga Kerja Ekonomi Kreatif</h2>
  </div>
  <SectionHead title="1 · Jumlah tenaga kerja ekonomi kreatif" desc="Statistik resmi Kemenekraf (olahan Sakernas BPS dengan Kemenekraf)" />
  <KpiRow v-if="dki?.kpi.length">
    <Kpi v-for="k in dki.kpi" :key="k.label" :label="k.label" :value="k.value" :sub="k.sub ?? undefined" :delta="k.delta" />
  </KpiRow>
  <div v-else class="rounded-xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
    Data tenaga kerja ekonomi kreatif belum dapat ditampilkan. Coba muat ulang halaman.
  </div>

  <SectionHead title="2 · Rincian berdasarkan subsektor ekonomi kreatif" />
  <div class="mb-3">
    <ModeToggle v-model="tahunAktif" :options="(sub?.tahun_list ?? []).map((t) => ({ value: t, label: t }))" />
  </div>
  <ChartCard :title="`Tenaga Kerja Ekonomi Kreatif per Subsektor di Tingkat Nasional - Tahun ${sub?.tahun ?? ''}`">
    <BarBreakdown :data="sub?.items ?? []" unit=" orang" :colors="(sub?.items ?? []).map((d) => warnaSubsektor(d.label))" />
  </ChartCard>
  <div class="mt-4">
    <ChartCard
      title="Sebaran Pelaku Ekonomi Kreatif per Subsektor di DKI Jakarta"
      sub="pelaku terdaftar di EKRAF Hub (hub.ekraf.go.id) yang berdomisili di DKI Jakarta — jumlah pelaku terdaftar, bukan jumlah tenaga kerja"
    >
      <BarBreakdown v-if="sebaran?.items.length" :data="sebaran.items" unit=" pelaku" :colors="sebaran.items.map((d) => warnaSubsektor(d.label))" />
      <p v-else class="py-8 text-center text-[13px] text-ink-muted-48">Data sebaran pelaku ekraf DKI belum tersedia.</p>
    </ChartCard>
  </div>

  <SectionHead title="3 · Tren Tenaga Kerja Sektor Ekonomi Kreatif Provinsi DKI Jakarta" desc="5 tahun terakhir" />
  <ChartGrid :cols="2">
    <ChartCard title="Tenaga kerja ekraf DKI & porsi nasional" sub="batang = orang · garis = % terhadap nasional">
      <ComboBarLine
        :categories="rows.map((r) => r.tahun)"
        :bar="{ name: 'Tenaga kerja (orang)', values: rows.map((r) => r.total) }"
        :line="{ name: 'Porsi nasional', values: rows.map((r) => r.porsi_pct), unit: '%' }"
      />
    </ChartCard>
    <ChartCard title="Menurut jenis kelamin" sub="orang">
      <GroupedBars
        :categories="rows.map((r) => r.tahun)"
        :series="[
          { name: 'Laki-laki', data: rows.map((r) => ({ label: r.tahun, value: r.laki })) },
          { name: 'Perempuan', data: rows.map((r) => ({ label: r.tahun, value: r.perempuan })) },
        ]"
        unit=" orang"
        :colors="['#ed6b23', '#0e7c42']"
      />
    </ChartCard>
  </ChartGrid>

  <SectionHead
    title="Tenaga kerja tersertifikasi / pendampingan Dinas"
    desc="Peserta pelatihan dan sertifikasi tenaga kerja pariwisata dan ekonomi kreatif yang didampingi Dinas, dipisahkan dari data tenaga kerja umum."
  />
  <ChartGrid :cols="2">
    <ChartCard title="Peserta sertifikasi per tahun" sub="Pelatihan dan sertifikasi tenaga kerja sektor pariwisata dan ekonomi kreatif">
      <BarBreakdown :data="sert?.per_tahun ?? []" unit=" orang" color="#0e7c42" />
    </ChartCard>
    <ChartCard title="Per bidang sertifikasi" sub="orang · per tahun">
      <GroupedBars :series="sert?.seri ?? []" :categories="sert?.bidang ?? []" unit=" orang" :colors="['#f4a672', '#ed6b23', '#0e7c42']" />
    </ChartCard>
  </ChartGrid>
  <SectionHead title="Data sumber" desc="Tabel dataset yang dipakai grafik di atas, dengan kolom sumber di sisi kanan." />
  <div class="space-y-2">
    <RawDataDisclosure v-for="(d, i) in TK_DATA_SUMBER" :key="d.slug" :slug="d.slug" :title="d.title" :count="jumlah?.[i] ?? 0" label="Lihat data" />
  </div>

  <SourceNote>
    Sumber: Satu Data Ekraf (Kemenekraf, olahan Sakernas BPS dan Kemenekraf) — satudata.ekraf.go.id; EKRAF Hub Kementerian Ekonomi Kreatif —
    hub.ekraf.go.id (pelaku terdaftar); Satu Data Jakarta — tenaga kerja pariwisata &amp; ekraf tersertifikasi (2023–2025).
  </SourceNote>
</template>
