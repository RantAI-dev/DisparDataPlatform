"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AtlasNav, LangToggle } from "@/components/atlas/AtlasNav";
import L, { type Map as LeafletMap, type Marker } from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { RESTAURANTS, type Restaurant, googleMapsUrl } from "@/lib/restaurants";
import { addBasemap } from "@/lib/basemap";
import {
  DEFAULT_LANG,
  STORAGE_KEY,
  translate,
  type Lang,
} from "@/lib/i18n";

// Leaflet's default icon paths break under Next.js bundling. Point them at
// the CDN copy so markers actually render. Done once at module load.
type IconDefaultProto = L.Icon.Default & { _getIconUrl?: unknown };
delete (L.Icon.Default.prototype as IconDefaultProto)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const CATEGORIES = ["All", "Food", "Beverage", "Food & Beverage"] as const;
type Category = (typeof CATEGORIES)[number];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function popupHTML(r: Restaurant, t: (k: string) => string): string {
  const name = escapeHtml(r.name);
  const cuisine = escapeHtml(r.cuisine);
  const area = escapeHtml(r.area);
  const ratingRow =
    r.rating != null
      ? `<div style="margin-top:6px;font-size:13px;color:#1d1d1f;">★ ${r.rating.toFixed(
          1
        )}${
          r.reviewCount && r.reviewCount > 0
            ? `<span style="color:#7a7a7a;"> · ${r.reviewCount.toLocaleString(
                "en-US"
              )} ${escapeHtml(t("card.reviews"))}</span>`
            : ""
        }</div>`
      : "";
  const sourceBadge =
    r.source === "curated"
      ? `<span style="background:rgba(0,102,204,0.10);color:#0066cc;font-size:10px;padding:2px 6px;border-radius:3px;letter-spacing:0.06em;">${escapeHtml(
          t("card.source_curated")
        )}</span>`
      : `<span style="background:rgba(51,51,51,0.10);color:#333;font-size:10px;padding:2px 6px;border-radius:3px;letter-spacing:0.06em;">${escapeHtml(
          t("card.source_osm")
        )}</span>`;
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;min-width:240px;max-width:280px;">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <span style="font-size:10px;color:#0066cc;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${cuisine}</span>
      ${sourceBadge}
    </div>
    <div style="font-size:17px;font-weight:600;color:#1d1d1f;margin-top:4px;line-height:1.2;">${name}</div>
    <div style="font-size:13px;color:#7a7a7a;margin-top:2px;">${area}</div>
    ${ratingRow}
    <a href="${googleMapsUrl(
      r
    )}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:10px;color:#0066cc;font-size:13px;text-decoration:none;">${escapeHtml(
    t("card.open_maps")
  )} ↗</a>
  </div>`;
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  // ESM markercluster doesn't ship its own type; cast as any at the use site.
  const clusterRef = useRef<L.LayerGroup | null>(null);

  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  const [cuisine, setCuisine] = useState<string>("All");
  const [city, setCity] = useState<string>("All");
  const [category, setCategory] = useState<Category>("All");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "id" || stored === "en") setLang(stored);
    } catch {}
  }, []);

  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(lang, key, vars);

  const cuisineOptions = useMemo(() => {
    const set = new Set<string>();
    RESTAURANTS.forEach((r) => set.add(r.cuisine));
    return ["All", ...Array.from(set).sort()];
  }, []);

  const cityOptions = useMemo(() => {
    const ORDER = [
      "Central Jakarta",
      "South Jakarta",
      "North Jakarta",
      "West Jakarta",
      "East Jakarta",
      "Kepulauan Seribu",
    ];
    const present = new Set<string>();
    RESTAURANTS.forEach((r) => present.add(r.city));
    const ordered: string[] = [];
    for (const c of ORDER) if (present.has(c)) ordered.push(c);
    for (const c of [...present].sort()) {
      if (!ordered.includes(c)) ordered.push(c);
    }
    return ["All", ...ordered];
  }, []);

  const mapped = useMemo(
    () =>
      RESTAURANTS.filter(
        (r) =>
          typeof r.lat === "number" &&
          typeof r.lng === "number" &&
          (cuisine === "All" || r.cuisine === cuisine) &&
          (city === "All" || r.city === city) &&
          (category === "All" || r.category === category)
      ),
    [cuisine, city, category]
  );

  // Initialise the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    }).setView([-6.2, 106.85], 11);

    addBasemap(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-populate cluster whenever filters change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }

    // markerClusterGroup is added to the L global by the plugin import.
    type ClusterModule = typeof L & {
      markerClusterGroup: (opts?: Record<string, unknown>) => L.LayerGroup;
    };
    const cluster = (L as ClusterModule).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });

    for (const r of mapped) {
      const m: Marker = L.marker([r.lat as number, r.lng as number]);
      m.bindPopup(popupHTML(r, t), { maxWidth: 300, autoPan: true });
      cluster.addLayer(m);
    }
    map.addLayer(cluster);
    clusterRef.current = cluster;
    // Intentionally only react to filter inputs; t() reads lang via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapped, lang]);

  function onToggleLang() {
    const next: Lang = lang === "id" ? "en" : "id";
    setLang(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  return (
    <main className="min-h-screen flex flex-col bg-paper">
      <AtlasNav
        view="map"
        langToggle={<LangToggle lang={lang} onToggle={onToggleLang} t={t} />}
      />

      {/* FILTER STRIP */}
      <div className="frosted border-b border-hairline z-10">
        <div className="mx-auto max-w-[1280px] px-6 py-3 flex flex-wrap items-center gap-3">
          <MiniSelect
            label={t("toolbar.city_all")}
            value={city}
            onChange={setCity}
            options={cityOptions.map((c) => ({
              id: c,
              label: c === "All" ? t("toolbar.city_all") : t(`city.${c}`),
            }))}
          />
          <MiniSelect
            label={t("toolbar.cuisine_all")}
            value={cuisine}
            onChange={setCuisine}
            options={cuisineOptions.map((c) => ({
              id: c,
              label: c === "All" ? t("toolbar.cuisine_all") : c,
            }))}
          />
          <div className="inline-flex p-1 bg-canvas border border-hairline rounded-full">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`press-scale rounded-full px-3 py-1 apple-caption ${
                  category === c
                    ? "bg-primary text-white"
                    : "text-ink-muted-80 hover:text-ink"
                }`}
              >
                {c === "Food & Beverage"
                  ? t("toolbar.cat.both")
                  : c === "All"
                  ? t("toolbar.cat.all")
                  : c === "Food"
                  ? t("toolbar.cat.food")
                  : t("toolbar.cat.beverage")}
              </button>
            ))}
          </div>
          <span className="ml-auto apple-caption tabular text-ink-muted-48">
            {mapped.length.toLocaleString("en-US")} {t("map.pins_label")}
          </span>
        </div>
      </div>

      {/* MAP */}
      <div className="flex-1 relative" style={{ minHeight: "70vh" }}>
        <div ref={containerRef} className="absolute inset-0" />
        <div className="absolute bottom-4 left-4 z-[400] bg-canvas/95 backdrop-blur border border-hairline rounded-apple_lg p-3 max-w-[280px] apple-fine text-ink-muted-80 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
          {t("map.legend")}
        </div>
      </div>
    </main>
  );
}

function ViewToggle({ current, t }: { current: "list" | "map" | "golf"; t: (k: string) => string }) {
  const tabs: { id: typeof current; href: string; label: string }[] = [
    { id: "list", href: "/", label: t("nav.view_list") },
    { id: "map", href: "/map", label: t("nav.view_map") },
    { id: "golf", href: "/golf", label: t("nav.view_golf") },
  ];
  return (
    <div className="inline-flex p-0.5 bg-canvas border border-hairline rounded-full">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`press-scale rounded-full px-3 py-1 apple-caption-strong ${
            current === tab.id
              ? "bg-ink text-white"
              : "text-ink-muted-80 hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function MiniSelect({
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none press-scale bg-canvas border border-hairline rounded-full h-9 pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink focus:outline-none focus:border-primary-focus transition-colors cursor-pointer"
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
