<script setup lang="ts">
/**
 * Lapangan golf (components/GolfView.tsx): peta pin (Leaflet imperatif) + daftar. Bahasa dibaca dari
 * `dpj.lang` tanpa tombol (seperti v2). [P1] kicker memakai `home.vol2_kicker_short`, bukan kunci
 * literal `home.vol2_kicker`.
 */
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ExportFormat } from "../../shared/composables/useSpreadsheetExport";

type Golf = {
  id: string;
  name: string;
  kind: "Course" | "Driving Range" | "Topgolf";
  holes: number | null;
  par: number | null;
  designer: string | null;
  established: number | null;
  membership: "Public" | "Semi-private" | "Members" | "Resort" | null;
  city: string;
  area: string;
  address: string | null;
  lat: number;
  lng: number;
  website: string | null;
  description: string | null;
  highlights: string[];
  sources: { label: string; url: string }[];
  maps_url: string;
};
const props = defineProps<{ data: { items: Golf[]; stats: { total: number; courses: number; ranges: number; total_holes: number } } }>();

const KIND_FILTERS = ["All", "Course", "Driving Range", "Topgolf"] as const;
const ACCESS_COLOR: Record<string, string> = { Public: "#2E5D3C", "Semi-private": "#C8A14B", Members: "#1A3A5A", Resort: "#8B5A2B" };
const CITY_ORDER = ["Central Jakarta", "South Jakarta", "North Jakarta", "West Jakarta", "East Jakarta", "Kepulauan Seribu"];

const { t } = useLang();
const city = ref("All");
const kind = ref<(typeof KIND_FILTERS)[number]>("All");
const selectedId = ref<string | null>(null);
const cityOptions = computed(() => ["All", ...CITY_ORDER.filter((c) => props.data.items.some((g) => g.city === c))]);
const filtered = computed(() => props.data.items.filter((g) => (city.value === "All" || g.city === city.value) && (kind.value === "All" || g.kind === kind.value)));
const kindLabel = (k: string) => (k === "All" ? t("toolbar.cat.all") : k === "Course" ? t("golf.kind_course") : k === "Driving Range" ? t("golf.kind_range") : t("golf.kind_topgolf"));
const accessLabel = (m: string) =>
  m === "Public" ? t("golf.access_public") : m === "Members" ? t("golf.access_members") : m === "Semi-private" ? t("golf.access_semi") : t("golf.access_resort");

