<script setup lang="ts">
/**
 * Peta venue seni pertunjukan (pariwisata/VenueMap.tsx), basemap Esri seperti Atlas. Titik oranye =
 * venue biasa (radius ∝ jumlah event); titik EMAS + halo = venue yang pernah menghadirkan artis
 * Top-10 Global Chart. Klik titik → detail di panel kanan. Leaflet dimuat di browser; sampai siap
 * tampil "Memuat peta venue…" seperti VenueMapClient v2.
 */
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { addBasemap, muatLeaflet } from "../../composables/useBasemap";

export type Venue = {
  venue: string;
  address: string;
  wilayah: string;
  lat: number;
  lon: number;
  eventCount: number;
  events: { nama_event: string; periode: string }[];
  gold: boolean;
  artists: string[];
};

const props = defineProps<{ venues: Venue[] }>();

const ORANGE = "#ed6b23";
const GOLD = "#e6a900";
const GOLD_DARK = "#8a6a00";
const AF = "-apple-system,BlinkMacSystemFont,system-ui,sans-serif";

const idOf = (v: Venue) => `${v.venue}|${v.lat}|${v.lon}`;
const normal = computed(() => props.venues.filter((v) => !v.gold));
const gold = computed(() => props.venues.filter((v) => v.gold));
const sel = ref<Venue | null>(gold.value[0] ?? normal.value[0] ?? null);
const isSel = (v: Venue) => sel.value != null && idOf(sel.value) === idOf(v);

const siap = ref(false);
const wadah = ref<HTMLDivElement | null>(null);
let L: typeof Leaflet;
let map: Leaflet.Map | null = null;
let lapis: Leaflet.LayerGroup | null = null;

function gambar() {
  if (!map || !lapis) return;
  lapis.clearLayers();
  const maxV = Math.max(...normal.value.map((v) => v.eventCount), 1);
  for (const v of normal.value) {
    L.circleMarker([v.lat, v.lon], {
      radius: 4 + 9 * (v.eventCount / maxV) + (isSel(v) ? 3 : 0),
      color: isSel(v) ? "#1d1d1f" : "#fff",
      weight: isSel(v) ? 3 : 1,
      fillColor: ORANGE,
      fillOpacity: 0.85,
    })
      .on("click", () => (sel.value = v))
      .addTo(lapis);
  }
  for (const v of gold.value) {
    L.circleMarker([v.lat, v.lon], { radius: 18, interactive: false, stroke: false, fillColor: GOLD, fillOpacity: 0.22 }).addTo(lapis);
  }
  for (const v of gold.value) {
    L.circleMarker([v.lat, v.lon], {
      radius: isSel(v) ? 11 : 9,
      color: isSel(v) ? "#1d1d1f" : GOLD_DARK,
      weight: isSel(v) ? 3 : 2,
      fillColor: GOLD,
      fillOpacity: 1,
    })
      .on("click", () => (sel.value = v))
      .addTo(lapis);
  }
}

function sesuaikan() {
  if (!map || !props.venues.length) return;
  map.fitBounds(L.latLngBounds(props.venues.map((v) => [v.lat, v.lon] as [number, number])), { padding: [30, 30], maxZoom: 13 });
}

onMounted(async () => {
  L = await muatLeaflet();
  siap.value = true;
  await nextTick();
  if (!wadah.value) return;
  map = L.map(wadah.value, { center: [-6.2, 106.85], zoom: 11, preferCanvas: true, scrollWheelZoom: true });
  // VenueMap v2 menulis TileLayer react-leaflet sendiri: label Esri di pane tile bawaan, bukan shadowPane.
  addBasemap(L, map, { labelPane: undefined });
  lapis = L.layerGroup().addTo(map);
  sesuaikan();
  gambar();
});
watch(sel, gambar);
watch(
  () => props.venues,
  () => {
    sesuaikan();
    gambar();
  },
);
onBeforeUnmount(() => map?.remove());

const embed = computed(() => (sel.value ? `https://maps.google.com/maps?q=${sel.value.lat},${sel.value.lon}&z=16&output=embed` : ""));
const mapsLink = computed(() => (sel.value ? `https://www.google.com/maps/search/?api=1&query=${sel.value.lat},${sel.value.lon}` : ""));
</script>

