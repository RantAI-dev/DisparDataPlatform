<script setup lang="ts">
/**
 * Peta Spatial (GmtiMapView.tsx v2), komponen tampilan saja: data datang dari layer spasial lewat
 * props berbentuk `/v1/spasial` (KONTRAK §2.5). Dua lapis:
 *  1. Choropleth kepadatan per kecamatan = jumlah titik kategori AKTIF. Server sudah menghitung
 *     point-in-polygon per kategori (`kepadatanBerkoordinat`); ibadah tanpa koordinat ditambahkan
 *     lewat `kepadatanTanpaKoordinat` bila kategori ibadah aktif — sama dengan v2.
 *  2. Pin titik berkoordinat dengan ikon kategori, dikelompokkan markercluster, ditambah bertahap.
 * Titik ringkas membawa alamat (untuk pencarian); sertifikat menyusul lewat `muatDetail(id)`
 * (`/v1/spasial/titik/{id}`) saat popup dibuka.
 */
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { addBasemap, muatLeaflet } from "../../composables/useBasemap";

export type SpasialTitik = {
  id: string;
  name: string;
  category: SpatialCategory;
  city: string;
  lat: number;
  lng: number;
  href: string;
  kind?: string | null;
  source?: string | null;
  /** Alamat (KONTRAK §2.5): dipakai pencarian dan popup. */
  address: string;
};
export type SpasialDetail = SpasialTitik & { cert?: string | null };
type KecCount = { total: number; byCat: Partial<Record<SpatialCategory, number>> };

const props = defineProps<{
  points: SpasialTitik[];
  cities: string[];
  kepadatanBerkoordinat: Record<string, KecCount>;
  kepadatanTanpaKoordinat: Record<string, number>;
  kecamatanTanpaPoligon: string[];
  loading?: boolean;
  errors?: string[];
  muatDetail: (id: string) => Promise<SpasialDetail>;
}>();
const emit = defineEmits<{ "muat-ulang": [] }>();

const CATEGORIES = Object.keys(SPATIAL_CATEGORIES) as SpatialCategory[];
const MUSLIM_CATEGORIES: SpatialCategory[] = ["ibadah", "makan", "menginap", "destinasi", "program"];
/** Skala choropleth hijau — gelap = makin padat. Sama untuk semua kategori. */
const RAMP = ["#e8f2f0", "#c3ded9", "#93c5bc", "#5aa79b", "#2d8b7c", "#0f7b6c"];
const geoKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function spatialCity(value: string): string {
  const city = value.trim().toLowerCase();
  const names: Record<string, string> = {
    "central jakarta": "Jakarta Pusat",
    "south jakarta": "Jakarta Selatan",
    "north jakarta": "Jakarta Utara",
    "west jakarta": "Jakarta Barat",
    "east jakarta": "Jakarta Timur",
    "kepulauan seribu": "Kepulauan Seribu",
  };
  return names[city] ?? city.replace(/\b\w/g, (c) => c.toUpperCase());
}

type GeoFeature = { type: "Feature"; properties: { name: string; kecamatan: string }; geometry: unknown };
type GeoJson = { type: "FeatureCollection"; features: GeoFeature[] };

const mainRef = ref<HTMLElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const showChoro = ref(true);
const active = ref(new Set<SpatialCategory>(CATEGORIES));
const city = ref("");
const query = ref("");
const search = ref("");
const renderedCount = ref(0);
const retry = ref(0);
const geo = shallowRef<GeoJson | null>(null);
const geoError = ref(false);

let L: typeof Leaflet;
let map: Leaflet.Map | null = null;
let choro: Leaflet.GeoJSON | null = null;
let cluster: (Leaflet.LayerGroup & { addLayers: (l: Leaflet.Marker[]) => void }) | null = null;
const markerCache = new Map<string, Leaflet.Marker>();
const siap = ref(false);

let tunda: number | undefined;
watch(query, (q) => {
  window.clearTimeout(tunda);
  tunda = window.setTimeout(() => (search.value = q), 180);
});
watch(
  () => props.points,
  () => markerCache.clear(),
);