function pinIcon(g: Golf, sel: boolean): Leaflet.DivIcon {
  const colour = sel ? "#0A5E32" : (ACCESS_COLOR[g.membership ?? "Public"] ?? "#2E5D3C");
  const label = g.kind === "Course" ? String(g.holes ?? "?") : g.kind === "Topgolf" ? "TG" : "DR";
  const size = sel ? 54 : 36;
  const halo = sel
    ? "0 0 0 8px rgba(14,124,66,0.22), 0 0 0 14px rgba(14,124,66,0.10), 0 8px 20px rgba(15,20,25,0.45)"
    : "0 4px 12px rgba(15,20,25,0.35)";
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${colour};border:${sel ? "3px" : "2.5px"} solid #FCFAF4;border-radius:50%;box-shadow:${halo};display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--font-mono);font-weight:700;font-size:${sel ? 16 : 12}px;letter-spacing:0.02em;transition:all 220ms cubic-bezier(0.2, 0.65, 0.2, 1);${sel ? "z-index:1000;position:relative;" : ""}">${label}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const host = ref<HTMLDivElement | null>(null);
const kartu = new Map<string, HTMLElement>();
let L: typeof Leaflet;
let map: Leaflet.Map | null = null;
let markers: Leaflet.Marker[] = [];
const { addBasemap, muatLeaflet } = useBasemap();

function gambar() {
  if (!map) return;
  markers.forEach((m) => m.remove());
  markers = filtered.value.map((g) =>
    L.marker([g.lat, g.lng], { icon: pinIcon(g, g.id === selectedId.value), riseOnHover: true })
      .on("click", () => {
        selectedId.value = g.id;
        kartu.get(g.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      })
      .addTo(map!),
  );
}
onMounted(async () => {
  L = await muatLeaflet();
  if (!host.value) return;
  map = L.map(host.value, { zoomControl: true, preferCanvas: true, scrollWheelZoom: true }).setView([-6.2, 106.85], 11);
  addBasemap(L, map);
  gambar();
});
onBeforeUnmount(() => map?.remove());
watch([filtered, selectedId], gambar);

function onCardClick(g: Golf) {
  selectedId.value = g.id;
  map?.flyTo([g.lat, g.lng], 15, { duration: 0.8 });
}

const { downloadSpreadsheet, dateStamp } = useSpreadsheetExport();
async function exportGolf(format: ExportFormat) {
  if (filtered.value.length === 0) {
    alert(t("export.empty_rows"));
    return;
  }
  await downloadSpreadsheet<Golf>(
    `jakarta-atlas-golf-${dateStamp()}`,
    filtered.value,
    [
      { header: "No", value: (_g, i) => i + 1 },
      { header: "Nama", value: (g) => g.name },
      { header: "Jenis", value: (g) => g.kind },
      { header: "Jumlah Hole", value: (g) => g.holes ?? "" },
      { header: "Par", value: (g) => g.par ?? "" },
      { header: "Desainer", value: (g) => g.designer ?? "" },
      { header: "Tahun Berdiri", value: (g) => g.established ?? "" },
      { header: "Akses", value: (g) => g.membership ?? "" },
      { header: "Kota", value: (g) => g.city },
      { header: "Area", value: (g) => g.area },
      { header: "Alamat", value: (g) => g.address ?? "" },
      { header: "Lat", value: (g) => g.lat },
      { header: "Lng", value: (g) => g.lng },
      { header: "Website", value: (g) => g.website ?? "" },
      { header: "Google Maps", value: (g) => g.maps_url },
      { header: "Deskripsi", value: (g) => g.description ?? "" },
      { header: "Highlights", value: (g) => g.highlights.join(" · ") },
      { header: "Sumber", value: (g) => g.sources.map((s) => `${s.label} <${s.url}>`).join(" | ") },
    ],
    format,
    "Golf",
  );
}
const selected = computed(() => filtered.value.find((g) => g.id === selectedId.value));
</script>

<template>
  <main data-section="golf" class="min-h-screen flex flex-col bg-paper">
    <section class="border-b border-hairline bg-paper">
      <div class="mx-auto max-w-[1320px] px-6 py-10 md:py-14">
        <div class="flex items-center gap-3">
          <span class="atlas-mono text-ink-muted-48">{{ t("home.vol2_kicker_short") }}</span>
          <span class="flex-1 border-t border-hairline" />
          <span class="atlas-coord">JAKARTA · 6 KOTA</span>
        </div>
        <div class="mt-6 grid md:grid-cols-12 gap-8 items-end">
          <h1 class="atlas-display text-ink md:col-span-7">
            {{ t("golf.title_a") }} <span class="atlas-italic text-[color:var(--accent)]">{{ t("golf.title_b") }}</span>
          </h1>
          <dl class="md:col-span-5 grid grid-cols-4 gap-x-4 gap-y-1 border-l-0 md:border-l md:border-hairline md:pl-6">
            <div
              v-for="[l, v] in [
                [t('golf.stat_total'), data.stats.total],
                [t('golf.stat_courses'), data.stats.courses],
                [t('golf.stat_ranges'), data.stats.ranges],
                [t('golf.stat_holes'), data.stats.total_holes],
              ]"
              :key="String(l)"
            >
              <dt class="atlas-mono text-ink-muted-48">{{ l }}</dt>
              <dd class="atlas-display-md text-ink tabular mt-1">{{ v }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
    <section class="relative z-10 frosted border-b border-hairline">
      <div class="mx-auto max-w-[1320px] px-6 py-3 flex flex-wrap items-center gap-3">
        <span class="atlas-mono text-ink-muted-48">FILTER ·</span>
        <select
          v-model="city"
          class="appearance-none press-scale bg-canvas border border-hairline rounded-full h-9 pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink focus:outline-none cursor-pointer"
        >
          <option v-for="c in cityOptions" :key="c" :value="c">{{ c === "All" ? t("toolbar.city_all") : t(`city.${c}`) }}</option>
        </select>
        <div class="inline-flex p-1 bg-canvas border border-hairline rounded-full">
          <button
            v-for="k in KIND_FILTERS"
            :key="k"
            :class="`press-scale rounded-full px-3 py-1 apple-caption ${kind === k ? 'bg-[color:var(--accent)] text-white' : 'text-ink-muted-80 hover:text-ink'}`"
            @click="kind = k"
          >
            {{ kindLabel(k) }}
          </button>
        </div>
        <span class="ml-auto atlas-mono text-ink-muted-48">{{ filtered.length }}/{{ data.items.length }} · {{ t("map.pins_label") }}</span>
        <ExportButton :on-export="exportGolf" :label="t('export.csv')" />
      </div>
    </section>
    <section class="relative z-0 flex-1 grid md:grid-cols-[1.5fr_1fr] min-h-0">
      <div class="relative border-b md:border-b-0 md:border-r border-hairline">
        <div ref="host" class="absolute inset-0" style="min-height: 60vh" />
        <div class="absolute bottom-4 left-4 z-[400] bg-canvas/95 backdrop-blur border border-hairline rounded-md p-3 atlas-fine text-ink-muted-80 max-w-[260px]">
          <p class="atlas-mono text-ink mb-2">LEGEND</p>
          <div class="space-y-1.5">
            <div
              v-for="[c, k] in [
                [ACCESS_COLOR.Public, 'golf.access_public'],
                [ACCESS_COLOR['Semi-private'], 'golf.access_semi'],
                [ACCESS_COLOR.Members, 'golf.access_members'],
              ]"
              :key="k"
              class="flex items-center gap-2"
            >
              <span class="inline-block h-3 w-3 rounded-full border border-canvas" :style="{ background: c }" />
              <span>{{ t(k!) }}</span>
            </div>
          </div>
          <p class="text-ink-muted-48 mt-2">{{ t("golf.legend_pins") }}</p>
        </div>
      </div>
      <aside class="overflow-y-auto bg-paper" style="max-height: calc(100vh - 56px - 200px)">
        <div
          v-if="selectedId"
          class="sticky top-0 z-10 bg-[color:var(--accent)] text-white px-5 md:px-6 py-3 shadow-[0_2px_8px_rgba(15,20,25,0.10)] flex items-center justify-between gap-3"
        >
          <div class="min-w-0">
            <p class="atlas-mono opacity-80">{{ t("golf.selected_label") }}</p>
            <p class="apple-body-strong truncate">{{ selected?.name ?? "" }}</p>
          </div>
          <button
            :aria-label="t('golf.clear_selection')"
            class="press-scale shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors"
            @click="selectedId = null"
          >
            ✕
          </button>
        </div>
        <ol class="divide-y divide-hairline">
          <li
            v-for="(g, i) in filtered"
            :key="g.id"
            :ref="(el) => (el ? kartu.set(g.id, el as HTMLElement) : kartu.delete(g.id))"
            :class="`group cursor-pointer relative px-5 md:px-6 py-5 transition-all hover:bg-canvas ${g.id === selectedId ? 'bg-[color:var(--accent-bg)] pl-6 md:pl-7' : ''}`"
            @click="onCardClick(g)"
          >
            <span v-if="g.id === selectedId" aria-hidden="true" class="absolute left-0 top-0 bottom-0 w-1 bg-[color:var(--accent)]" />
            <div class="flex items-baseline gap-3">
              <span class="atlas-mono text-ink-muted-48 tabular w-7">{{ String(i + 1).padStart(2, "0") }}</span>
              <span class="atlas-mono text-[color:var(--accent)]">{{
                g.kind === "Course"
                  ? `${g.holes ?? "?"} ${t("golf.holes").toUpperCase()}${g.par ? ` · PAR ${g.par}` : ""}`
                  : g.kind === "Driving Range"
                    ? t("golf.kind_range").toUpperCase()
                    : "TOPGOLF"
              }}</span>
              <span v-if="g.membership" class="ml-auto atlas-mono text-ink-muted-48">{{ accessLabel(g.membership) }}</span>
            </div>
            <h3 class="atlas-display-md text-ink mt-1.5 leading-[1.1]">{{ g.name }}</h3>
            <p class="apple-caption text-ink-muted-80 mt-1">{{ g.area }}</p>
            <p v-if="g.designer" class="apple-caption text-ink-muted-80 mt-2">
              <span class="text-ink-muted-48">{{ t("golf.designer") }}: </span>{{ g.designer
              }}<span v-if="g.established" class="text-ink-muted-48"> · {{ t("golf.est") }} {{ g.established }}</span>
            </p>
            <div class="mt-3 flex items-center gap-4 atlas-mono">
              <a :href="g.maps_url" target="_blank" rel="noopener noreferrer" class="link-blue normal-case tracking-normal text-[12px]" @click.stop>
                {{ t("card.open_maps") }} →
              </a>
              <a v-if="g.website" :href="g.website" target="_blank" rel="noopener noreferrer" class="link-blue normal-case tracking-normal text-[12px]" @click.stop>
                {{ t("golf.website") }} ↗
              </a>
            </div>
          </li>
        </ol>
      </aside>
    </section>
    <footer class="border-t border-hairline bg-paper">
      <div class="mx-auto max-w-[1320px] px-6 py-5 atlas-fine text-ink-muted-48 flex flex-wrap items-center justify-between gap-2">
        <span>{{ t("golf.footer_source") }}</span>
        <span>{{ t("footer.typeface") }}</span>
      </div>
    </footer>
  </main>
</template>
