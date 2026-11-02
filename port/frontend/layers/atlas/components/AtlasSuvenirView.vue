<script setup lang="ts">
/**
 * Toko suvenir (components/SouvenirView.tsx): hero, statistik, toolbar (cari, kartu/tabel, unduh,
 * filter wilayah/produk/relevansi, urutan), lalu kartu dengan pratinjau peta. Relevansi bawaan
 * "Toko suvenir" (Ya + Sebagian). Data dari `atlas/suvenir`.
 */
import type { ExportFormat } from "../../shared/composables/useSpreadsheetExport";

type Toko = {
  id: string;
  name: string;
  category: string;
  relevance: string;
  product: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  lat: number | null;
  lng: number | null;
  coord_source: string | null;
  phone: string | null;
  rating: number | null;
  reviews: number | null;
  status: string | null;
  note: string | null;
  url: string | null;
  maps_url: string;
  embed_url: string;
};
type Data = {
  items: Toko[];
  stats: { total: number; ya: number; sebagian: number; tidak: number; belum_pasti: number; avg_rating: number; geo: number };
  products: string[];
  cities: string[];
};
const props = defineProps<{ data: Data }>();

const RELEVANCE = ["Toko suvenir", "Suvenir murni", "Sebagian", "Semua"] as const;
const SORTS = [
  { id: "reviews", label: "Ulasan terbanyak" },
  { id: "rating", label: "Rating tertinggi" },
  { id: "name", label: "Nama A–Z" },
] as const;
const BADGE: Record<string, { text: string; cls: string; title: string }> = {
  Ya: { text: "SUVENIR", cls: "bg-primary/10 text-primary", title: "Toko suvenir/oleh-oleh/kerajinan" },
  Sebagian: { text: "SEBAGIAN", cls: "bg-[color:var(--accent)]/10 text-[color:var(--accent)]", title: "Pasar/mal — suvenir hanya sebagian dari isinya" },
  Tidak: { text: "NON-SUVENIR", cls: "bg-ink-muted-80/10 text-ink-muted-80", title: "Dikategorikan TripAdvisor sebagai gift shop, tapi bukan toko suvenir" },
};
const BELUM = { text: "BELUM TERVERIFIKASI", cls: "bg-ink-muted-80/10 text-ink-muted-80", title: "Relevansi belum terverifikasi" };
const badge = (s: Toko) => BADGE[s.relevance] ?? BELUM;

const query = ref("");
const city = ref("All");
const product = ref("All");
const relevance = ref<(typeof RELEVANCE)[number]>("Toko suvenir");
const sort = ref<(typeof SORTS)[number]["id"]>("reviews");
const viewMode = ref<"grid" | "table">("grid");

function cocok(s: Toko, f: (typeof RELEVANCE)[number]) {
  if (f === "Semua") return true;
  if (f === "Suvenir murni") return s.relevance === "Ya";
  if (f === "Sebagian") return s.relevance === "Sebagian";
  return s.relevance === "Ya" || s.relevance === "Sebagian";
}
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  const rows = props.data.items.filter((s) => {
    if (!cocok(s, relevance.value)) return false;
    if (city.value !== "All" && s.city !== city.value) return false;
    if (product.value !== "All" && s.product !== product.value) return false;
    if (!q) return true;
    return [s.name, s.product, s.address, s.district, s.city].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q));
  });
  return rows.sort((a, b) => {
    if (sort.value === "name") return a.name.localeCompare(b.name, "id");
    if (sort.value === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
    return (b.reviews ?? 0) - (a.reviews ?? 0);
  });
});
const productLabel = (s: Toko) => (s.product && s.product !== "?" ? s.product : s.category);
const formatReviews = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + "k" : n.toLocaleString("id-ID"));
const koma = (n: number, d: number) => n.toFixed(d).replace(".", ",");
const st = computed(() => props.data.stats);
const selects = computed(() => [
  { model: city, options: [{ id: "All", label: "Semua wilayah" }, ...props.data.cities.map((c) => ({ id: c, label: c }))] },
  { model: product, options: [{ id: "All", label: "Semua produk" }, ...props.data.products.map((p) => ({ id: p, label: p }))] },
]);

