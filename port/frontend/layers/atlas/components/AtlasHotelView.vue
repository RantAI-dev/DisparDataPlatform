<script setup lang="ts">
/**
 * ATLAS — Hotel & Akomodasi (components/HotelView.tsx). Data resmi dari `atlas/hotel`; filter
 * wilayah/golongan, cari, dan unduh berjalan di klien.
 */
import type { AtlasHotel, AtlasHotelRow } from "../composables/useAtlas";
import type { ExportFormat } from "../../shared/composables/useSpreadsheetExport";

const props = defineProps<{ data: AtlasHotel }>();
const idfmt = (v: number, d = 0) => v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const wilayah = ref("All");
const golongan = ref("All");
const query = ref("");
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return props.data.registry
    .filter((h) => {
      if (wilayah.value !== "All" && h.wilayah !== wilayah.value) return false;
      if (golongan.value !== "All" && h.golongan !== golongan.value) return false;
      if (!q) return true;
      return [h.nama, h.alamat, h.wilayah, h.golongan].some((v) => v.toLowerCase().includes(q));
    })
    .sort((a, b) => b.kamar - a.kamar);
});
const filteredRooms = computed(() => filtered.value.reduce((a, h) => a + h.kamar, 0));
const { downloadSpreadsheet, dateStamp } = useSpreadsheetExport();
const exportHotel = (format: ExportFormat) =>
  downloadSpreadsheet<AtlasHotelRow>(
    `jakarta-atlas-hotel-${dateStamp()}`,
    filtered.value,
    [
      { header: "No", value: (_h, i) => i + 1 },
      { header: "Nama", value: (h) => h.nama },
      { header: "Jenis Usaha", value: (h) => h.jenis_usaha },
      { header: "Golongan", value: (h) => h.golongan },
      { header: "Jumlah Kamar", value: (h) => h.kamar },
      { header: "Wilayah", value: (h) => h.wilayah },
      { header: "Alamat", value: (h) => h.alamat },
    ],
    format,
    "Hotel",
  );
const KPI = computed(() => [
  { value: idfmt(props.data.kpi.hotels), label: "Hotel terdata", sub: "Rekapitulasi usaha & kamar" },
  { value: idfmt(props.data.kpi.rooms), label: "Total kamar", sub: null },
  { value: idfmt(props.data.kpi.occupancy_latest, 1) + "%", label: "Okupansi rata-rata (terbaru)", sub: fmtPeriode(props.data.kpi.occupancy_period) },
  { value: idfmt(props.data.kpi.los_latest, 2), label: "Lama menginap (malam)", sub: fmtPeriode(props.data.kpi.los_period) },
]);
</script>

