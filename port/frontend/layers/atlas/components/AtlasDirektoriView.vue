<script setup lang="ts">
/**
 * Direktori restoran (components/Dashboard.tsx) dengan tombol ID/EN (`dpj.lang`) dan mode
 * kartu/baris (`dpj.view`). [P2] Tombol "Verifikasi sumber" dan tautan `/api/restaurants` +
 * `/api/refresh` tidak di-port: keduanya memanggil endpoint yang tidak ada.
 */
import type { ExportFormat } from "../../shared/composables/useSpreadsheetExport";

type Resto = {
  id: string;
  name: string;
  cuisine: string;
  category: string;
  area: string;
  city: string;
  address: string | null;
  price_range: "$" | "$$" | "$$$" | "$$$$" | null;
  price_note: string | null;
  rating: number | null;
  review_count: number | null;
  rating_source: string | null;
  highlights: string[];
  description: string | null;
  sources: { label: string; url: string }[];
  source: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  maps_url: string;
  embed_url: string;
};
type Data = { items: Resto[]; stats: { total: number; cuisines: number; rated: number; avg_rating: number }; cities: string[]; cuisines: string[] };
const props = defineProps<{ data: Data }>();

const CATEGORIES = ["All", "Food", "Beverage", "Food & Beverage"] as const;
const SORT_KEYS = [
  { id: "rating", tKey: "toolbar.sort.rating" },
  { id: "reviews", tKey: "toolbar.sort.reviews" },
  { id: "name", tKey: "toolbar.sort.name" },
] as const;

const { lang, t, toggle } = useLang();
const query = ref("");
const cuisine = ref("All");
const city = ref("All");
const category = ref<(typeof CATEGORIES)[number]>("All");
const sort = ref<(typeof SORT_KEYS)[number]["id"]>("rating");
const viewMode = ref<"cards" | "rows">("cards");
onMounted(() => {
  try {
    const v = window.localStorage.getItem("dpj.view");
    if (v === "cards" || v === "rows") viewMode.value = v;
  } catch {}
});
function setViewMode(v: "cards" | "rows") {
  viewMode.value = v;
  try {
    window.localStorage.setItem("dpj.view", v);
  } catch {}
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = props.data.items.filter((r) => {
    if (cuisine.value !== "All" && r.cuisine !== cuisine.value) return false;
    if (city.value !== "All" && r.city !== city.value) return false;
    if (category.value !== "All" && r.category !== category.value) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.cuisine.toLowerCase().includes(q) ||
      r.area.toLowerCase().includes(q) ||
      (r.address?.toLowerCase().includes(q) ?? false) ||
      r.highlights.some((h) => h.toLowerCase().includes(q)) ||
      (r.description?.toLowerCase().includes(q) ?? false)
    );
  });
  const sorted = [...list];
  if (sort.value === "rating") sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  else if (sort.value === "reviews") sorted.sort((a, b) => (b.review_count ?? -1) - (a.review_count ?? -1));
  else sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
});
const st = computed(() => props.data.stats);
const catLabel = (c: string) =>
  c === "All" ? t("toolbar.cat.all") : c === "Food" ? t("toolbar.cat.food") : c === "Beverage" ? t("toolbar.cat.beverage") : t("toolbar.cat.both");
function formatReviews(n: number) {
  if (n >= 10000) return Math.round(n / 1000) + "k";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString("en-US");
}
const sumberLabel = (r: Resto) => (r.source === "curated" ? t("card.source_curated") : t("card.source_osm"));
const SEL =
  "appearance-none press-scale bg-canvas border border-hairline rounded-full h-9 pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink focus:outline-none focus:border-primary-focus transition-colors cursor-pointer";
const seg = (aktif: boolean) => `press-scale rounded-full px-3.5 py-1.5 apple-caption ${aktif ? "bg-primary text-white" : "text-ink-muted-80 hover:text-ink"}`;
const vt = (aktif: boolean) =>
  `press-scale rounded-full px-3 py-1.5 apple-caption-strong inline-flex items-center gap-1.5 ${aktif ? "bg-ink text-white" : "text-ink-muted-80 hover:text-ink"}`;