const { downloadSpreadsheet, dateStamp } = useSpreadsheetExport();
async function exportSouvenir(format: ExportFormat) {
  await downloadSpreadsheet<Toko>(
    `jakarta-atlas-suvenir-${dateStamp()}`,
    filtered.value,
    [
      { header: "No", value: (_s, i) => i + 1 },
      { header: "Nama", value: (s) => s.name },
      { header: "Kategori TripAdvisor", value: (s) => s.category },
      { header: "Relevan Suvenir", value: (s) => s.relevance },
      { header: "Produk Utama", value: (s) => s.product ?? "" },
      { header: "Alamat", value: (s) => s.address ?? "" },
      { header: "Kota Administrasi", value: (s) => s.city ?? "" },
      { header: "Kecamatan", value: (s) => s.district ?? "" },
      { header: "Lintang", value: (s) => s.lat ?? "" },
      { header: "Bujur", value: (s) => s.lng ?? "" },
      { header: "Sumber Koordinat", value: (s) => s.coord_source ?? "" },
      { header: "Telepon", value: (s) => s.phone ?? "" },
      { header: "Rating", value: (s) => s.rating ?? "" },
      { header: "Jumlah Ulasan", value: (s) => s.reviews ?? "" },
      { header: "Status", value: (s) => s.status ?? "" },
      { header: "Catatan", value: (s) => s.note ?? "" },
      { header: "URL TripAdvisor", value: (s) => s.url ?? "" },
    ],
    format,
    "Suvenir",
  );
}
</script>

