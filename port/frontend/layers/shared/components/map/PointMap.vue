<script setup lang="ts">
/**
 * Peta titik untuk indikator archetype "peta" (charts/PointMap.tsx): radius ∝ value, pusat Jakarta,
 * tile OpenStreetMap (SPEC §5.1: PointMap tetap OSM). Leaflet dimuat di browser; sampai siap tampil
 * "Memuat peta…" seperti PointMapClient v2 (juga saat SSR).
 *
 * INGAT: kolom longitude/latitude dataset obyek wisata TERBALIK — tukar sebelum dikirim ke sini.
 */
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { muatLeaflet } from "../../composables/useBasemap";

export type MapPoint = { lat: number; lng: number; label: string; value: number };

const props = defineProps<{ points: MapPoint[] }>();
const siap = ref(false);
const wadah = ref<HTMLDivElement | null>(null);
let map: Leaflet.Map | null = null;
let lapis: Leaflet.LayerGroup | null = null;
let L: typeof Leaflet;

function gambar() {
  if (!map || !lapis) return;
  lapis.clearLayers();
  const pts = props.points;
  if (!pts.length) return;
  // Radius ∝ value, dibatasi [4, 18].
  const maxV = Math.max(...pts.map((p) => p.value), 1);
  for (const p of pts) {
    L.circleMarker([p.lat, p.lng], { radius: 4 + 14 * (p.value / maxV), color: "#ed6b23", fillColor: "#ed6b23", fillOpacity: 0.5 })
      .bindPopup(
        `<div style="font-size:12px"><strong>${escHtml(p.label)}</strong><br>${p.value.toLocaleString("id-ID")} kunjungan</div>`,
      )
      .addTo(lapis);
  }
  map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [30, 30], maxZoom: 13 });
}

async function pasang() {
  if (map || !wadah.value) return;
  map = L.map(wadah.value, { center: [-6.2, 106.84], zoom: 11, scrollWheelZoom: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  lapis = L.layerGroup().addTo(map);
  gambar();
}

onMounted(async () => {
  L = await muatLeaflet();
  siap.value = true;
  await nextTick();
  await pasang();
});
// Titik kosong → wadah hilang; muncul lagi → peta dibuat ulang di wadah baru.
watch(
  () => props.points,
  async () => {
    if (!siap.value) return;
    await nextTick();
    if (map && !map.getContainer().isConnected) {
      map.remove();
      map = null;
    }
    if (map) gambar();
    else await pasang();
  },
);
onBeforeUnmount(() => map?.remove());
</script>

<template>
  <div v-if="!points.length" class="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-[13px] text-slate-400">
    Tidak ada titik dengan koordinat valid.
  </div>
  <div v-else-if="!siap" class="text-[13px] text-slate-400 py-6 text-center">Memuat peta…</div>
  <div v-else class="rounded-xl overflow-hidden border border-slate-200 h-[420px]">
    <div ref="wadah" style="height: 100%; width: 100%" />
  </div>
</template>
