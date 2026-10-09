"use client";

/**
 * ATLAS — Toko Suvenir Jakarta, tampilan PETA.
 *
 * Konsep 1:1 dengan components/MapView.tsx (peta Direktori Restoran): Leaflet
 * + markercluster di atas basemap Esri Light Gray Canvas, strip filter frosted di
 * atas, popup per pin, toggle List|Map lewat AtlasNav. Marker diwarnai per
 * relevansi supaya listing non-suvenir tetap bisa dilihat tapi terbedakan.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import L, { type Map as LeafletMap, type Marker } from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { AtlasNav } from "@/components/atlas/AtlasNav";
import { addBasemap } from "@/lib/basemap";
import {
  SOUVENIR_SHOPS,
  souvenirMapsUrl,
  souvenirProducts,
  type SouvenirShop,
} from "@/lib/souvenir";

type IconDefaultProto = L.Icon.Default & { _getIconUrl?: unknown };
delete (L.Icon.Default.prototype as IconDefaultProto)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const RELEVANCE = ["Toko suvenir", "Suvenir murni", "Sebagian", "Semua"] as const;
type Relevance = (typeof RELEVANCE)[number];

const COLOR: Record<string, string> = {
  Ya: "#e6a900",
  Sebagian: "#ed6b23",
};
const COLOR_OTHER = "#9aa3ad";

const colorOf = (s: SouvenirShop) => COLOR[s.relevance] ?? COLOR_OTHER;

function matchesRelevance(s: SouvenirShop, f: Relevance): boolean {
  if (f === "Semua") return true;
  if (f === "Suvenir murni") return s.relevance === "Ya";
  if (f === "Sebagian") return s.relevance === "Sebagian";
  return s.relevance === "Ya" || s.relevance === "Sebagian";
}

function pinIcon(s: SouvenirShop): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${colorOf(
      s
    )};border:2.5px solid #fff;box-shadow:0 3px 10px rgba(15,20,25,.35)"></div>`,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function esc(v: string): string {
  return v.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"
  );
}

function popupHTML(s: SouvenirShop): string {
  const rating =
    s.rating != null
      ? `<div style="margin-top:6px;font-size:12px;color:#5b6470">★ ${s.rating
          .toFixed(1)
          .replace(".", ",")}${
          s.reviews != null ? ` · ${s.reviews} ulasan` : ""
        }</div>`
      : "";
  const badge =
    s.relevance === "Ya"
      ? "Toko suvenir"
      : s.relevance === "Sebagian"
      ? "Sebagian suvenir"
      : "Bukan toko suvenir";
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;min-width:200px">
      <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${colorOf(
        s
      )}">${esc(badge)}</div>
      <div style="font-weight:600;font-size:14px;color:#111;margin-top:2px">${esc(
        s.name
      )}</div>
      ${
        s.product
          ? `<div style="font-size:12px;color:#5b6470;margin-top:2px">${esc(
              s.product
            )}</div>`
          : ""
      }
      ${
        s.address
          ? `<div style="font-size:12px;color:#8b939d;margin-top:4px">${esc(
              s.address
            )}</div>`
          : ""
      }
      ${rating}
      <a href="${souvenirMapsUrl(
        s
      )}" target="_blank" rel="noreferrer" style="display:inline-block;margin-top:8px;font-size:12px;color:#0b62d1">Buka di Maps ↗</a>
    </div>`;
}

function MiniSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none press-scale bg-canvas border border-hairline rounded-full h-9 pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink focus:outline-none focus:border-primary-focus transition-colors cursor-pointer max-w-[240px] truncate"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-muted-48 pointer-events-none"
        aria-hidden
      >
        <path fill="currentColor" d="M7 10l5 5 5-5z" />
      </svg>
    </div>
  );
}

export function SouvenirMapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const clusterRef = useRef<L.LayerGroup | null>(null);

  const [city, setCity] = useState("All");
  const [product, setProduct] = useState("All");
  const [relevance, setRelevance] = useState<Relevance>("Toko suvenir");

  const cityOptions = useMemo(() => {
    const set = new Set(
      SOUVENIR_SHOPS.map((s) => s.city).filter((c): c is string => !!c)
    );
    return ["All", ...[...set].sort()];
  }, []);
  const productOptions = useMemo(() => ["All", ...souvenirProducts()], []);

  const mapped = useMemo(
    () =>
      SOUVENIR_SHOPS.filter(
        (s) =>
          s.lat != null &&
          s.lng != null &&
          matchesRelevance(s, relevance) &&
          (city === "All" || s.city === city) &&
          (product === "All" || s.product === product)
      ),
    [city, product, relevance]
  );

  // Init map once.
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

  // Repopulate cluster on filter change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }
    type ClusterModule = typeof L & {
      markerClusterGroup: (opts?: Record<string, unknown>) => L.LayerGroup;
    };
    const cluster = (L as ClusterModule).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });
    for (const s of mapped) {
      const m: Marker = L.marker([s.lat as number, s.lng as number], {
        icon: pinIcon(s),
      });
      m.bindPopup(popupHTML(s), { maxWidth: 300, autoPan: true });
      cluster.addLayer(m);
    }
    map.addLayer(cluster);
    clusterRef.current = cluster;
    if (mapped.length) {
      map.fitBounds(
        L.latLngBounds(mapped.map((s) => [s.lat as number, s.lng as number])),
        { padding: [40, 40], maxZoom: 14 }
      );
    }
  }, [mapped]);

  return (
    <main className="min-h-screen flex flex-col bg-paper">
      <AtlasNav view="map" />

      {/* FILTER STRIP */}
      <div className="frosted border-b border-hairline z-10">
        <div className="mx-auto max-w-[1280px] px-6 py-3 flex flex-wrap items-center gap-3">
          <MiniSelect
            value={city}
            onChange={setCity}
            options={cityOptions.map((c) => ({
              id: c,
              label: c === "All" ? "Semua wilayah" : c,
            }))}
          />
          <MiniSelect
            value={product}
            onChange={setProduct}
            options={productOptions.map((p) => ({
              id: p,
              label: p === "All" ? "Semua produk" : p,
            }))}
          />
          <div className="inline-flex p-1 bg-canvas border border-hairline rounded-full">
            {RELEVANCE.map((r) => (
              <button
                key={r}
                onClick={() => setRelevance(r)}
                className={`press-scale rounded-full px-3 py-1 apple-caption ${
                  relevance === r
                    ? "bg-primary text-white"
                    : "text-ink-muted-80 hover:text-ink"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <span className="ml-auto apple-caption tabular text-ink-muted-48">
            {mapped.length} titik
          </span>
        </div>
      </div>

      {/* MAP */}
      <div className="flex-1 relative" style={{ minHeight: "70vh" }}>
        <div ref={containerRef} className="absolute inset-0" />
        <div className="absolute bottom-4 left-4 z-[400] bg-canvas/95 backdrop-blur border border-hairline rounded-apple_lg p-3 space-y-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
          {[
            { c: COLOR.Ya, l: "Toko suvenir" },
            { c: COLOR.Sebagian, l: "Sebagian suvenir" },
            { c: COLOR_OTHER, l: "Bukan toko suvenir" },
          ].map((x) => (
            <div key={x.l} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: x.c }}
              />
              <span className="apple-fine text-ink-muted-80">{x.l}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