const { downloadSpreadsheet, dateStamp } = useSpreadsheetExport();
async function exportRestaurants(format: ExportFormat) {
  if (filtered.value.length === 0) {
    alert(t("export.empty_rows"));
    return;
  }
  await downloadSpreadsheet<Resto>(
    `jakarta-atlas-restoran-${dateStamp()}`,
    filtered.value,
    [
      { header: "No", value: (_r, i) => i + 1 },
      { header: "Nama", value: (r) => r.name },
      { header: "Kuliner", value: (r) => r.cuisine },
      { header: "Kategori", value: (r) => r.category },
      { header: "Kota", value: (r) => r.city },
      { header: "Area", value: (r) => r.area },
      { header: "Alamat", value: (r) => r.address ?? "" },
      { header: "Rating", value: (r) => r.rating ?? "" },
      { header: "Jumlah Ulasan", value: (r) => r.review_count ?? "" },
      { header: "Sumber Rating", value: (r) => r.rating_source ?? "" },
      { header: "Tier Harga", value: (r) => r.price_range ?? "" },
      { header: "Catatan Harga", value: (r) => r.price_note ?? "" },
      { header: "Highlights", value: (r) => r.highlights.join(" · ") },
      { header: "Deskripsi", value: (r) => r.description ?? "" },
      { header: "Tipe Data", value: (r) => r.source },
      { header: "Lat", value: (r) => r.lat ?? "" },
      { header: "Lng", value: (r) => r.lng ?? "" },
      { header: "Telepon", value: (r) => r.phone ?? "" },
      { header: "Website", value: (r) => r.website ?? "" },
      { header: "Google Maps", value: (r) => r.maps_url },
      { header: "Sumber", value: (r) => r.sources.map((s) => `${s.label} <${s.url}>`).join(" | ") },
    ],
    format,
    "Restoran",
  );
}
const STAR = "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z";
const CHEV = "M7 10l5 5 5-5z";
</script>

