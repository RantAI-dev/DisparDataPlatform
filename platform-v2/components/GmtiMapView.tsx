"use client";

/**
 * Spatial memakai peta GMTI yang sudah ada, dengan tambahan dataset GCI/GPCI.
 *
 * Dua lapis:
 *  1. Choropleth kepadatan data per kecamatan: jumlah seluruh titik dari
 *     kategori yang sedang aktif (mengikuti filter kategori). Titik berkoordinat
 *     dipetakan ke kecamatan lewat point-in-polygon terhadap GeoJSON; fasilitas
 *     ibadah tanpa koordinat tetap dihitung lewat field kecamatan SIMAS.
 *  2. Pin tempat berkoordinat dari GCI/GPCI dan kategori GMTI, dengan ikon
 *     kategori. Sumber mengikuti daftar tematik; tidak membuat titik pengganti.
 *
 * Kecamatan yang tidak punya poligon di GeoJSON (Kepulauan Seribu) dicatat di
 * legenda, bukan dihilangkan diam-diam.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import L, { type Map as LeafletMap } from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { addBasemap } from "@/lib/basemap";
import { GMTI_META } from "@/lib/gmti-data";
import { idNum } from "@/lib/gmti";
import { hasSpatialCoordinates, MUSLIM_CATEGORIES, SPATIAL_CATEGORIES, SPATIAL_POINTS, spatialCity, type SpatialCategory, type SpatialPoint } from "@/lib/spatial";

const CATEGORIES = Object.keys(SPATIAL_CATEGORIES) as SpatialCategory[];
const POINTS = SPATIAL_POINTS.filter(hasSpatialCoordinates);

type IconDefaultProto = L.Icon.Default & { _getIconUrl?: unknown };
delete (L.Icon.Default.prototype as IconDefaultProto)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/** Skala choropleth hijau — gelap = makin padat. Sama untuk semua kategori. */
const RAMP = ["#e8f2f0", "#c3ded9", "#93c5bc", "#5aa79b", "#2d8b7c", "#0f7b6c"];

const geoKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

type GeoFeature = {
  type: "Feature";
  properties: { name: string; kecamatan: string };
  geometry: { type: string; coordinates: unknown };
};
type GeoJson = { type: "FeatureCollection"; features: GeoFeature[] };

type Ring = number[][];
type Poly = { bbox: [number, number, number, number]; rings: Ring[] };

/** Ray casting: apakah titik (x=lng, y=lat) ada di dalam ring. */
function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Ubah geometri Polygon/MultiPolygon jadi daftar poligon dengan bbox untuk uji cepat. */
function toPolys(g: GeoFeature["geometry"]): Poly[] {
  const polys = g.type === "Polygon" ? [g.coordinates as Ring[]] : g.type === "MultiPolygon" ? (g.coordinates as Ring[][]) : [];
  return polys.map((rings) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of rings[0] ?? []) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
    return { bbox: [a, b, c, d], rings };
  });
}

/** Lubang (ring ke-2 dst) dikecualikan. */
function inPoly(x: number, y: number, p: Poly): boolean {
  const [a, b, c, d] = p.bbox;
  if (x < a || x > c || y < b || y > d) return false;
  if (!inRing(x, y, p.rings[0])) return false;
  for (let i = 1; i < p.rings.length; i++) if (inRing(x, y, p.rings[i])) return false;
  return true;
}

type KecCount = { total: number; byCat: Partial<Record<SpatialCategory, number>> };

function esc(v: string): string {
  return v.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}