<template>
  <div v-if="!venues.length" class="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-[13px] text-slate-400">
    Belum ada venue dengan koordinat.
  </div>
  <div
    v-else-if="!siap"
    class="flex h-[460px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-400"
  >
    Memuat peta venue…
  </div>
  <div v-else class="flex flex-col gap-3 md:flex-row">
    <!-- Peta (kiri) -->
    <div class="relative h-[380px] flex-1 overflow-hidden rounded-2xl border border-slate-200 shadow-sm md:h-[520px]">
      <div ref="wadah" style="height: 100%; width: 100%" />

      <!-- Legenda -->
      <div class="absolute bottom-3 right-3 z-[1000] rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-[11px] shadow-md backdrop-blur">
        <div class="mb-1.5 flex items-center gap-2">
          <span class="inline-block h-3 w-3 rounded-full border border-white" :style="{ background: ORANGE }" />
          <span class="text-slate-600">Venue event · radius ∝ jumlah</span>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="inline-block h-3.5 w-3.5 rounded-full border"
            :style="{ background: GOLD, borderColor: GOLD_DARK, boxShadow: '0 0 0 3px rgba(230,169,0,0.25)' }"
          />
          <span class="font-medium text-slate-700">Pernah menghadirkan artis Top-10</span>
        </div>
      </div>
    </div>

    <!-- Panel info (kanan) -->
    <aside class="h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:h-[520px] md:w-[340px] md:shrink-0">
      <div v-if="sel" :style="{ fontFamily: AF }" class="flex h-full flex-col">
        <iframe
          :title="`Peta ${sel.venue}`"
          :src="embed"
          class="w-full shrink-0"
          height="170"
          loading="lazy"
          style="border: 0; display: block"
          referrerpolicy="no-referrer-when-downgrade"
        />
        <div class="flex-1 overflow-y-auto px-4 py-3.5">
          <div class="flex items-center justify-between gap-2">
            <span :style="{ color: sel.gold ? GOLD_DARK : ORANGE }" class="text-[10px] font-bold uppercase tracking-[0.08em]">{{ sel.wilayah }}</span>
            <span
              v-if="sel.gold"
              :style="{ color: GOLD_DARK, background: 'rgba(230,169,0,0.16)', borderColor: 'rgba(230,169,0,0.4)' }"
              class="rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em]"
            >
              ★ Top-10 Venue
            </span>
          </div>
          <div class="mt-1 text-[17px] font-semibold leading-tight text-[#1d1d1f]">{{ sel.venue }}</div>
          <div v-if="sel.address" class="mt-1 text-[12px] leading-snug text-[#7a7a7a]">{{ sel.address }}</div>

          <div
            v-if="sel.gold && sel.artists.length > 0"
            style="background: rgba(230, 169, 0, 0.1); border-color: rgba(230, 169, 0, 0.32); color: #5c4a00"
            class="mt-2.5 rounded-lg border px-2.5 py-2 text-[12px]"
          >
            <div class="mb-0.5 font-semibold">Artis Top-10 Global Chart:</div>
            <div v-for="(a, i) in sel.artists" :key="i">{{ a }}</div>
          </div>

          <div class="mt-2.5 text-[13px] text-[#1d1d1f]"><b>{{ sel.eventCount }}</b> event terdata</div>
          <ul v-if="sel.events.length > 0" class="mt-1 space-y-0.5">
            <li v-for="(e, j) in sel.events" :key="j" class="text-[12px] leading-snug text-[#555]">
              • {{ e.nama_event }}<span v-if="e.periode" class="text-[#9a9a9a]"> ({{ e.periode }})</span>
            </li>
          </ul>
        </div>

        <div class="flex items-center justify-between border-t border-[#ececec] px-4 py-2.5">
          <a :href="mapsLink" target="_blank" rel="noreferrer" :style="{ color: ORANGE }" class="text-[13px] font-medium">Buka di Maps ↗</a>
          <a
            href="https://satudata.jakarta.go.id/open-data/data-seni-pertunjukan-dan-visual"
            target="_blank"
            rel="noreferrer"
            class="text-[12px] text-[#9a9a9a]"
          >
            Sumber ↗
          </a>
        </div>
      </div>
      <div v-else class="flex h-full items-center justify-center p-6 text-center text-[13px] text-slate-400">
        Klik titik venue di peta untuk melihat detail & peta lokasi.
      </div>
    </aside>
  </div>
</template>