<template>
  <main class="min-h-screen bg-canvas">
    <AtlasToolbar view="list">
      <template #lang><LangToggle :lang="lang" :t="t" @toggle="toggle" /></template>
    </AtlasToolbar>
    <section class="bg-canvas">
      <div class="mx-auto max-w-[1280px] px-6 py-[80px] md:py-[120px] text-center">
        <p class="apple-caption-strong text-ink-muted-80 appear" style="animation-delay: 0ms">{{ t("hero.eyebrow") }}</p>
        <h1 class="apple-hero apple-title-tight mt-3 text-ink appear" style="animation-delay: 80ms">
          {{ t("hero.title_a") }}<br />
          <span class="text-ink-muted-48">{{ t("hero.title_b") }}</span>
        </h1>
        <p class="apple-lead mt-6 max-w-[760px] mx-auto appear" style="animation-delay: 160ms">
          {{ t("hero.lead_prefix") }} <span class="text-ink">{{ t("hero.lead_count", { n: st.total }) }}</span> {{ t("hero.lead_suffix") }}
        </p>
        <div class="mt-9 flex items-center justify-center gap-4 appear" style="animation-delay: 240ms">
          <a href="#directory" class="press-scale pill-primary">{{ t("hero.cta_browse") }}</a>
          <a href="#sources" class="press-scale pill-secondary">{{ t("hero.cta_how") }}</a>
        </div>
      </div>
    </section>
    <section class="bg-parchment border-y border-hairline">
      <div class="mx-auto max-w-[1280px] px-6 py-[64px] md:py-[80px] grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6 text-center">
        <div
          v-for="s in [
            { n: String(st.total), l: t('stat.establishments'), small: '' },
            { n: String(st.cuisines), l: t('stat.cuisines'), small: '' },
            { n: st.avg_rating ? st.avg_rating.toFixed(2) : '—', l: t('stat.avg_rating'), small: '/5' },
            { n: String(st.rated), l: t('stat.rated_count'), small: '' },
          ]"
          :key="s.l"
        >
          <div class="apple-hero apple-title-tight text-ink tabular">
            {{ s.n }}<span v-if="s.small" class="text-ink-muted-48 text-[0.4em] align-middle ml-1">{{ s.small }}</span>
          </div>
          <p class="apple-caption text-ink-muted-80 mt-1">{{ s.l }}</p>
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
              :placeholder="t('toolbar.search_placeholder')"
              class="w-full bg-canvas border border-hairline rounded-lg pl-11 pr-16 h-10 text-[14px] placeholder:text-ink-muted-48 focus:outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-ring)] transition-all"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 apple-caption tabular text-ink-muted-48">{{ filtered.length }}/{{ data.items.length }}</span>
          </div>
          <div class="inline-flex p-0.5 bg-canvas border border-hairline rounded-full" role="radiogroup" aria-label="View mode">
            <button role="radio" :aria-checked="viewMode === 'cards'" :class="vt(viewMode === 'cards')" @click="setViewMode('cards')">
              <svg viewBox="0 0 16 16" class="h-3.5 w-3.5" aria-hidden="true">
                <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
                <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
                <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
                <rect x="9" y="9" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" />
              </svg>
              <span class="hidden sm:inline">{{ t("view.cards") }}</span>
            </button>
            <button role="radio" :aria-checked="viewMode === 'rows'" :class="vt(viewMode === 'rows')" @click="setViewMode('rows')">
              <svg viewBox="0 0 16 16" class="h-3.5 w-3.5" aria-hidden="true">
                <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
              <span class="hidden sm:inline">{{ t("view.rows") }}</span>
            </button>
          </div>
          <ExportButton :on-export="exportRestaurants" :label="t('export.csv')" />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative">
            <select v-model="city" :class="SEL">
              <option v-for="c in ['All', ...data.cities]" :key="c" :value="c">{{ c === "All" ? t("toolbar.city_all") : t(`city.${c}`) }}</option>
            </select>
            <svg viewBox="0 0 24 24" class="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-muted-48 pointer-events-none" aria-hidden="true">
              <path fill="currentColor" :d="CHEV" />
            </svg>
          </div>
          <div class="relative">
            <select v-model="cuisine" :class="SEL">
              <option v-for="c in ['All', ...data.cuisines]" :key="c" :value="c">{{ c === "All" ? t("toolbar.cuisine_all") : c }}</option>
            </select>
            <svg viewBox="0 0 24 24" class="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-muted-48 pointer-events-none" aria-hidden="true">
              <path fill="currentColor" :d="CHEV" />
            </svg>
          </div>
          <span class="hidden md:inline-block h-5 w-px bg-hairline mx-1" />
          <div class="inline-flex p-1 bg-canvas border border-hairline rounded-full">
            <button v-for="c in CATEGORIES" :key="c" :class="seg(category === c)" @click="category = c">{{ catLabel(c) }}</button>
          </div>
          <span class="hidden md:inline-block h-5 w-px bg-hairline mx-1" />
          <div class="inline-flex p-1 bg-canvas border border-hairline rounded-full">
            <button v-for="s in SORT_KEYS" :key="s.id" :class="seg(sort === s.id)" @click="sort = s.id">{{ t(s.tKey) }}</button>
          </div>
        </div>
      </div>
    </section>
    <section id="directory" class="bg-canvas">
      <div class="mx-auto max-w-[1280px] px-6 py-10 md:py-14">
        <div v-if="filtered.length === 0" class="py-24 text-center">
          <p class="apple-display-lg text-ink">{{ t("empty.title") }}</p>
          <p class="apple-lead mt-3 text-ink-muted-48">
            {{ t("empty.hint") }} <span class="text-primary">Senopati</span>, <span class="text-primary">Menteng</span>,
            <span class="text-primary">SCBD</span>.
          </p>
        </div>
        <ul v-else-if="viewMode === 'cards'" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="r in filtered" :key="r.id" class="utility-card group bg-canvas border border-hairline rounded-apple_lg overflow-hidden flex flex-col">
            <a
              :href="r.maps_url"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="`${t('card.open_maps')} — ${r.name}`"
              class="relative block bg-parchment border-b border-hairline overflow-hidden group/map"
            >
              <div class="aspect-[16/9] w-full">
                <iframe
                  :src="r.embed_url"
                  loading="lazy"
                  referrerpolicy="no-referrer-when-downgrade"
                  class="w-full h-full pointer-events-none select-none"
                  :title="`Map — ${r.name}`"
                  aria-hidden="true"
                />
              </div>
              <span
                class="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 bg-canvas/95 backdrop-blur border border-hairline rounded-full px-2.5 py-1 apple-fine text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)] opacity-0 group-hover/map:opacity-100 transition-opacity duration-200"
              >
                {{ t("card.open_chip") }}
              </span>
            </a>
            <div class="p-6 flex flex-col flex-1">
              <div class="flex items-center justify-between gap-2">
                <p class="apple-caption-strong text-primary tracking-[0.06em] text-[11px] uppercase truncate">{{ r.cuisine }}</p>
                <span
                  :class="`shrink-0 apple-fine uppercase tracking-wider px-1.5 py-0.5 rounded ${r.source === 'curated' ? 'bg-primary/10 text-primary' : 'bg-ink-muted-80/10 text-ink-muted-80'}`"
                  :title="r.source === 'curated' ? t('card.source_curated_full') : t('card.source_osm_full')"
                  >{{ sumberLabel(r) }}</span
                >
              </div>
              <h3 class="apple-tagline apple-title-tight text-ink mt-1.5 leading-[1.15]">{{ r.name }}</h3>
              <p class="apple-caption text-ink-muted-48 mt-1">
                {{ r.area
                }}<template v-if="r.price_range"
                  ><span class="mx-1.5 text-ink-muted-48/60">·</span><span class="text-ink-muted-80">{{ r.price_range }}</span
                  ><span class="text-ink-muted-48"> {{ t(`card.price.${r.price_range}`) }}</span></template
                >
              </p>
              <p v-if="r.rating != null" class="apple-caption mt-4 flex items-center gap-1.5 text-ink">
                <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 text-primary" aria-hidden="true"><path fill="currentColor" :d="STAR" /></svg>
                <span class="apple-caption-strong tabular">{{ r.rating.toFixed(1) }}</span>
                <span v-if="r.review_count != null && r.review_count > 0" class="text-ink-muted-48"
                  >· {{ formatReviews(r.review_count) }} {{ t("card.reviews") }}{{ r.rating_source ? ` · ${r.rating_source}` : "" }}</span
                >
              </p>
              <p v-if="r.description" class="apple-caption text-ink-muted-80 mt-3 line-clamp-3">{{ r.description }}</p>
              <p v-if="r.source === 'osm' && !r.description" class="apple-caption text-ink-muted-48 mt-3 italic">{{ t("card.osm_note") }}</p>
              <div class="mt-auto pt-5 flex items-center justify-between gap-4">
                <a :href="r.maps_url" target="_blank" rel="noopener noreferrer" class="press-scale link-blue apple-caption-strong inline-flex items-center gap-1">
                  {{ t("card.open_maps") }} <span aria-hidden="true">↗</span>
                </a>
                <a
                  v-if="r.sources[0]"
                  :href="r.sources[0].url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="press-scale link-blue apple-caption inline-flex items-center gap-1"
                  :title="r.sources[0].label"
                >
                  {{ t("card.source") }} <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </li>
        </ul>
        <div v-else class="border border-hairline rounded-apple_lg overflow-hidden bg-canvas">
          <div
            class="hidden md:grid grid-cols-[44px_minmax(0,1fr)_180px_120px_70px_120px] items-center gap-3 px-4 py-3 bg-paper border-b border-hairline atlas-mono text-ink-muted-48"
          >
            <span class="text-right">#</span>
            <span>{{ t("list.header.place") }}</span>
            <span class="text-right">{{ t("list.header.rating") }}</span>
            <span>{{ t("list.header.cuisine") }}</span>
            <span class="text-right">{{ t("list.header.price") }}</span>
            <span class="text-right">{{ t("list.header.actions") }}</span>
          </div>
          <ol>
            <li
              v-for="(r, i) in filtered"
              :key="r.id"
              class="grid grid-cols-[44px_minmax(0,1fr)] md:grid-cols-[44px_minmax(0,1fr)_180px_120px_70px_120px] items-center gap-3 px-4 py-3.5 border-b border-divider hover:bg-paper transition-colors"
            >
              <span class="atlas-mono text-ink-muted-48 tabular text-right">{{ String(i + 1).padStart(3, "0") }}</span>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="apple-body-strong text-ink truncate">{{ r.name }}</span>
                  <span
                    :class="`shrink-0 apple-fine uppercase tracking-wider px-1.5 py-0.5 rounded ${r.source === 'curated' ? 'bg-[color:var(--accent-bg)] text-[color:var(--accent)]' : 'bg-ink-muted-80/10 text-ink-muted-80'}`"
                    >{{ sumberLabel(r) }}</span
                  >
                </div>
                <p class="apple-fine text-ink-muted-48 truncate mt-0.5 md:hidden">{{ r.cuisine }} · {{ r.area }}</p>
                <p class="apple-fine text-ink-muted-48 truncate mt-0.5 hidden md:block">{{ r.area }}</p>
              </div>
              <div class="hidden md:flex items-baseline justify-end gap-1.5">
                <template v-if="r.rating != null">
                  <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 text-primary" aria-hidden="true"><path fill="currentColor" :d="STAR" /></svg>
                  <span class="apple-caption-strong tabular text-ink">{{ r.rating.toFixed(1) }}</span>
                  <span v-if="r.review_count != null && r.review_count > 0" class="apple-fine tabular text-ink-muted-48">· {{ formatReviews(r.review_count) }}</span>
                </template>
                <span v-else class="apple-fine text-ink-muted-48">—</span>
              </div>
              <span class="hidden md:block apple-caption text-ink-muted-80 truncate">{{ r.cuisine }}</span>
              <span class="hidden md:block text-right">
                <span v-if="r.price_range" class="apple-caption-strong text-[color:var(--accent)] tabular">{{ r.price_range }}</span>
                <span v-else class="apple-fine text-ink-muted-48">—</span>
              </span>
              <div class="hidden md:flex items-center justify-end gap-3 apple-fine">
                <a :href="r.maps_url" target="_blank" rel="noopener noreferrer" class="link-blue inline-flex items-center gap-0.5 apple-caption-strong">
                  Maps <span aria-hidden="true">↗</span>
                </a>
                <a v-if="r.sources[0]" :href="r.sources[0].url" target="_blank" rel="noopener noreferrer" class="link-blue inline-flex items-center gap-0.5">
                  {{ t("card.source") }} <span aria-hidden="true">↗</span>
                </a>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
    <footer id="sources" class="bg-parchment border-t border-hairline">
      <div class="mx-auto max-w-[1280px] px-6 py-16 grid md:grid-cols-12 gap-8">
        <div class="md:col-span-6">
          <p class="apple-caption-strong text-ink">{{ t("footer.about_title") }}</p>
          <p class="apple-body mt-3 text-ink-muted-80 max-w-[60ch]">{{ t("footer.about_body") }}</p>
        </div>
        <!-- [P2] kolom "Periksa" (/api/restaurants, /api/refresh) tidak di-port; slotnya dibiarkan kosong. -->
        <div class="md:col-span-3" />
        <div class="md:col-span-3">
          <p class="apple-caption-strong text-ink">{{ t("footer.coverage") }}</p>
          <ul class="mt-3 space-y-2.5 apple-body text-ink-muted-80">
            <li>{{ t("footer.coverage.estab", { n: st.total }) }}</li>
            <li>{{ t("footer.coverage.cuisines", { n: st.cuisines }) }}</li>
            <li>{{ t("footer.coverage.rated", { n: st.rated }) }}</li>
          </ul>
        </div>
      </div>
      <div class="border-t border-hairline">
        <div class="mx-auto max-w-[1280px] px-6 py-5 apple-fine text-ink-muted-48 flex items-center justify-between">
          <span>{{ t("footer.copyright", { year: new Date().getUTCFullYear() }) }}</span>
          <span>{{ t("footer.typeface") }}</span>
        </div>
      </div>
    </footer>
  </main>
</template>
