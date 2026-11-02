<script setup lang="ts">
/**
 * Restoran GCI (components/GciView.tsx). Daftar utuh dari `atlas/restoran-gci` (merge + dedup di
 * Data API); filter tier/kota/rating, cari, paging 200, dan ekspor di klien.
 */
import type { ExportFormat } from "../../shared/composables/useSpreadsheetExport";

type Resto = {
  id: string;
  name: string;
  cuisine: string;
  area: string;
  address: string | null;
  address_display: string;
  city: string;
  hotel: string | null;
  tier: string;
  rating: number | null;
  review_count: number | null;
  rating_source: string;
  price_level: string | null;
  price_source: string | null;
  needs_verify: boolean;
  maps_url: string;
};
type Data = { items: Resto[]; stats: { total: number; rated: number; hotel: number; cafe: number }; tiers: string[]; cities: string[] };
const props = defineProps<{ data: Data }>();

const PAGE = 200;
const SOURCE_FILTERS = ["Semua", "Ada rating", "Belum ada rating"] as const;
const tier = ref("Semua");
const city = ref("Semua");
const src = ref<(typeof SOURCE_FILTERS)[number]>("Semua");
const q = ref("");
const visible = ref(PAGE);
const exportRatedOnly = ref(true);
const fmtRating = (r: number | null) => (r == null ? "—" : r.toFixed(1).replace(".", ","));

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase();
  return props.data.items.filter((r) => {
    if (tier.value !== "Semua" && r.tier !== tier.value) return false;
    if (city.value !== "Semua" && r.city !== city.value) return false;
    if (src.value === "Ada rating" && r.rating == null) return false;
    if (src.value === "Belum ada rating" && r.rating != null) return false;
    return !needle || `${r.name} ${r.cuisine} ${r.area} ${r.address ?? ""} ${r.hotel ?? ""}`.toLowerCase().includes(needle);
  });
});
watch([tier, city, src, q], () => (visible.value = PAGE));
const paged = computed(() => filtered.value.slice(0, visible.value));
const exportRows = computed(() => (exportRatedOnly.value ? filtered.value.filter((r) => r.rating != null) : filtered.value));

const { downloadSpreadsheet, dateStamp } = useSpreadsheetExport();
async function exportGci(format: ExportFormat) {
  if (exportRows.value.length === 0) {
    alert("Tidak ada data untuk diekspor — coba longgarkan filter.");
    return;
  }
  await downloadSpreadsheet<Resto>(
    `data-restoran-GCI-${dateStamp()}`,
    exportRows.value,
    [
      { header: "No.", value: (_r, i) => i + 1 },
      { header: "Nama", value: (r) => r.name },
      { header: "Jenis Cuisine", value: (r) => r.cuisine },
      { header: "Alamat", value: (r) => r.address_display },
      { header: "Rating", value: (r) => (r.rating != null ? fmtRating(r.rating) : "") },
      { header: "Jumlah Ulasan", value: (r) => r.review_count ?? "" },
      { header: "Sumber Rating", value: (r) => r.rating_source },
      { header: "Area", value: (r) => r.area },
      { header: "Tingkat Harga", value: (r) => (r.price_level ? (r.price_source === "editorial" ? `${r.price_level} (perkiraan)` : r.price_level) : "") },
      { header: "Tier", value: (r) => r.tier },
      { header: "Hotel", value: (r) => r.hotel ?? "" },
      { header: "Catatan", value: (r) => (r.needs_verify ? "Angka belum diverifikasi" : "") },
      { header: "Google Maps", value: (r) => r.maps_url },
    ],
    format,
    "Restoran GCI",
  );
}
/** components/GciView.tsx TIER_STYLE */
const TIER_STYLE: Record<string, string> = {
  "Hotel ★5": "bg-[rgba(26,58,90,0.10)] text-[#1A3A5A]",
  "Hotel ★4": "bg-[rgba(14,124,66,0.10)] text-[color:var(--accent-deep)]",
  "Hotel ★3": "bg-[rgba(200,161,75,0.16)] text-[#8a6d23]",
  Restoran: "bg-[rgba(15,23,42,0.06)] text-ink-muted-80",
  Cafe: "bg-[rgba(139,90,43,0.12)] text-[#8B5A2B]",
};
const TH = "px-3 py-2.5 atlas-mono text-ink-muted-48 font-medium whitespace-nowrap";
const SEL = "appearance-none press-scale bg-canvas border border-hairline rounded-full h-9 pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink focus:outline-none cursor-pointer";
const pil = (aktif: boolean) => `press-scale rounded-full px-3 py-1 apple-caption whitespace-nowrap ${aktif ? "bg-[color:var(--accent)] text-white" : "text-ink-muted-80 hover:text-ink"}`;
</script>