function pinIcon(p: SpatialPoint): L.DivIcon {
  const category = SPATIAL_CATEGORIES[p.category];
  return L.divIcon({
    html: `<div data-category="${p.category}" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${category.color};border:2.5px solid #fff;color:white;box-shadow:0 3px 10px rgba(15,20,25,.35)"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${category.icon}</svg></div>`,
    className: "spatial-category-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function popupHTML(p: SpatialPoint): string {
  const category = SPATIAL_CATEGORIES[p.category];
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;min-width:200px">
    <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${category.color}">${esc(category.label)}</div>
    <div style="font-weight:600;font-size:14px;color:#111;margin-top:2px">${esc(p.name)}</div>
    ${p.kind ? `<div style="font-size:12px;color:#5b6470;margin-top:2px">${esc(p.kind)}</div>` : ""}
    <div style="font-size:12px;color:#8b939d;margin-top:4px">${esc(p.address || p.city)}</div>
    ${p.source ? `<div style="font-size:11px;color:#8b939d;margin-top:4px">${esc(p.source)}</div>` : ""}
    ${p.cert ? `<div style="font-size:11px;color:#8b939d;margin-top:4px">Sertifikat: ${esc(p.cert)}</div>` : ""}
    <a href="${esc(p.href)}" style="display:inline-block;margin-top:8px;font-size:12px;color:#0b62d1">Lihat dataset →</a>
    <a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" rel="noreferrer" style="display:inline-block;margin:8px 0 0 12px;font-size:12px;color:#0b62d1">Buka di Maps ↗</a>
  </div>`;
}

export function GmtiMapView() {
  const mainRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const choroRef = useRef<L.GeoJSON | null>(null);
  const clusterRef = useRef<L.LayerGroup | null>(null);
  const markerCache = useRef(new Map<string, L.Marker>());

  const [showChoro, setShowChoro] = useState(true);
  const [active, setActive] = useState<Set<SpatialCategory>>(new Set(CATEGORIES));
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [extraPoints, setExtraPoints] = useState<SpatialPoint[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataErrors, setDataErrors] = useState<string[]>([]);
  const [dataRetry, setDataRetry] = useState(0);
  const [renderedCount, setRenderedCount] = useState(0);
  const [retry, setRetry] = useState(0);
  const [geo, setGeo] = useState<GeoJson | null>(null);
  const [geoError, setGeoError] = useState(false);
  /** Fasilitas ibadah SIMAS tanpa koordinat: geoKey kecamatan → jumlah. */
  const [ibadahNoCoord, setIbadahNoCoord] = useState<Map<string, number>>(new Map());

  const points = useMemo(() => {
    const seen = new Set(POINTS.map((p) => `${p.category}|${p.name.toLowerCase().trim()}|${p.lat}|${p.lng}`));
    return [...POINTS, ...extraPoints.filter(hasSpatialCoordinates).filter((p) => {
      const key = `${p.category}|${p.name.toLowerCase().trim()}|${p.lat}|${p.lng}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })];
  }, [extraPoints]);
  const cities = useMemo(() => [...new Set(points.map((p) => p.city).filter(Boolean))].sort(), [points]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setDataLoading(true);
    setDataErrors([]);
    const collected: SpatialPoint[] = [];
    const errors: string[] = [];
    const load = async () => {
      await Promise.all([
        fetch("/api/spatial", { signal: controller.signal }).then(async (r) => {
          if (!r.ok) throw new Error("lakehouse");
          const json = await r.json();
          collected.push(...json.points);
          if (!json.complete) errors.push("Sebagian dataset lakehouse gagal dimuat.");
        }).catch(() => { errors.push("Titik lakehouse belum dapat dimuat."); }),
        fetch("/gmti-ibadah.json", { signal: controller.signal }).then(async (r) => {
          if (!r.ok) throw new Error("ibadah");
          const json = await r.json() as { rows: { id: string; name: string; kota: string; kecamatan?: string; address: string; lat?: number; lon?: number }[] };
          const noCoord = new Map<string, number>();
          for (const row of json.rows) {
            if ((typeof row.lat === "number" && typeof row.lon === "number") || !row.kecamatan) continue;
            const k = geoKey(row.kecamatan);
            noCoord.set(k, (noCoord.get(k) ?? 0) + 1);
          }
          setIbadahNoCoord(noCoord);
          collected.push(...json.rows.map((r): SpatialPoint => ({ id: `simas-${r.id}`, name: r.name, category: "ibadah", city: spatialCity(r.kota || ""), address: r.address || "", lat: r.lat, lng: r.lon, href: "/gmti" })));
        }).catch(() => { errors.push("Daftar fasilitas ibadah belum dapat dimuat."); }),
      ]);
      if (controller.signal.aborted) return;
      setExtraPoints(collected);
      setDataErrors(errors);
      setDataLoading(false);
    };
    void load();
    return () => controller.abort();
  }, [dataRetry]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const resize = () => {
      const trailingSpace = Math.max(0, document.body.scrollHeight - main.offsetTop - main.offsetHeight);
      main.style.height = `${Math.max(0, (window.visualViewport?.height ?? window.innerHeight) - main.getBoundingClientRect().top - trailingSpace)}px`;
      mapRef.current?.invalidateSize();
    };
    const observer = new ResizeObserver(resize);
    const header = document.querySelector("body > header");
    if (header) observer.observe(header);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => { markerCache.current.clear(); }, [points]);

  /** Poligon per kecamatan (geoKey), dihitung sekali per GeoJSON. */
  const polys = useMemo(() => {
    if (!geo) return [];
    return geo.features.map((f) => ({ key: geoKey(f.properties.kecamatan), polys: toPolys(f.geometry) }));
  }, [geo]);

  /**
   * Kepadatan per kecamatan: seluruh titik dari kategori aktif. Titik
   * berkoordinat → point-in-polygon; ibadah SIMAS tanpa koordinat → field
   * kecamatan. Tidak ikut filter wilayah/pencarian agar skala tetap stabil.
   */
  const density = useMemo(() => {
    const m = new Map<string, KecCount>();
    const add = (key: string, cat: SpatialCategory, n = 1) => {
      const c = m.get(key) ?? { total: 0, byCat: {} };
      c.total += n;
      c.byCat[cat] = (c.byCat[cat] ?? 0) + n;
      m.set(key, c);
    };
    if (!polys.length) return m;
    for (const p of points) {
      if (!active.has(p.category)) continue;
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      const hit = polys.find((f) => f.polys.some((pl) => inPoly(p.lng, p.lat, pl)));
      if (hit) add(hit.key, p.category);
    }
    if (active.has("ibadah")) for (const [k, n] of ibadahNoCoord) add(k, "ibadah", n);
    return m;
  }, [polys, points, active, ibadahNoCoord]);

  /** Ambang skala: kuantil sederhana dari total per kecamatan yang punya data. */
  const breaks = useMemo(() => {
    const vals = [...density.values()].map((c) => c.total).sort((x, y) => x - y);
    if (!vals.length) return [];
    return RAMP.slice(1).map(
      (_, i) => vals[Math.floor(((i + 1) / RAMP.length) * (vals.length - 1))]
    );
  }, [density]);
  const maxDensity = useMemo(() => Math.max(0, ...[...density.values()].map((c) => c.total)), [density]);

  const colorFor = useMemo(
    () => (total: number) => {
      let i = 0;
      while (i < breaks.length && total > breaks[i]) i++;
      return RAMP[Math.min(i, RAMP.length - 1)];
    },
    [breaks]
  );

  const pins = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return points.filter((p) =>
      active.has(p.category) && (!city || p.city === city) &&
      (!needle || `${p.name} ${p.address} ${p.city}`.toLowerCase().includes(needle))
    );
  }, [active, city, search, points]);

  useEffect(() => {
    let cancelled = false;
    setGeoError(false);
    fetch("/geo/dki-jakarta.geojson")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: GeoJson) => {
        if (j.type !== "FeatureCollection" || !Array.isArray(j.features)) throw new Error("Poligon tidak valid");
        if (!cancelled) setGeo(j);
      })
      .catch(() => {
        if (!cancelled) setGeoError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);

  // Init peta sekali.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [-6.2, 106.82],
      zoom: 11,
      scrollWheelZoom: true,
    });
    addBasemap(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Lapis choropleth.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (choroRef.current) {
      map.removeLayer(choroRef.current);
      choroRef.current = null;
    }
    if (!geo || !showChoro) return;

    const collection = { ...geo, features: geo.features.filter((f) => !city || spatialCity(f.properties.name) === city) };
    const layer = L.geoJSON(collection as unknown as GeoJSON.GeoJsonObject, {
      style: (f) => {
        const kec = (f?.properties as { kecamatan?: string })?.kecamatan ?? "";
        const c = density.get(geoKey(kec));
        return {
          fillColor: c ? colorFor(c.total) : "#f1f3f5",
          fillOpacity: 0.72,
          color: "#ffffff",
          weight: 1.2,
        };
      },
      onEachFeature: (f, lyr) => {
        const props = f.properties as { kecamatan?: string; name?: string };
        const kec = props.kecamatan ?? "";
        const c = density.get(geoKey(kec));
        const rows = c
          ? CATEGORIES.filter((k) => c.byCat[k]).map((k) => `${esc(SPATIAL_CATEGORIES[k].label)}: ${idNum(c.byCat[k] ?? 0)}`).join("<br/>")
          : "";
        lyr.bindPopup(
          `<div style="font-family:-apple-system,system-ui,sans-serif;min-width:180px">
            <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#0f7b6c">${esc(
              props.name ?? ""
            )}</div>
            <div style="font-weight:600;font-size:14px;color:#111;margin-top:2px">${esc(
              kec
            )}</div>
            ${
              c
                ? `<div style="font-size:12px;color:#5b6470;margin-top:6px">
                     <strong>${idNum(c.total)} data</strong><br/>${rows}
                   </div>`
                : `<div style="font-size:12px;color:#8b939d;margin-top:6px">Tidak ada data untuk kecamatan ini</div>`
            }
          </div>`,
          { maxWidth: 280 }
        );
      },
    });
    layer.addTo(map);
    layer.bringToBack();
    choroRef.current = layer;
  }, [geo, showChoro, density, colorFor, city]);

  // Lapis pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }
    type ClusterModule = typeof L & {
      markerClusterGroup: (opts?: Record<string, unknown>) => L.LayerGroup & { addLayers: (layers: L.Marker[]) => void };
    };
    const cluster = (L as ClusterModule).markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 20,
      chunkDelay: 16,
      maxClusterRadius: 46,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });
    map.addLayer(cluster);
    clusterRef.current = cluster;
    let offset = 0;
    let timer = 0;
    setRenderedCount(0);
    const addBatch = () => {
      const markers = pins.slice(offset, offset + 150).map((p) => {
        let marker = markerCache.current.get(p.id);
        if (!marker) {
          marker = L.marker([p.lat, p.lng], { icon: pinIcon(p), title: `${p.name} · ${SPATIAL_CATEGORIES[p.category].label}`, alt: p.name });
          marker.bindPopup(() => popupHTML(p), { maxWidth: 300, autoPan: true });
          markerCache.current.set(p.id, marker);
        }
        return marker;
      });
      cluster.addLayers(markers);
      offset += markers.length;
      setRenderedCount(offset);
      if (offset < pins.length) timer = window.setTimeout(addBatch, 16);
    };
    timer = window.setTimeout(addBatch, 0);
    if ((search.trim() || city) && pins.length) {
      map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 14 });
    }
    return () => window.clearTimeout(timer);
  }, [pins, search, city]);

  const togglePillar = (p: SpatialCategory) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  return (
    <main ref={mainRef} className="flex flex-col overflow-hidden bg-paper" style={{ height: "calc(100dvh - 78px)" }} data-rendered-count={renderedCount}>
      <h1 className="sr-only">Spatial</h1>

      {/* FILTER STRIP */}
      <details className="frosted border-b border-hairline z-10 shrink-0 max-h-[45%] overflow-y-auto">
        <summary className="mx-auto max-w-[1280px] px-6 py-3 cursor-pointer apple-caption-strong">Filter peta · {idNum(pins.length)} titik{renderedCount < pins.length ? " · Memuat marker…" : ""}</summary>
        <div className="mx-auto max-w-[1280px] px-6 py-3 flex flex-wrap items-center gap-3">
          <button
            aria-pressed={showChoro}
            onClick={() => setShowChoro((v) => !v)}
            className={`press-scale rounded-full px-3 py-1.5 apple-caption border ${
              showChoro
                ? "bg-ink text-white border-ink"
                : "bg-canvas text-ink-muted-80 border-hairline hover:text-ink"
            }`}
          >
            Kepadatan kecamatan
          </button>
          <span className="hidden md:inline-block h-5 w-px bg-hairline" />
          <div className="flex flex-wrap items-center gap-1.5">
            <button aria-pressed={active.has("hotel") && active.has("menginap")} onClick={() => setActive((prev) => {
              const next = new Set(prev);
              const selected = next.has("hotel") && next.has("menginap");
              (["hotel", "menginap"] as SpatialCategory[]).forEach((p) => selected ? next.delete(p) : next.add(p));
              return next;
            })} style={active.has("hotel") && active.has("menginap") ? { background: SPATIAL_CATEGORIES.hotel.color, color: "white" } : undefined} className="press-scale rounded-full px-3 py-1 apple-caption border border-hairline">Hotel</button>
            <button aria-pressed={MUSLIM_CATEGORIES.every((p) => active.has(p))} onClick={() => setActive((prev) => {
              const next = new Set(prev);
              const selected = MUSLIM_CATEGORIES.every((p) => next.has(p));
              MUSLIM_CATEGORIES.forEach((p) => selected ? next.delete(p) : next.add(p));
              return next;
            })} style={MUSLIM_CATEGORIES.every((p) => active.has(p)) ? { background: SPATIAL_CATEGORIES.ibadah.color, color: "white" } : undefined} className="press-scale rounded-full px-3 py-1 apple-caption border border-hairline">Ramah Muslim</button>
            {CATEGORIES.filter((p) => p !== "hotel").map((p) => (
              <button
                key={p}
                aria-pressed={active.has(p)}
                onClick={() => togglePillar(p)}
                className={`press-scale rounded-full px-3 py-1 apple-caption border transition-colors ${
                  active.has(p)
                    ? "text-white border-transparent"
                    : "bg-canvas text-ink-muted-80 border-hairline hover:text-ink"
                }`}
                style={active.has(p) ? { background: SPATIAL_CATEGORIES[p].color } : undefined}
              >
                {SPATIAL_CATEGORIES[p].label}
              </button>
            ))}
          </div>
          <span role="status" className="ml-auto apple-caption tabular text-ink-muted-48">
            {idNum(pins.length)} / {idNum(points.length)} titik
          </span>
        </div>
      <div className="frosted border-b border-hairline">
        <div className="mx-auto max-w-[1280px] px-6 py-3 flex flex-wrap items-center gap-3">
          <input aria-label="Cari tempat" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama, alamat, atau wilayah…" className="min-w-0 flex-1 basis-[220px] rounded-full border border-hairline bg-canvas px-4 py-2 apple-caption text-ink" />
          <select aria-label="Wilayah" value={city} onChange={(e) => setCity(e.target.value)} className="max-w-full rounded-full border border-hairline bg-canvas px-3 py-2 apple-caption text-ink">
            <option value="">Semua wilayah</option>
            {cities.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button onClick={() => { setActive(new Set(CATEGORIES)); setCity(""); setQuery(""); setShowChoro(true); mapRef.current?.setView([-6.2, 106.82], 11); }} className="press-scale rounded-full border border-hairline bg-canvas px-3 py-2 apple-caption">Reset filter</button>
        </div>
        {!pins.length && <p className="mx-auto max-w-[1280px] px-6 pb-3 apple-caption">Tidak ada titik yang sesuai filter. Gunakan Reset filter untuk menampilkan semua.</p>}
      </div>
      </details>
      {dataLoading && <p role="status" className="px-6 py-1 apple-fine shrink-0">Memuat seluruh sumber berkoordinat…</p>}
      {dataErrors.length > 0 && <p role="alert" className="px-6 py-1 apple-fine shrink-0">{dataErrors.join(" ")} Titik yang tersedia tetap ditampilkan. <button onClick={() => setDataRetry((n) => n + 1)} className="underline">Coba lagi</button></p>}

      {/* MAP */}
      <div className="flex-1 relative min-h-0">
        <div ref={containerRef} className="absolute inset-0" />

        <details className="absolute bottom-4 left-4 z-[400] bg-canvas/95 backdrop-blur border border-hairline rounded-apple_lg p-3 max-w-[280px] max-h-[70%] overflow-y-auto shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
          <summary className="apple-fine cursor-pointer">Legenda & sumber</summary>
          <p className="apple-fine text-ink-muted-80 uppercase tracking-wider">
            Kepadatan data per kecamatan
          </p>
          <div className="mt-2 flex items-center gap-1">
            {RAMP.map((c) => (
              <span
                key={c}
                className="h-2.5 flex-1 first:rounded-l-full last:rounded-r-full"
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between apple-fine text-ink-muted-48 tabular">
            <span>sedikit</span>
            <span>{idNum(maxDensity)}</span>
          </div>

          <div className="mt-3 pt-3 border-t border-hairline space-y-1.5">
            {CATEGORIES.filter((p) => active.has(p)).map((p) => (
              <div key={p} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: SPATIAL_CATEGORIES[p].color }}
                />
                <span className="apple-fine text-ink-muted-80">{SPATIAL_CATEGORIES[p].label}</span>
              </div>
            ))}
          </div>

          <p className="apple-fine text-ink-muted-48 mt-3 pt-3 border-t border-hairline leading-relaxed">
            Kepadatan = jumlah titik kategori aktif per kecamatan. Hanya koordinat valid yang dipetakan; fasilitas ibadah tanpa koordinat tetap dihitung lewat kecamatannya.
            {GMTI_META.kecamatanTanpaPoligon.length > 0 && (
              <>
                {" "}
                {GMTI_META.kecamatanTanpaPoligon.join(" & ")} belum punya poligon di
                peta dasar.
              </>
            )}
          </p>

          {geoError && (
            <p role="alert" className="apple-fine text-ink mt-2">
              Lapis kepadatan gagal dimuat — pin tetap tampil.{" "}
              <button onClick={() => setRetry((n) => n + 1)} className="font-semibold underline">Coba lagi</button>
            </p>
          )}
        </details>
      </div>
    </main>
  );
}
