<script setup lang="ts">
/**
 * Pertunjukan & Budaya (components/EventsView.tsx). Daftar utuh dari `atlas/pertunjukan`;
 * statistik per tahun dari `atlas/pertunjukan?tahun` (eventStats v2 di Data API). Filter,
 * cari, paging 200, dan ekspor di klien. Bahasa tetap bawaan (v2 tidak membaca `dpj.lang` di sini;
 * AtlasNav tanpa `view` tidak merender toggle).
 */
import type { ExportFormat } from "../../shared/composables/useSpreadsheetExport";

type Event = {
  id: string;
  organizer: string;
  name: string;
  date: string;
  venue: string;
  type: string;
  visitors: string;
  visitors_needs_verify: boolean;
  note: string;
  category: string;
  source: string;
};
type Data = { items: Event[]; stats: { total: number; konser: number; festival: number; budaya: number }; categories: string[] };

const props = defineProps<{ data: Data }>();
const { pertunjukan } = useAtlas();
const PAGE = 200;
const YEAR_FILTERS = ["Semua", "2025", "2026"] as const;
const cat = ref("Semua");
const year = ref<(typeof YEAR_FILTERS)[number]>("Semua");
const q = ref("");
const visible = ref(PAGE);
const statsTahun = ref<Data["stats"] | null>(null);
watch(year, async (y) => {
  statsTahun.value = null;
  if (y !== "Semua") statsTahun.value = (await pertunjukan(y)).stats;
});
const stats = computed(() => (year.value === "Semua" ? props.data.stats : statsTahun.value ?? props.data.stats));
const eventYear = (e: Event) => /(20\d{2})/.exec(e.date)?.[1] ?? "";
const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase();
  return props.data.items.filter((e) => {
    if (year.value !== "Semua" && eventYear(e) !== year.value) return false;
    if (cat.value !== "Semua" && e.category !== cat.value) return false;
    return !needle || `${e.name} ${e.organizer} ${e.venue} ${e.type} ${e.date} ${e.note}`.toLowerCase().includes(needle);
  });
});
watch([cat, year, q], () => (visible.value = PAGE));
const paged = computed(() => filtered.value.slice(0, visible.value));

const { downloadSpreadsheet, dateStamp } = useSpreadsheetExport();
async function exportEvents(format: ExportFormat) {
  if (filtered.value.length === 0) {
    alert("Tidak ada data untuk diekspor — coba longgarkan filter.");
    return;
  }
  const yearTag = year.value === "Semua" ? "2025-2026" : year.value;
  await downloadSpreadsheet<Event>(
    `data-pertunjukan-GCI-jakarta-${yearTag}-${dateStamp()}`,
    filtered.value,
    [
      { header: "No.", value: (_e, i) => i + 1 },
      { header: "Nama Penyelenggara - Organizer", value: (e) => e.organizer },
      { header: "Nama Pertunjukan - Name of Performance", value: (e) => e.name },
      { header: "Tanggal Pertunjukan - Date of Performance", value: (e) => e.date },
      { header: "Tempat Pertunjukan - Place of Performance", value: (e) => e.venue },
      { header: "Jenis Pertunjukan - Type of Performance", value: (e) => e.type },
      { header: "Jumlah Pengunjung - Number of Visitor", value: (e) => e.visitors },
      { header: "Keterangan - Notes", value: (e) => e.note },
      { header: "Sumber", value: (e) => e.source },
    ],
    format,
    `Pertunjukan GCI ${yearTag}`,
  );
}
const TH = "px-3 py-2.5 atlas-mono text-ink-muted-48 font-medium whitespace-nowrap";
const pil = (aktif: boolean) => `press-scale rounded-full px-3 py-1 apple-caption whitespace-nowrap ${aktif ? "bg-[color:var(--accent)] text-white" : "text-ink-muted-80 hover:text-ink"}`;
</script>