<template>
  <main data-section="gci" class="min-h-screen flex flex-col bg-paper">
    <section class="border-b border-hairline bg-paper">
      <div class="mx-auto max-w-[1320px] px-6 py-10 md:py-14">
        <div class="flex items-center gap-3">
          <span class="atlas-mono text-ink-muted-48">GLOBAL CITY INDEX · DISPAREKRAF DKI</span>
          <span class="flex-1 border-t border-hairline" />
          <span class="atlas-coord">SENIN · 22 JUNI 2026 · 16.00 WIB</span>
        </div>
        <div class="mt-6 grid md:grid-cols-12 gap-8 items-end">
          <div class="md:col-span-7">
            <h1 class="atlas-display text-ink">Restoran <span class="atlas-italic text-[color:var(--accent)]">GCI</span></h1>
            <p class="apple-body mt-4 text-ink-muted-80 max-w-[60ch]">
              Inventarisasi seluruh restoran &amp; cafe di Jakarta beserta keberagaman kuliner internasional — termasuk restoran hotel bintang 3
              &amp; 4 — untuk Global City Index.
            </p>
          </div>
          <dl class="md:col-span-5 grid grid-cols-4 gap-x-4 gap-y-1 md:border-l md:border-hairline md:pl-6">
            <div v-for="[l, v] in [['TOTAL', data.stats.total], ['ADA RATING', data.stats.rated], ['HOTEL', data.stats.hotel], ['CAFE', data.stats.cafe]]" :key="l">
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
        <div class="inline-flex p-1 bg-canvas border border-hairline rounded-full flex-wrap">
          <button v-for="k in ['Semua', ...data.tiers]" :key="k" :class="pil(tier === k)" @click="tier = k">{{ k }}</button>
        </div>
        <select v-model="city" :class="SEL">
          <option v-for="c in ['Semua', ...data.cities]" :key="c" :value="c">{{ c }}</option>
        </select>
        <select v-model="src" :class="SEL">
          <option v-for="s in SOURCE_FILTERS" :key="s" :value="s">{{ s === "Semua" ? "Semua (rating)" : s }}</option>
        </select>
        <input
          v-model="q"
          placeholder="Cari nama / kuliner / area…"
          class="bg-canvas border border-hairline rounded-full h-9 px-4 apple-caption text-ink placeholder:text-ink-muted-48 focus:outline-none focus:border-[color:var(--accent)] min-w-[200px]"
        />
        <span class="ml-auto atlas-mono text-ink-muted-48">{{ filtered.length }}/{{ data.items.length }} entri</span>
        <label
          class="flex items-center gap-1.5 apple-caption text-ink-muted-80 cursor-pointer select-none"
          title="Saat ekspor, hanya sertakan venue yang punya rating (tanpa sel kosong)"
        >
          <input v-model="exportRatedOnly" type="checkbox" class="accent-[color:var(--accent)] h-3.5 w-3.5" />
          hanya ber-rating
        </label>
        <ExportButton :on-export="exportGci" :label="`Ekspor Excel (${exportRows.length})`" />
      </div>
    </section>
    <section class="flex-1">
      <div class="mx-auto max-w-[1320px] px-6 py-6">
        <div class="overflow-x-auto border border-hairline rounded-lg bg-canvas">
          <table class="w-full border-collapse text-left">
            <thead>
              <tr class="border-b border-hairline bg-paper">
                <th :class="`${TH} w-12 text-right pr-3`">No.</th>
                <th :class="TH">Nama</th>
                <th :class="TH">Jenis Cuisine</th>
                <th :class="TH">Alamat</th>
                <th :class="`${TH} text-center`">Harga</th>
                <th :class="`${TH} text-right`">Rating</th>
                <th :class="`${TH} text-right`">Jumlah Ulasan</th>
                <th :class="TH">Sumber</th>
                <th :class="TH">Tier</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in paged" :key="r.id" class="border-b border-hairline last:border-0 hover:bg-paper transition-colors">
                <td class="px-3 py-3 text-right atlas-mono text-ink-muted-48 tabular align-top">{{ i + 1 }}</td>
                <td class="px-3 py-3 align-top">
                  <a :href="r.maps_url" target="_blank" rel="noopener noreferrer" class="apple-body-strong text-ink hover:text-[color:var(--accent)]">{{ r.name }}</a>
                  <div v-if="r.hotel" class="apple-fine text-ink-muted-48 mt-0.5">{{ r.hotel }}</div>
                </td>
                <td class="px-3 py-3 align-top apple-caption text-ink-muted-80">{{ r.cuisine }}</td>
                <td class="px-3 py-3 align-top apple-caption text-ink-muted-80 max-w-[280px]">{{ r.address_display }}</td>
                <td class="px-3 py-3 align-top text-center atlas-mono tabular text-ink-muted-80">
                  {{ r.price_level ?? "—"
                  }}<span
                    v-if="r.price_level && r.price_source === 'editorial'"
                    title="Perkiraan editorial — Google tidak punya data harga untuk venue ini"
                    class="text-[color:var(--accent)]"
                  > *</span>
                </td>
                <td class="px-3 py-3 align-top text-right atlas-mono tabular text-ink">
                  {{ fmtRating(r.rating) }}<span v-if="r.needs_verify" title="Angka belum diverifikasi" class="text-[color:var(--accent)]"> *</span>
                </td>
                <td class="px-3 py-3 align-top text-right atlas-mono tabular text-ink-muted-80">{{ r.review_count?.toLocaleString("id-ID") ?? "—" }}</td>
                <td class="px-3 py-3 align-top apple-caption text-ink-muted-80">{{ r.rating_source }}</td>
                <td class="px-3 py-3 align-top">
                  <span :class="`inline-block rounded-full px-2.5 py-1 apple-fine whitespace-nowrap ${TIER_STYLE[r.tier]}`">{{ r.tier }}</span>
                </td>
              </tr>
              <tr v-if="filtered.length === 0">
                <td colspan="9" class="px-3 py-12 text-center apple-caption text-ink-muted-48">Tidak ada entri yang cocok dengan filter.</td>
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
          <button class="press-scale apple-caption text-ink-muted-80 hover:text-[color:var(--accent)]" @click="visible = filtered.length">
            Tampilkan semua ({{ filtered.length }})
          </button>
        </div>
        <p class="apple-caption text-ink-muted-48 mt-3 text-center">
          Menampilkan {{ paged.length }} dari {{ filtered.length }} entri terfilter. Ekspor selalu mengikutkan seluruh {{ filtered.length }} entri hasil
          filter.
        </p>
      </div>
    </section>
    <footer class="border-t border-hairline bg-paper">
      <div class="mx-auto max-w-[1320px] px-6 py-5 atlas-fine text-ink-muted-48 flex flex-wrap items-center justify-between gap-2">
        <span>Sumber: Wanderlog, TripAdvisor, situs hotel resmi (data Google). GCI — Disparekraf DKI Jakarta.</span>
        <span>{{ translate(DEFAULT_LANG, "footer.typeface") }}</span>
      </div>
    </footer>
  </main>
</template>