/** Kepadatan per kecamatan untuk kategori aktif; tidak ikut filter wilayah/cari agar skala stabil. */
const density = computed(() => {
  const m = new Map<string, KecCount>();
  if (!geo.value) return m;
  const add = (key: string, cat: SpatialCategory, n: number) => {
    const c = m.get(key) ?? { total: 0, byCat: {} };
    c.total += n;
    c.byCat[cat] = (c.byCat[cat] ?? 0) + n;
    m.set(key, c);
  };
  for (const [key, c] of Object.entries(props.kepadatanBerkoordinat)) {
    for (const cat of CATEGORIES) if (active.value.has(cat) && c.byCat[cat]) add(key, cat, c.byCat[cat]!);
  }
  if (active.value.has("ibadah")) for (const [k, n] of Object.entries(props.kepadatanTanpaKoordinat)) add(k, "ibadah", n);
  return m;
});

/** Ambang skala: kuantil sederhana dari total per kecamatan yang punya data. */
const breaks = computed(() => {
  const vals = [...density.value.values()].map((c) => c.total).sort((x, y) => x - y);
  if (!vals.length) return [];
  return RAMP.slice(1).map((_, i) => vals[Math.floor(((i + 1) / RAMP.length) * (vals.length - 1))]!);
});
const maxDensity = computed(() => Math.max(0, ...[...density.value.values()].map((c) => c.total)));
function colorFor(total: number) {
  let i = 0;
  while (i < breaks.value.length && total > breaks.value[i]!) i++;
  return RAMP[Math.min(i, RAMP.length - 1)]!;
}

const pins = computed(() => {
  const needle = search.value.trim().toLowerCase();
  // Sama dengan v2: nama + alamat + wilayah.
  return props.points.filter(
    (p) =>
      active.value.has(p.category) &&
      (!city.value || p.city === city.value) &&
      (!needle || `${p.name} ${p.address} ${p.city}`.toLowerCase().includes(needle)),
  );
});

