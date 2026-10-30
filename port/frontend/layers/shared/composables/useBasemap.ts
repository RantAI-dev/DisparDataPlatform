/**
 * Basemap bersama peta Leaflet (lib/basemap.ts v2): Esri Light Gray Canvas (alas) + Reference
 * (label), tanpa key dan tanpa cap "API KEY REQUIRED" seperti CARTO. Esri hanya punya tile sampai
 * z16, jadi maxNativeZoom 16 dan Leaflet memperbesar tile untuk z17–18.
 *
 * [K-9] Bila jaringan memblokir services.arcgisonline.com (tile alas gagal sebelum satu pun termuat),
 * alas + label Esri diganti OSM standar. Ini perbedaan yang diizinkan SPEC §5.1.
 *
 * Leaflet diterima sebagai argumen karena hanya boleh dimuat di browser (komponen `.client.vue`
 * mengimpornya dinamis).
 */
import type * as Leaflet from "leaflet";

type L = typeof Leaflet;

const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray";
const MAX_NATIVE_ZOOM = 16;
export const BASEMAP_MAX_ZOOM = 18;
const ATTRIBUTION =
  'Peta © <a href="https://www.esri.com">Esri</a> — sumber: Esri, HERE, Garmin, ' +
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
/** Jumlah galat tile alas (tanpa satu pun tile berhasil) sebelum pindah ke OSM. */
const BATAS_GAGAL = 3;

/**
 * Pasang alas + label Esri. `labelPane`: v2 memakai `shadowPane` lewat addBasemap(), sedangkan
 * VenueMap (react-leaflet) menaruh label di pane tile bawaan — `undefined` meniru yang kedua.
 */
export function addBasemap(L: L, map: Leaflet.Map, { labelPane = "shadowPane" as string | undefined } = {}): void {
  const alas = L.tileLayer(`${ESRI}_Base/MapServer/tile/{z}/{y}/{x}`, {
    maxNativeZoom: MAX_NATIVE_ZOOM,
    maxZoom: BASEMAP_MAX_ZOOM,
    attribution: ATTRIBUTION,
  });
  const label = L.tileLayer(`${ESRI}_Reference/MapServer/tile/{z}/{y}/{x}`, {
    maxNativeZoom: MAX_NATIVE_ZOOM,
    maxZoom: BASEMAP_MAX_ZOOM,
    ...(labelPane ? { pane: labelPane } : {}),
  });

  let termuat = 0;
  let gagal = 0;
  alas.on("tileload", () => termuat++);
  alas.on("tileerror", () => {
    if (termuat > 0 || ++gagal < BATAS_GAGAL) return;
    map.removeLayer(alas);
    map.removeLayer(label);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: BASEMAP_MAX_ZOOM,
      attribution: OSM_ATTRIBUTION,
    })
      .addTo(map)
      .bringToBack();
  });

  alas.addTo(map);
  label.addTo(map);
}

/** Ikon marker bawaan Leaflet dari aset lokal `/leaflet/*` (SPEC §5.1), bukan unpkg seperti v2. */
export function pakaiIkonLokal(L: L): void {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    iconUrl: "/leaflet/marker-icon.png",
    shadowUrl: "/leaflet/marker-shadow.png",
  });
}

/** Muat Leaflet (+ markercluster bila diminta) di browser. markercluster butuh `window.L` global. */
export async function muatLeaflet(denganCluster = false): Promise<L> {
  const L = (await import("leaflet")).default as unknown as L;
  if (denganCluster) {
    (window as unknown as { L: L }).L = L;
    await import("leaflet.markercluster");
  }
  pakaiIkonLokal(L);
  return L;
}

export function useBasemap() {
  return { addBasemap, muatLeaflet };
}
