<script setup lang="ts">
/**
 * Galeri sementara komponen layer shared (plan 10; dihapus di plan 17). Data contoh diambil dari
 * golden plan 01 (`app/kerangka/golden`, salinan `lakehouse/data-api/tests/golden`). Bagian chart
 * meniru /dashboard/pdrb-ekraf produksi supaya bisa dibandingkan berdampingan.
 */
import makro from "../../kerangka/golden/dashboard.pdrb-ekraf.makro.json";
import sebaran from "../../kerangka/golden/dashboard.pdrb-ekraf.subsektor.sebaran.2024.json";
import pertumbuhan from "../../kerangka/golden/dashboard.pdrb-ekraf.subsektor.pertumbuhan.2024.json";
import seniVenues from "../../kerangka/golden/seni-venues.json";
import type { ExportFormat } from "../../../layers/shared/composables/useSpreadsheetExport";

useHead({ title: "Kerangka komponen", meta: [{ name: "robots", content: "noindex" }] });

const rows = makro.data.rows;
const iFull = rows.findIndex((r) => r.periode === "2024");
const iLast = rows.length - 1;
const T = Object.fromEntries(makro.data.target_kontribusi.map((t) => [t.tahun, t.target_pct]));
const kvt = makro.data.kontribusi_vs_target;
const dist = sebaran.data.distribusi;
// Seperti PdrbEkrafStat: peta warna hanya untuk subsektor, "Lainnya" tetap abu-abu bawaan Donut.
const warnaDonut = Object.fromEntries(dist.filter((d) => d.nama !== "Lainnya").map((d) => [d.label, warnaSubsektor(d.nama)]));
const nilaiSub = sebaran.data.nilai_top10;
const tumbuhSub = pertumbuhan.data.items;

const periode = ref("2024");
// PointMap: venue seni berkoordinat, radius ∝ jumlah event.
const titikVenue = seniVenues
  .filter((v) => typeof v.lat === "number" && typeof v.lon === "number")
  .map((v) => ({ lat: v.lat as number, lng: v.lon as number, label: v.venue, value: v.eventCount }));

const { downloadSpreadsheet, dateStamp } = useSpreadsheetExport();
const ekspor = (format: ExportFormat) =>
  downloadSpreadsheet(
    `pdrb-ekraf-subsektor-${dateStamp()}`,
    nilaiSub,
    [
      { header: "No", value: (_r, i) => i + 1 },
      { header: "Subsektor", value: (r) => r.label },
      { header: "Nilai (Rp miliar)", value: (r) => r.value },
    ],
    format,
    "Subsektor",
  );
const pilihanPeriode = sebaran.data.periode_list.map((p) => ({ value: p, label: p === "S1 2025" ? "2025 (Sem I)" : p }));
</script>