function pinIcon(p: SpasialTitik): Leaflet.DivIcon {
  const category = SPATIAL_CATEGORIES[p.category];
  return L.divIcon({
    html: `<div data-category="${p.category}" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${category.color};border:2.5px solid #fff;color:white;box-shadow:0 3px 10px rgba(15,20,25,.35)"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${category.icon}</svg></div>`,
    className: "spatial-category-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function popupHTML(p: SpasialDetail): string {
  const category = SPATIAL_CATEGORIES[p.category];
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;min-width:200px">
    <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${category.color}">${escHtml(category.label)}</div>
    <div style="font-weight:600;font-size:14px;color:#111;margin-top:2px">${escHtml(p.name)}</div>
    ${p.kind ? `<div style="font-size:12px;color:#5b6470;margin-top:2px">${escHtml(p.kind)}</div>` : ""}
    <div style="font-size:12px;color:#8b939d;margin-top:4px">${escHtml(p.address || p.city)}</div>
    ${p.source ? `<div style="font-size:11px;color:#8b939d;margin-top:4px">${escHtml(p.source)}</div>` : ""}
    ${p.cert ? `<div style="font-size:11px;color:#8b939d;margin-top:4px">Sertifikat: ${escHtml(p.cert)}</div>` : ""}
    <a href="${escHtml(p.href)}" style="display:inline-block;margin-top:8px;font-size:12px;color:#0b62d1">Lihat dataset →</a>
    <a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" rel="noreferrer" style="display:inline-block;margin:8px 0 0 12px;font-size:12px;color:#0b62d1">Buka di Maps ↗</a>
  </div>`;
}

function markerUntuk(p: SpasialTitik): Leaflet.Marker {
  let marker = markerCache.get(p.id);
  if (!marker) {
    const m = L.marker([p.lat, p.lng], { icon: pinIcon(p), title: `${p.name} · ${SPATIAL_CATEGORIES[p.category].label}`, alt: p.name });
    // Popup langsung tampil dengan data ringkas; sertifikat menyusul dari muatDetail.
    m.bindPopup(() => popupHTML(p), { maxWidth: 300, autoPan: true });
    m.on("popupopen", () => {
      props
        .muatDetail(p.id)
        .then((d) => m.getPopup()?.setContent(popupHTML(d)))
        .catch(() => {});
    });
    markerCache.set(p.id, m);
    marker = m;
  }
  return marker;
}

function gambarChoro() {
  if (!map) return;
  if (choro) {
    map.removeLayer(choro);
    choro = null;
  }
  if (!geo.value || !showChoro.value) return;
  const collection = { ...geo.value, features: geo.value.features.filter((f) => !city.value || spatialCity(f.properties.name) === city.value) };
  const layer = L.geoJSON(collection as unknown as GeoJSON.GeoJsonObject, {
    style: (f) => {
      const c = density.value.get(geoKey((f?.properties as { kecamatan?: string })?.kecamatan ?? ""));
      return { fillColor: c ? colorFor(c.total) : "#f1f3f5", fillOpacity: 0.72, color: "#ffffff", weight: 1.2 };
    },
    onEachFeature: (f, lyr) => {
      const p = f.properties as { kecamatan?: string; name?: string };
      const kec = p.kecamatan ?? "";
      const c = density.value.get(geoKey(kec));
      const rows = c
        ? CATEGORIES.filter((k) => c.byCat[k])
            .map((k) => `${escHtml(SPATIAL_CATEGORIES[k].label)}: ${idfmt(c.byCat[k] ?? 0)}`)
            .join("<br/>")
        : "";
      lyr.bindPopup(
        `<div style="font-family:-apple-system,system-ui,sans-serif;min-width:180px">
            <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#0f7b6c">${escHtml(p.name ?? "")}</div>
            <div style="font-weight:600;font-size:14px;color:#111;margin-top:2px">${escHtml(kec)}</div>
            ${
              c
                ? `<div style="font-size:12px;color:#5b6470;margin-top:6px">
                     <strong>${idfmt(c.total)} data</strong><br/>${rows}
                   </div>`
                : `<div style="font-size:12px;color:#8b939d;margin-top:6px">Tidak ada data untuk kecamatan ini</div>`
            }
          </div>`,
        { maxWidth: 280 },
      );
    },
  });
  layer.addTo(map);
  layer.bringToBack();
  choro = layer;
}

let batch: number | undefined;
function gambarPin() {
  if (!map) return;
  if (cluster) {
    map.removeLayer(cluster);
    cluster = null;
  }
  const c = (L as unknown as { markerClusterGroup: (o: Record<string, unknown>) => NonNullable<typeof cluster> }).markerClusterGroup({
    chunkedLoading: true,
    chunkInterval: 20,
    chunkDelay: 16,
    maxClusterRadius: 46,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
  });
  map.addLayer(c);
  cluster = c;
  const daftar = pins.value;
  let offset = 0;
  window.clearTimeout(batch);
  renderedCount.value = 0;
  const addBatch = () => {
    const markers = daftar.slice(offset, offset + 150).map(markerUntuk);
    c.addLayers(markers);
    offset += markers.length;
    renderedCount.value = offset;
    if (offset < daftar.length) batch = window.setTimeout(addBatch, 16);
  };
  batch = window.setTimeout(addBatch, 0);
  if ((search.value.trim() || city.value) && daftar.length) {
    map.fitBounds(L.latLngBounds(daftar.map((p) => [p.lat, p.lng] as [number, number])), { padding: [30, 30], maxZoom: 14 });
  }
}

watch(
  retry,
  async (_n, _o, onCleanup) => {
    let batal = false;
    onCleanup(() => (batal = true));
    geoError.value = false;
    try {
      const r = await fetch("/geo/dki-jakarta.geojson");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as GeoJson;
      if (j.type !== "FeatureCollection" || !Array.isArray(j.features)) throw new Error("Poligon tidak valid");
      if (!batal) geo.value = j;
    } catch {
      if (!batal) geoError.value = true;
    }
  },
  { immediate: false },
);

let resize: (() => void) | undefined;
let observer: ResizeObserver | undefined;
onMounted(async () => {
  retry.value++;
  const main = mainRef.value!;
  // Tinggi <main> mengisi sisa layar di bawah header (meniru v2, termasuk visualViewport di HP).
  resize = () => {
    const trailingSpace = Math.max(0, document.body.scrollHeight - main.offsetTop - main.offsetHeight);
    main.style.height = `${Math.max(0, (window.visualViewport?.height ?? window.innerHeight) - main.getBoundingClientRect().top - trailingSpace)}px`;
    map?.invalidateSize();
  };
  observer = new ResizeObserver(resize);
  const header = document.querySelector("body header");
  if (header) observer.observe(header);
  if (containerRef.value) observer.observe(containerRef.value);
  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", resize);
  resize();

  L = await muatLeaflet(true);
  if (!containerRef.value) return;
  map = L.map(containerRef.value, { center: [-6.2, 106.82], zoom: 11, scrollWheelZoom: true });
  addBasemap(L, map);
  siap.value = true;
  gambarChoro();
  gambarPin();
});
watch([geo, showChoro, density, city], gambarChoro);
watch([pins, search, city], gambarPin);
onBeforeUnmount(() => {
  window.clearTimeout(tunda);
  window.clearTimeout(batch);
  observer?.disconnect();
  if (resize) {
    window.removeEventListener("resize", resize);
    window.visualViewport?.removeEventListener("resize", resize);
  }
  map?.remove();
});

function toggle(cats: SpatialCategory[]) {
  const next = new Set(active.value);
  const semua = cats.every((p) => next.has(p));
  cats.forEach((p) => (semua ? next.delete(p) : next.add(p)));
  active.value = next;
}
const hotelAktif = computed(() => active.value.has("hotel") && active.value.has("menginap"));
const muslimAktif = computed(() => MUSLIM_CATEGORIES.every((p) => active.value.has(p)));
function reset() {
  active.value = new Set(CATEGORIES);
  city.value = "";
  query.value = "";
  showChoro.value = true;
  map?.setView([-6.2, 106.82], 11);
}
</script>

<template>
  <main ref="mainRef" class="flex flex-col overflow-hidden bg-paper" style="height: calc(100dvh - 78px)" :data-rendered-count="renderedCount">
    <h1 class="sr-only">Spatial</h1>

    <!-- FILTER STRIP -->
    <details class="frosted border-b border-hairline z-10 shrink-0 max-h-[45%] overflow-y-auto">
      <summary class="mx-auto max-w-[1280px] px-6 py-3 cursor-pointer apple-caption-strong">
        Filter peta · {{ idfmt(pins.length) }} titik{{ renderedCount < pins.length ? " · Memuat marker…" : "" }}
      </summary>
      <div class="mx-auto max-w-[1280px] px-6 py-3 flex flex-wrap items-center gap-3">
        <button
          :aria-pressed="showChoro"
          :class="`press-scale rounded-full px-3 py-1.5 apple-caption border ${
            showChoro ? 'bg-ink text-white border-ink' : 'bg-canvas text-ink-muted-80 border-hairline hover:text-ink'
          }`"
          @click="showChoro = !showChoro"
        >
          Kepadatan kecamatan
        </button>
        <span class="hidden md:inline-block h-5 w-px bg-hairline" />
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            :aria-pressed="hotelAktif"
            :style="hotelAktif ? { background: SPATIAL_CATEGORIES.hotel.color, color: 'white' } : undefined"
            class="press-scale rounded-full px-3 py-1 apple-caption border border-hairline"
            @click="toggle(['hotel', 'menginap'])"
          >
            Hotel
          </button>
          <button
            :aria-pressed="muslimAktif"
            :style="muslimAktif ? { background: SPATIAL_CATEGORIES.ibadah.color, color: 'white' } : undefined"
            class="press-scale rounded-full px-3 py-1 apple-caption border border-hairline"
            @click="toggle(MUSLIM_CATEGORIES)"
          >
            Ramah Muslim
          </button>
          <button
            v-for="p in CATEGORIES.filter((c) => c !== 'hotel')"
            :key="p"
            :aria-pressed="active.has(p)"
            :class="`press-scale rounded-full px-3 py-1 apple-caption border transition-colors ${
              active.has(p) ? 'text-white border-transparent' : 'bg-canvas text-ink-muted-80 border-hairline hover:text-ink'
            }`"
            :style="active.has(p) ? { background: SPATIAL_CATEGORIES[p].color } : undefined"
            @click="toggle([p])"
          >
            {{ SPATIAL_CATEGORIES[p].label }}
          </button>
        </div>
        <span role="status" class="ml-auto apple-caption tabular text-ink-muted-48">{{ idfmt(pins.length) }} / {{ idfmt(points.length) }} titik</span>
      </div>
      <div class="frosted border-b border-hairline">
        <div class="mx-auto max-w-[1280px] px-6 py-3 flex flex-wrap items-center gap-3">
          <input
            v-model="query"
            aria-label="Cari tempat"
            placeholder="Cari nama, alamat, atau wilayah…"
            class="min-w-0 flex-1 basis-[220px] rounded-full border border-hairline bg-canvas px-4 py-2 apple-caption text-ink"
          />
          <select v-model="city" aria-label="Wilayah" class="max-w-full rounded-full border border-hairline bg-canvas px-3 py-2 apple-caption text-ink">
            <option value="">Semua wilayah</option>
            <option v-for="c in cities" :key="c">{{ c }}</option>
          </select>
          <button class="press-scale rounded-full border border-hairline bg-canvas px-3 py-2 apple-caption" @click="reset">Reset filter</button>
        </div>
        <p v-if="!pins.length" class="mx-auto max-w-[1280px] px-6 pb-3 apple-caption">
          Tidak ada titik yang sesuai filter. Gunakan Reset filter untuk menampilkan semua.
        </p>
      </div>
    </details>
    <p v-if="loading" role="status" class="px-6 py-1 apple-fine shrink-0">Memuat seluruh sumber berkoordinat…</p>
    <p v-if="errors?.length" role="alert" class="px-6 py-1 apple-fine shrink-0">
      {{ errors.join(" ") }} Titik yang tersedia tetap ditampilkan.
      <button class="underline" @click="emit('muat-ulang')">Coba lagi</button>
    </p>

    <!-- MAP -->
    <div class="flex-1 relative min-h-0">
      <div ref="containerRef" class="absolute inset-0" />
      <p v-if="!siap" class="absolute inset-0 flex items-center justify-center apple-caption text-ink-muted-48">Memuat peta Spatial…</p>

      <details
        class="absolute bottom-4 left-4 z-[400] bg-canvas/95 backdrop-blur border border-hairline rounded-apple_lg p-3 max-w-[280px] max-h-[70%] overflow-y-auto shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
      >
        <summary class="apple-fine cursor-pointer">Legenda & sumber</summary>
        <p class="apple-fine text-ink-muted-80 uppercase tracking-wider">Kepadatan data per kecamatan</p>
        <div class="mt-2 flex items-center gap-1">
          <span v-for="c in RAMP" :key="c" class="h-2.5 flex-1 first:rounded-l-full last:rounded-r-full" :style="{ background: c }" />
        </div>
        <div class="mt-1 flex justify-between apple-fine text-ink-muted-48 tabular">
          <span>sedikit</span>
          <span>{{ idfmt(maxDensity) }}</span>
        </div>

        <div class="mt-3 pt-3 border-t border-hairline space-y-1.5">
          <div v-for="p in CATEGORIES.filter((c) => active.has(c))" :key="p" class="flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ background: SPATIAL_CATEGORIES[p].color }" />
            <span class="apple-fine text-ink-muted-80">{{ SPATIAL_CATEGORIES[p].label }}</span>
          </div>
        </div>

        <p class="apple-fine text-ink-muted-48 mt-3 pt-3 border-t border-hairline leading-relaxed">
          Kepadatan = jumlah titik kategori aktif per kecamatan. Hanya koordinat valid yang dipetakan; fasilitas ibadah tanpa koordinat tetap
          dihitung lewat kecamatannya.<template v-if="kecamatanTanpaPoligon.length">
            {{ kecamatanTanpaPoligon.join(" & ") }} belum punya poligon di peta dasar.</template
          >
        </p>

        <p v-if="geoError" role="alert" class="apple-fine text-ink mt-2">
          Lapis kepadatan gagal dimuat — pin tetap tampil.
          <button class="font-semibold underline" @click="retry++">Coba lagi</button>
        </p>
      </details>
    </div>
  </main>
</template>