<template>
  <main data-section="gci" class="min-h-screen flex flex-col bg-paper">
    <section class="border-b border-hairline bg-paper">
      <div class="mx-auto max-w-[1320px] px-6 py-10 md:py-14">
        <div class="flex items-center gap-3">
          <span class="atlas-mono text-ink-muted-48">GLOBAL CITY INDEX · DISPAREKRAF DKI</span>
          <span class="flex-1 border-t border-hairline" />
          <span class="atlas-coord">TAHUN 2025–2026</span>
        </div>
        <div class="mt-6 grid md:grid-cols-12 gap-8 items-end">
          <div class="md:col-span-7">
            <h1 class="atlas-display text-ink">Pertunjukan &amp; <span class="atlas-italic text-[color:var(--accent)]">Budaya</span></h1>
            <p class="apple-body mt-4 text-ink-muted-80 max-w-[62ch]">
              Inventarisasi pertunjukan musik internasional &amp; nasional serta acara budaya besar di Jakarta sepanjang 2025–2026 — konser,
              festival, seni tari, teater, orkestra, seni rupa, dan film — untuk Global City Index.
            </p>
          </div>
          <dl class="md:col-span-5 grid grid-cols-4 gap-x-4 gap-y-1 md:border-l md:border-hairline md:pl-6">
            <div v-for="[l, v] in [['TOTAL', stats.total], ['KONSER', stats.konser], ['FESTIVAL', stats.festival], ['BUDAYA', stats.budaya]]" :key="l">
              <dt class="atlas-mono text-ink-muted-48">{{ l }}</dt>
              <dd class="atlas-display-md text-ink tabular mt-1">{{ v }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
    <section class="frosted border-b border-hairline sticky top-[56px] z-20">
      <div class="mx-auto max-w-[1320px] px-6 py-3 flex flex-wrap items-center gap-3">
        <span class="atlas-mono text-ink-muted-48">FILTER ·</span>
        <div class="inline-flex p-1 bg-canvas border border-hairline rounded-full">
          <button v-for="y in YEAR_FILTERS" :key="y" :class="pil(year === y)" @click="year = y">{{ y === "Semua" ? "Semua tahun" : y }}</button>
        </div>
        <div class="inline-flex p-1 bg-canvas border border-hairline rounded-full flex-wrap">
          <button v-for="k in ['Semua', ...data.categories]" :key="k" :class="pil(cat === k)" @click="cat = k">{{ k }}</button>
        </div>
        <input
          v-model="q"
          placeholder="Cari nama / penyelenggara / tempat…"
          class="bg-canvas border border-hairline rounded-full h-9 px-4 apple-caption text-ink placeholder:text-ink-muted-48 focus:outline-none focus:border-[color:var(--accent)] min-w-[220px]"
        />
        <span class="ml-auto atlas-mono text-ink-muted-48">{{ filtered.length }}/{{ data.items.length }} entri</span>
        <ExportButton :on-export="exportEvents" :label="`Ekspor Excel (${filtered.length})`" />
      </div>
    </section>
    <section class="flex-1">
      <div class="mx-auto max-w-[1320px] px-6 py-6">
        <div class="overflow-x-auto border border-hairline rounded-lg bg-canvas">
          <table class="w-full border-collapse text-left">
            <thead>
              <tr class="border-b border-hairline bg-paper">
                <th :class="`${TH} w-12 text-right pr-3`">No.</th>
                <th :class="TH">Nama Pertunjukan</th>
                <th :class="TH">Penyelenggara</th>
                <th :class="TH">Tanggal</th>
                <th :class="TH">Tempat</th>
                <th :class="TH">Jenis</th>
                <th :class="`${TH} text-right`">Jumlah Pengunjung</th>
                <th :class="TH">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(e, i) in paged" :key="e.id" class="border-b border-hairline last:border-0 hover:bg-paper transition-colors">
                <td class="px-3 py-3 text-right atlas-mono text-ink-muted-48 tabular align-top">{{ i + 1 }}</td>
                <td class="px-3 py-3 align-top max-w-[320px]">
                  <a v-if="e.source" :href="e.source" target="_blank" rel="noopener noreferrer" class="apple-body-strong text-ink hover:text-[color:var(--accent)]">{{
                    e.name
                  }}</a>
                  <span v-else class="apple-body-strong text-ink">{{ e.name }}</span>
                </td>
                <td class="px-3 py-3 align-top apple-caption text-ink-muted-80 max-w-[220px]">{{ e.organizer || "—" }}</td>
                <td class="px-3 py-3 align-top apple-caption text-ink-muted-80 whitespace-nowrap">{{ e.date }}</td>
                <td class="px-3 py-3 align-top apple-caption text-ink-muted-80 max-w-[240px]">{{ e.venue }}</td>
                <td class="px-3 py-3 align-top apple-caption text-ink-muted-80 max-w-[200px]">{{ e.type }}</td>
                <td class="px-3 py-3 align-top text-right atlas-mono tabular text-ink-muted-80 whitespace-nowrap">
                  <template v-if="e.visitors">{{ e.visitors }}<span v-if="e.visitors_needs_verify" title="Angka belum diverifikasi" class="text-[color:var(--accent)]"> *</span></template>
                  <template v-else>—</template>
                </td>
                <td class="px-3 py-3 align-top apple-fine text-ink-muted-48 max-w-[200px]">{{ e.note || "—" }}</td>
              </tr>
              <tr v-if="filtered.length === 0">
                <td colspan="8" class="px-3 py-12 text-center apple-caption text-ink-muted-48">Tidak ada entri yang cocok dengan filter.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="filtered.length > visible" class="mt-4 flex items-center justify-center gap-3">
          <button
            class="press-scale rounded-full border border-hairline bg-canvas px-5 py-2 apple-caption-strong text-ink hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] transition-colors"
            @click="visible += PAGE"
          >
            Muat {{ Math.min(PAGE, filtered.length - visible) }} lagi
          </button>
        </div>
        <p class="apple-caption text-ink-muted-48 mt-3 text-center">
          Menampilkan {{ paged.length }} dari {{ filtered.length }} entri terfilter. Angka bertanda <span class="text-[color:var(--accent)]">*</span> adalah
          kapasitas, perkiraan, atau target dan belum diverifikasi.
        </p>
      </div>
    </section>
    <footer class="border-t border-hairline bg-paper">
      <div class="mx-auto max-w-[1320px] px-6 py-5 atlas-fine text-ink-muted-48 flex flex-wrap items-center justify-between gap-2">
        <span>Sumber: berita, platform tiket, situs penyelenggara (link per baris). GCI — Disparekraf DKI Jakarta.</span>
        <span>{{ translate(DEFAULT_LANG, "footer.typeface") }}</span>
      </div>
    </footer>
  </main>
</template>