<template>
  <main class="min-h-screen bg-canvas">
    <section class="bg-canvas">
      <div class="mx-auto max-w-[1280px] px-6 py-[80px] md:py-[120px] text-center">
        <p class="apple-caption-strong text-ink-muted-80">Data sekunder · Daya tarik belanja (GPCI CI-SH)</p>
        <h1 class="apple-hero apple-title-tight mt-3 text-ink">
          Toko suvenir Jakarta,<br />
          <span class="text-ink-muted-48">sudah disaring.</span>
        </h1>
        <p class="apple-lead mt-6 max-w-[760px] mx-auto">
          <span class="text-ink">{{ st.total }} listing</span> TripAdvisor kategori Shopping, ditandai satu per satu mana yang benar-benar toko suvenir
          — karena {{ st.tidak }} di antaranya ternyata money changer, service HP, dan toko elektronik.
        </p>
        <div class="mt-9 flex items-center justify-center gap-4">
          <a href="#directory" class="press-scale pill-primary">Lihat daftar</a>
        </div>
      </div>
    </section>
    <section class="bg-parchment border-y border-hairline">
      <div class="mx-auto max-w-[1280px] px-6 py-[64px] md:py-[80px] grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6 text-center">
        <div
          v-for="s in [
            { n: String(st.total), l: 'Listing terdata', small: '' },
            { n: String(st.ya), l: 'Toko suvenir murni', small: '' },
            { n: st.avg_rating ? koma(st.avg_rating, 2) : '—', l: 'Rating rata-rata', small: '/5' },
            { n: String(st.geo), l: 'Titik berkoordinat', small: '' },
          ]"
          :key="s.l"
        >
          <div class="apple-hero apple-title-tight text-ink tabular">
            {{ s.n }}<span v-if="s.small" class="apple-lead text-ink-muted-48"> {{ s.small }}</span>
          </div>
          <div class="apple-caption text-ink-muted-80 mt-1.5">{{ s.l }}</div>
        </div>
      </div>
    </section>
    <section id="filters" class="sticky top-[56px] z-10 frosted">
      <div class="mx-auto max-w-[1280px] px-6 py-3 space-y-3">
        <div class="flex items-center gap-2">
          <div class="relative flex-1 min-w-0">
            <svg viewBox="0 0 24 24" class="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted-48" aria-hidden="true">
              <path
                fill="currentColor"
                d="M10 18a8 8 0 1 1 5.293-1.707l4.207 4.207-1.414 1.414-4.207-4.207A7.96 7.96 0 0 1 10 18zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"
              />
            </svg>
            <input
              v-model="query"
              placeholder="Cari nama toko, produk, atau alamat…"
              class="w-full bg-canvas border border-hairline rounded-lg pl-11 pr-16 h-10 text-[14px] placeholder:text-ink-muted-48 focus:outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-ring)] transition-all"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 apple-caption tabular text-ink-muted-48">{{ filtered.length }}/{{ data.items.length }}</span>
          </div>
          <div class="inline-flex p-0.5 bg-canvas border border-hairline rounded-full">
            <button
              v-for="m in ['grid', 'table'] as const"
              :key="m"
              :class="`press-scale rounded-full px-3 py-1 apple-caption-strong ${viewMode === m ? 'bg-ink text-white' : 'text-ink-muted-80 hover:text-ink'}`"
              @click="viewMode = m"
            >
              {{ m === "grid" ? "Kartu" : "Tabel" }}
            </button>
          </div>
          <ExportButton :on-export="exportSouvenir" label="Unduh" />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div v-for="(s, i) in selects" :key="i" class="relative">
            <select
              v-model="s.model.value"
              class="appearance-none press-scale bg-canvas border border-hairline rounded-full h-9 pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink focus:outline-none focus:border-primary-focus transition-colors cursor-pointer max-w-[240px] truncate"
            >
              <option v-for="o in s.options" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
            <svg viewBox="0 0 24 24" class="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-muted-48 pointer-events-none" aria-hidden="true">
              <path fill="currentColor" d="M7 10l5 5 5-5z" />
            </svg>
          </div>
          <span class="hidden md:inline-block h-5 w-px bg-hairline mx-1" />
          <div class="inline-flex p-1 bg-canvas border border-hairline rounded-full">
            <button
              v-for="r in RELEVANCE"
              :key="r"
              :class="`press-scale rounded-full px-3 py-1 apple-caption ${relevance === r ? 'bg-primary text-white' : 'text-ink-muted-80 hover:text-ink'}`"
              @click="relevance = r"
            >
              {{ r }}
            </button>
          </div>
          <span class="hidden md:inline-block h-5 w-px bg-hairline mx-1" />
          <div class="relative">
            <select
              v-model="sort"
              class="appearance-none press-scale bg-canvas border border-hairline rounded-full h-9 pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink focus:outline-none focus:border-primary-focus transition-colors cursor-pointer max-w-[240px] truncate"
            >
              <option v-for="o in SORTS" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
            <svg viewBox="0 0 24 24" class="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-muted-48 pointer-events-none" aria-hidden="true">
              <path fill="currentColor" d="M7 10l5 5 5-5z" />
            </svg>
          </div>
        </div>
      </div>
    </section>
    <section id="directory" class="mx-auto max-w-[1280px] px-6 py-12">
      <div v-if="filtered.length === 0" class="text-center py-24">
        <p class="apple-tagline text-ink">Tidak ada toko yang cocok</p>
        <p class="apple-caption text-ink-muted-48 mt-2">Coba longgarkan filter atau kosongkan kolom pencarian.</p>
      </div>
      <ul v-else-if="viewMode === 'grid'" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <li v-for="s in filtered" :key="s.id" class="utility-card group bg-canvas border border-hairline rounded-apple_lg overflow-hidden flex flex-col">
          <a
            :href="s.maps_url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`Buka di Google Maps — ${s.name}`"
            class="relative block bg-parchment border-b border-hairline overflow-hidden group/map"
          >
            <div class="aspect-[16/9] w-full">
              <iframe
                :src="s.embed_url"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                class="w-full h-full pointer-events-none select-none"
                :title="`Peta — ${s.name}`"
                aria-hidden="true"
              />
            </div>
            <span
              class="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 bg-canvas/95 backdrop-blur border border-hairline rounded-full px-2.5 py-1 apple-fine text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)] opacity-0 group-hover/map:opacity-100 transition-opacity duration-200"
            >
              Buka peta
            </span>
          </a>
          <div class="p-6 flex flex-col flex-1">
            <div class="flex items-center justify-between gap-2">
              <p class="apple-caption-strong text-primary tracking-[0.06em] text-[11px] uppercase truncate">{{ productLabel(s) }}</p>
              <span :class="`shrink-0 apple-fine uppercase tracking-wider px-1.5 py-0.5 rounded ${badge(s).cls}`" :title="badge(s).title">{{ badge(s).text }}</span>
            </div>
            <h3 class="apple-tagline apple-title-tight text-ink mt-1.5 leading-[1.15]">{{ s.name }}</h3>
            <p class="apple-caption text-ink-muted-48 mt-1">{{ [s.district, s.city].filter(Boolean).join(" · ") }}</p>
            <p v-if="s.rating != null" class="apple-caption mt-4 flex items-center gap-1.5 text-ink">
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 text-[color:var(--accent)]" aria-hidden="true">
                <path fill="currentColor" d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9L12 3z" />
              </svg>
              <span class="apple-caption-strong tabular">{{ koma(s.rating, 1) }}</span>
              <span v-if="s.reviews != null && s.reviews > 0" class="text-ink-muted-48">· {{ formatReviews(s.reviews) }} ulasan · TripAdvisor</span>
            </p>
            <p v-if="s.address" class="apple-caption text-ink-muted-80 mt-3 line-clamp-2">{{ s.address }}</p>
            <p v-if="s.coord_source === 'Koreksi riset'" class="apple-fine text-ink-muted-48 mt-2 italic">Koordinat telah dikoreksi.</p>
            <div class="mt-auto pt-5 flex items-center justify-between gap-4">
              <a :href="s.maps_url" target="_blank" rel="noopener noreferrer" class="press-scale link-blue apple-caption-strong inline-flex items-center gap-1">
                Buka di Maps <span aria-hidden="true">↗</span>
              </a>
              <a
                v-if="s.url"
                :href="s.url"
                target="_blank"
                rel="noopener noreferrer"
                class="press-scale link-blue apple-caption inline-flex items-center gap-1"
                title="Halaman TripAdvisor"
              >
                Sumber <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </li>
      </ul>
      <div v-else class="overflow-x-auto border border-hairline rounded-apple_lg bg-canvas">
        <table class="w-full text-left border-collapse min-w-[820px]">
          <thead>
            <tr class="border-b border-hairline bg-parchment">
              <th v-for="h in ['Nama', 'Produk', 'Wilayah', 'Rating', 'Relevansi', '']" :key="h" class="apple-caption-strong text-ink-muted-80 px-4 py-3">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in filtered" :key="s.id" class="border-b border-hairline last:border-0">
              <td class="px-4 py-3 apple-caption-strong text-ink">{{ s.name }}</td>
              <td class="px-4 py-3 apple-caption text-ink-muted-80">{{ s.product && s.product !== "?" ? s.product : "—" }}</td>
              <td class="px-4 py-3 apple-caption text-ink-muted-80">{{ [s.district, s.city].filter(Boolean).join(" · ") || "—" }}</td>
              <td class="px-4 py-3 apple-caption tabular text-ink-muted-80">{{ s.rating != null ? `${koma(s.rating, 1)} (${s.reviews ?? 0})` : "—" }}</td>
              <td class="px-4 py-3">
                <span :class="`shrink-0 apple-fine uppercase tracking-wider px-1.5 py-0.5 rounded ${badge(s).cls}`" :title="badge(s).title">{{ badge(s).text }}</span>
              </td>
              <td class="px-4 py-3">
                <a :href="s.maps_url" target="_blank" rel="noopener noreferrer" class="press-scale link-blue apple-caption whitespace-nowrap">Maps ↗</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    <section id="sources" class="border-t border-hairline bg-parchment">
      <div class="mx-auto max-w-[1280px] px-6 py-12 grid md:grid-cols-2 gap-8">
        <div>
          <h2 class="apple-tagline text-ink">Cara data ini dikumpulkan</h2>
          <p class="apple-caption text-ink-muted-80 mt-3 max-w-[60ch]">
            Data berasal dari TripAdvisor (kategori Shopping, Jakarta) dan diverifikasi dengan sumber terbuka.
          </p>
        </div>
        <div>
          <h2 class="apple-tagline text-ink">Yang perlu diperhatikan</h2>
          <ul class="apple-caption text-ink-muted-80 mt-3 space-y-2 max-w-[60ch]">
            <li>
              · Pecahan {{ st.total }} listing: {{ st.ya }} toko suvenir murni, {{ st.sebagian }} pasar/mal yang hanya sebagian menjual suvenir,
              {{ st.tidak }} bukan toko suvenir sama sekali{{ st.belum_pasti > 0 ? `, dan ${st.belum_pasti} belum terverifikasi` : "" }}.
            </li>
            <li>· Rating dan ulasan adalah angka TripAdvisor, bukan Google — sampelnya kecil untuk toko-toko baru.</li>
          </ul>
        </div>
      </div>
    </section>
    <footer class="border-t border-hairline px-6 py-6">
      <p class="atlas-mono text-ink-muted-48 mx-auto max-w-[1280px]">SUMBER · TRIPADVISOR + VERIFIKASI SUMBER TERBUKA · DIPERBARUI 29 JULI 2026</p>
    </footer>
  </main>
</template>