<template>
  <main class="min-h-screen bg-canvas">
    <section class="bg-canvas">
      <div class="mx-auto max-w-[1280px] px-6 py-[64px] md:py-[88px]">
        <p class="apple-caption-strong text-ink-muted-80">Data resmi · GPCI CI-HR / CI-LH (kamar hotel &amp; hotel mewah)</p>
        <h1 class="apple-hero apple-title-tight mt-3 text-ink">Hotel &amp; <span class="text-ink-muted-48">Akomodasi</span></h1>
        <p class="apple-lead mt-5 max-w-[760px]">
          Pasokan kamar, okupansi (TPK), dan lama menginap hotel berbintang DKI Jakarta — seluruhnya dari <b>data resmi</b> Satu Data Jakarta /
          BPS, bukan scraping OTA.
        </p>
        <div class="mt-9 grid grid-cols-2 gap-y-8 md:grid-cols-4">
          <div v-for="k in KPI" :key="k.label">
            <div class="text-[34px] font-bold leading-none tabular text-ink">{{ k.value }}</div>
            <div class="mt-1.5 apple-caption text-ink-muted-80">{{ k.label }}</div>
            <div v-if="k.sub" class="apple-fine text-ink-muted-48">{{ k.sub }}</div>
          </div>
        </div>
      </div>
    </section>
    <section class="border-y border-hairline bg-parchment">
      <div class="mx-auto grid max-w-[1280px] gap-6 px-6 py-10 lg:grid-cols-2">
        <div class="utility-card bg-white p-5">
          <div class="mb-1 apple-caption-strong text-ink">Tingkat Penghunian Kamar (TPK)</div>
          <div class="apple-fine text-ink-muted-48">Okupansi bulanan per klasifikasi bintang · %</div>
          <AtlasMultiLine :periods="data.tpk_chart.periods" :series="data.tpk_chart.series" unit="%" y-name="Okupansi %" />
        </div>
        <div class="utility-card bg-white p-5">
          <div class="mb-1 apple-caption-strong text-ink">Rata-rata Lama Menginap</div>
          <div class="apple-fine text-ink-muted-48">Malam per bulan · Wisman vs Wisnus (rata-rata lintas bintang)</div>
          <AtlasMultiLine :periods="data.los_chart.periods" :series="data.los_chart.series" unit="malam" y-name="Malam" />
        </div>
      </div>
    </section>
    <section class="sticky top-[56px] z-10 frosted">
      <div class="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2 px-6 py-3">
        <div class="relative min-w-0 flex-1">
          <input
            v-model="query"
            placeholder="Cari nama hotel, alamat…"
            class="h-10 w-full rounded-lg border border-hairline bg-canvas pl-4 pr-16 text-[14px] placeholder:text-ink-muted-48 focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-ring)]"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 apple-caption tabular text-ink-muted-48">{{ filtered.length }}/{{ data.registry.length }}</span>
        </div>
        <select v-model="wilayah" class="h-9 appearance-none rounded-full border border-hairline bg-canvas pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink">
          <option v-for="w in ['All', ...data.filters.wilayah]" :key="w" :value="w">{{ w === "All" ? "Semua wilayah" : w }}</option>
        </select>
        <select v-model="golongan" class="h-9 appearance-none rounded-full border border-hairline bg-canvas pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink">
          <option v-for="g in ['All', ...data.filters.golongan]" :key="g" :value="g">{{ g === "All" ? "Semua golongan" : g }}</option>
        </select>
        <ExportButton :on-export="exportHotel" label="Unduh" />
      </div>
    </section>
    <section class="mx-auto max-w-[1280px] px-6 py-8">
      <div class="mb-3 apple-fine text-ink-muted-48">{{ idfmt(filtered.length) }} hotel · {{ idfmt(filteredRooms) }} kamar (sesuai filter)</div>
      <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-[13px]">
            <thead>
              <tr class="text-left text-[11px] uppercase tracking-wider text-white" style="background: #ed6b23">
                <th class="px-3 py-2.5 font-semibold">Hotel</th>
                <th class="px-3 py-2.5 font-semibold">Golongan</th>
                <th class="px-3 py-2.5 font-semibold text-right">Kamar</th>
                <th class="px-3 py-2.5 font-semibold">Wilayah</th>
                <th class="px-3 py-2.5 font-semibold">Alamat</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in filtered" :key="h.nama" class="border-t border-slate-100 hover:bg-slate-50">
                <td class="px-3 py-2 font-medium text-ink">{{ h.nama }}</td>
                <td class="px-3 py-2 text-slate-600">{{ h.golongan }}</td>
                <td class="px-3 py-2 text-right tabular-nums text-slate-700">{{ idfmt(h.kamar) }}</td>
                <td class="px-3 py-2 text-slate-600">{{ h.wilayah }}</td>
                <td class="px-3 py-2 text-slate-500">{{ h.alamat || "—" }}</td>
              </tr>
              <tr v-if="filtered.length === 0">
                <td colspan="5" class="px-4 py-12 text-center text-slate-400">Tidak ada hotel yang cocok dengan filter.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
    <footer class="border-t border-hairline px-6 py-6">
      <p class="atlas-mono mx-auto max-w-[1280px] text-ink-muted-48">
        SUMBER · SATU DATA JAKARTA / BPS — REKAPITULASI USAHA &amp; KAMAR HOTEL, TPK, RATA-RATA LAMA MENGINAP · DATA RESMI, TANPA SCRAPING OTA ·
        DIBANGUN {{ data.built }}
      </p>
    </footer>
  </main>
</template>