<template>
  <main class="min-h-screen">
    <div class="mx-auto max-w-[1320px] px-6 py-8">
      <h1 class="atlas-display-md text-ink">Kerangka komponen</h1>
      <p class="apple-fine text-ink-muted-48">Halaman sementara plan 10 — data contoh dari golden plan 01.</p>

      <SectionHead title="KPI" desc="KpiRow + Kpi (dengan dan tanpa delta) + KpiStat." />
      <KpiRow>
        <Kpi label="Kontribusi 2024" :value="`${idNum(rows[iFull]!.kontribusi_pct, 2)}%`" :sub="`terhadap PDRB DKI · Sem I 2025: ${idNum(rows[iLast]!.kontribusi_pct, 2)}%`" />
        <Kpi label="Target RPJMD 2025" :value="`${idNum(T['2025']!, 2)}%`" :sub="`2029: ${idNum(T['2029']!, 2)}%`" />
        <Kpi label="Nilai PDRB Ekraf 2024" :value="`Rp ${idNum(rows[iFull]!.adhb_ekraf / 1000, 1)} T`" sub="atas dasar harga berlaku" />
        <Kpi label="Pertumbuhan 2024" :value="`${idNum(rows[iFull]!.tumbuh_ekraf_pct, 2)}%`" :delta="rows[iFull]!.tumbuh_ekraf_pct - rows[iFull - 1]!.tumbuh_ekraf_pct" sub="vs 2023" />
      </KpiRow>

      <SectionHead title="Kontribusi" desc="ComboBarLine satu sumbu (dualAxis=false)." />
      <ChartCard title="Capaian vs Target RPJMD 2025–2029" sub="Capaian = batang · Target RPJMD = garis">
        <ComboBarLine
          :categories="kvt.map((k) => k.label)"
          :bar="{ name: 'Capaian (%)', values: kvt.map((k) => k.capaian) }"
          :line="{ name: 'Target RPJMD (%)', values: kvt.map((k) => k.target) }"
          :dual-axis="false"
        />
        <p class="mt-2 apple-fine text-ink-muted-48">
          Data 2025 baru mencakup Semester I sehingga belum dapat dibandingkan langsung dengan target setahun penuh. Target RPJMD:
          {{ Object.entries(T).map(([y, v]) => `${y} ${idNum(v, 2)}%`).join(" · ") }}.
        </p>
      </ChartCard>

      <SectionHead title="Nilai" desc="VerticalBars dalam ChartGrid 2 kolom." />
      <ChartGrid :cols="2">
        <ChartCard title="PDRB Ekraf atas dasar harga berlaku (ADHB)" sub="Rp miliar">
          <VerticalBars :data="rows.map((r) => ({ label: r.label, value: r.adhb_ekraf }))" unit=" miliar" />
        </ChartCard>
        <ChartCard title="PDRB Ekraf atas dasar harga konstan (ADHK)" sub="Rp miliar · riil, tanpa efek harga">
          <VerticalBars :data="rows.map((r) => ({ label: r.label, value: r.adhk_ekraf }))" unit=" miliar" color="#0e7c42" />
        </ChartCard>
      </ChartGrid>

      <div class="mt-8 mb-3 flex flex-wrap items-center gap-2">
        <h2 class="mr-3 text-[18px] font-bold tracking-tight text-ink">Sebaran</h2>
        <ModeToggle v-model="periode" :options="pilihanPeriode" />
      </div>
      <ChartGrid :cols="2">
        <ChartCard title="Distribusi per subsektor · 2024" sub="% terhadap total PDRB Ekraf (ADHB) · 5 terbesar + lainnya">
          <Donut show-percent :data="dist.map((d) => ({ label: d.label, value: d.pct }))" :color-map="warnaDonut" />
        </ChartCard>
        <ChartCard title="10 subsektor dengan nilai terbesar · 2024" sub="Rp miliar (ADHB)">
          <BarBreakdown :data="nilaiSub" unit=" miliar" :colors="nilaiSub.map((d) => warnaSubsektor(d.label))" />
        </ChartCard>
      </ChartGrid>

      <SectionHead title="Pertumbuhan" desc="GroupedLines + BarBreakdown nilai negatif." />
      <ChartGrid :cols="2">
        <ChartCard title="Pertumbuhan Ekraf vs Non-Ekraf vs DKI" sub="% yoy (ADHK)">
          <GroupedLines
            :series="[
              { name: 'PDRB Ekraf', data: rows.map((r) => ({ label: r.label, value: r.tumbuh_ekraf_pct })) },
              { name: 'PDRB Non-Ekraf', data: rows.map((r) => ({ label: r.label, value: r.tumbuh_non_ekraf_pct })) },
              { name: 'PDRB DKI', data: rows.map((r) => ({ label: r.label, value: r.tumbuh_dki_pct })) },
            ]"
          />
        </ChartCard>
        <ChartCard title="Pertumbuhan per subsektor · 2024" sub="% yoy (ADHK)">
          <BarBreakdown :data="tumbuhSub" unit="%" :colors="tumbuhSub.map((d) => warnaSubsektor(d.label))" />
        </ChartCard>
      </ChartGrid>

      <SectionHead title="Chart lain" desc="LineTrend, GroupedBars, Treemap, BarChart, RankedList, KpiStat." />
      <ChartGrid>
        <ChartCard title="LineTrend" sub="ADHB per periode">
          <LineTrend :data="rows.map((r) => ({ label: r.periode, value: r.adhb_ekraf }))" unit="miliar" y-name="Rp miliar" />
        </ChartCard>
        <ChartCard title="GroupedBars" sub="Pertumbuhan Ekraf vs DKI">
          <GroupedBars
            :categories="rows.map((r) => r.label)"
            :series="[
              { name: 'Ekraf', data: rows.map((r) => ({ label: r.label, value: r.tumbuh_ekraf_pct })) },
              { name: 'DKI', data: rows.map((r) => ({ label: r.label, value: r.tumbuh_dki_pct })) },
            ]"
            unit="%"
          />
        </ChartCard>
        <ChartCard title="Treemap" sub="10 subsektor terbesar">
          <Treemap :data="nilaiSub" />
        </ChartCard>
        <ChartCard title="BarChart" sub="Kontribusi per periode">
          <BarChart :data="rows.map((r) => ({ label: r.periode, value: r.kontribusi_pct }))" />
        </ChartCard>
        <ChartCard title="RankedList" sub="10 subsektor terbesar">
          <RankedList :data="nilaiSub" unit=" M" />
        </ChartCard>
        <KpiStat label="KpiStat angka" :value="rows[iFull]!.adhb_ekraf" sub="toLocaleString id-ID" />
      </ChartGrid>

      <SectionHead title="Peta" desc="PointMap (OSM) — VenueMap ada di /_kerangka/pariwisata, SpatialMap di /_kerangka/spasial." />
      <PointMap :points="titikVenue" />
      <div class="mt-4">
        <PointMap :points="[]" />
      </div>

      <SectionHead title="Tabel & ekspor" desc="SdiTable dan RawDataDisclosure memanggil dataset/{slug}/halaman (rute Laravel plan 11; sebelum itu tampil keadaan error)." />
      <div class="mb-4 flex justify-end">
        <ExportButton label="Unduh" :on-export="ekspor" />
      </div>
      <RawDataDisclosure slug="data-event-pariwisata-dan-kebudayaan-dki-jakarta-2011-2019" title="Event Pariwisata & Kebudayaan 2011–2019" :count="1391" />

      <SectionHead title="Hero gelap" desc="HeroDark — dipakai PariwisataShell dan halaman katalog/indikator." />
      <HeroDark>
        <div class="text-[12px] font-mono uppercase tracking-widest text-white/60">Eyebrow</div>
        <h2 class="atlas-display text-white">Judul di atas hero gelap</h2>
      </HeroDark>
      <p class="mt-4 apple-caption">
        Halaman lain: <NuxtLink to="/_kerangka/pariwisata" class="underline">PariwisataShell + VenueMap</NuxtLink> ·
        <NuxtLink to="/_kerangka/spasial" class="underline">SpatialMap</NuxtLink>
      </p>

      <SourceNote>{{ makro.data.sumber }}</SourceNote>
    </div>
  </main>
</template>
