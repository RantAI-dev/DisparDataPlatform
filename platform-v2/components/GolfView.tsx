"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L, { type Map as LeafletMap, type Marker as LeafletMarker } from "leaflet";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { AtlasNav, LangToggle } from "@/components/atlas/AtlasNav";
import { ExportButton } from "@/components/atlas/ExportButton";
import { GOLF_COURSES, golfMapsUrl, type GolfCourse } from "@/lib/golf";
import { addBasemap } from "@/lib/basemap";
import {
  type CsvColumn,
  type ExportFormat,
  dateStamp,
  downloadSpreadsheet,
} from "@/lib/export";
import {
  DEFAULT_LANG,
  STORAGE_KEY,
  translate,
  type Lang,
} from "@/lib/i18n";

type IconDefaultProto = L.Icon.Default & { _getIconUrl?: unknown };
delete (L.Icon.Default.prototype as IconDefaultProto)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const KIND_FILTERS = ["All", "Course", "Driving Range", "Topgolf"] as const;
type KindFilter = (typeof KIND_FILTERS)[number];

const ACCESS_COLOR: Record<NonNullable<GolfCourse["membership"]>, string> = {
  Public: "#2E5D3C",
  "Semi-private": "#C8A14B",
  Members: "#1A3A5A",
  Resort: "#8B5A2B",
};

/** Builds a circular SVG pin showing the hole count (or "DR"/"TG" for ranges).
 *  When selected, the pin grows 36 → 54 px, gets a 3 px white border,
 *  switches to the deep-accent fill, and gains a semi-transparent halo. */
function buildPinIcon(g: GolfCourse, isSelected: boolean): L.DivIcon {
  const colour = isSelected
    ? "#0A5E32"
    : ACCESS_COLOR[g.membership ?? "Public"] ?? "#2E5D3C";
  const label =
    g.kind === "Course"
      ? String(g.holes ?? "?")
      : g.kind === "Topgolf"
      ? "TG"
      : "DR";
  const size = isSelected ? 54 : 36;
  const fontSize = isSelected ? 16 : 12;
  const border = isSelected ? "3px solid #FCFAF4" : "2.5px solid #FCFAF4";
  const halo = isSelected
    ? "0 0 0 8px rgba(14,124,66,0.22), 0 0 0 14px rgba(14,124,66,0.10), 0 8px 20px rgba(15,20,25,0.45)"
    : "0 4px 12px rgba(15,20,25,0.35)";
  return L.divIcon({
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${colour};
      border: ${border};
      border-radius: 50%;
      box-shadow: ${halo};
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: ${fontSize}px;
      letter-spacing: 0.02em;
      transition: all 220ms cubic-bezier(0.2, 0.65, 0.2, 1);
      ${isSelected ? "z-index: 1000; position: relative;" : ""}
    ">${label}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function GolfView() {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  const [city, setCity] = useState<string>("All");
  const [kind, setKind] = useState<KindFilter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mapHostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const cardRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "id" || stored === "en") setLang(stored);
    } catch {}
  }, []);

  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(lang, key, vars);

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
    GOLF_COURSES.forEach((g) => present.add(g.city));
    const ordered: string[] = [];
    for (const c of ORDER) if (present.has(c)) ordered.push(c);
    return ["All", ...ordered];
  }, []);

  const filtered = useMemo(
    () =>
      GOLF_COURSES.filter(
        (g) =>
          (city === "All" || g.city === city) &&
          (kind === "All" || g.kind === kind)
      ),
    [city, kind]
  );

  const stats = useMemo(() => {
    const courses = GOLF_COURSES.filter((g) => g.kind === "Course");
    const ranges = GOLF_COURSES.filter((g) => g.kind !== "Course");
    const totalHoles = courses.reduce((s, g) => s + (g.holes ?? 0), 0);
    return {
      total: GOLF_COURSES.length,
      courses: courses.length,
      ranges: ranges.length,
      totalHoles,
    };
  }, []);

  // Init map once.
  useEffect(() => {
    if (!mapHostRef.current || mapRef.current) return;
    const map = L.map(mapHostRef.current, {
      zoomControl: true,
      preferCanvas: true,
      scrollWheelZoom: true,
    }).setView([-6.2, 106.85], 11);
    addBasemap(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-render markers when filter or selection changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Clear old markers.
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    for (const g of filtered) {
      const m = L.marker([g.lat, g.lng], {
        icon: buildPinIcon(g, g.id === selectedId),
        riseOnHover: true,
      });
      m.on("click", () => {
        setSelectedId(g.id);
        // Scroll the right-rail card into view.
        const el = cardRefs.current.get(g.id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
      m.addTo(map);
      markersRef.current.set(g.id, m);
    }
  }, [filtered, selectedId]);

  function onCardClick(g: GolfCourse) {
    setSelectedId(g.id);
    const map = mapRef.current;
    if (map) {
      map.flyTo([g.lat, g.lng], 15, { duration: 0.8 });
      // Pop the popup for that pin.
      const marker = markersRef.current.get(g.id);
      if (marker) {
        marker.openPopup?.();
      }
    }
  }

  function onToggleLang() {
    const next: Lang = lang === "id" ? "en" : "id";
    setLang(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  async function exportGolf(format: ExportFormat) {
    if (filtered.length === 0) {
      alert(t("export.empty_rows"));
      return;
    }
    const columns: CsvColumn<GolfCourse>[] = [
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
      { header: "Google Maps", value: (g) => golfMapsUrl(g) },
      { header: "Deskripsi", value: (g) => g.description ?? "" },
      { header: "Highlights", value: (g) => g.highlights.join(" · ") },
      {
        header: "Sumber",
        value: (g) => g.sources.map((s) => `${s.label} <${s.url}>`).join(" | "),
      },
    ];
    await downloadSpreadsheet(
      `jakarta-atlas-golf-${dateStamp()}`,
      filtered,
      columns,
      format,
      "Golf"
    );
  }

  return (
    <main data-section="golf" className="min-h-screen flex flex-col bg-paper">
      <AtlasNav
        section="golf"
        t={t}
        langToggle={<LangToggle lang={lang} onToggle={onToggleLang} t={t} />}
      />

      {/* HERO STRIP — slim, editorial */}
      <section className="border-b border-hairline bg-paper">
        <div className="mx-auto max-w-[1320px] px-6 py-10 md:py-14">
          <div className="flex items-center gap-3">
            <span className="atlas-mono text-ink-muted-48">
              {t("home.vol2_kicker")}
            </span>
            <span className="flex-1 border-t border-hairline" />
            <span className="atlas-coord">JAKARTA · 6 KOTA</span>
          </div>
          <div className="mt-6 grid md:grid-cols-12 gap-8 items-end">
            <h1 className="atlas-display text-ink md:col-span-7">
              {t("golf.title_a")}{" "}
              <span className="atlas-italic text-[color:var(--accent)]">
                {t("golf.title_b")}
              </span>
            </h1>
            <dl className="md:col-span-5 grid grid-cols-4 gap-x-4 gap-y-1 border-l-0 md:border-l md:border-hairline md:pl-6">
              <StatTile label={t("golf.stat_total")} value={String(stats.total)} />
              <StatTile label={t("golf.stat_courses")} value={String(stats.courses)} />
              <StatTile label={t("golf.stat_ranges")} value={String(stats.ranges)} />
              <StatTile label={t("golf.stat_holes")} value={String(stats.totalHoles)} />
            </dl>
          </div>
        </div>
      </section>

      {/* FILTER STRIP */}
      <section className="relative z-10 frosted border-b border-hairline">
        <div className="mx-auto max-w-[1320px] px-6 py-3 flex flex-wrap items-center gap-3">
          <span className="atlas-mono text-ink-muted-48">FILTER ·</span>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="appearance-none press-scale bg-canvas border border-hairline rounded-full h-9 pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink focus:outline-none cursor-pointer"
          >
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? t("toolbar.city_all") : t(`city.${c}`)}
              </option>
            ))}
          </select>
          <div className="inline-flex p-1 bg-canvas border border-hairline rounded-full">
            {KIND_FILTERS.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`press-scale rounded-full px-3 py-1 apple-caption ${
                  kind === k
                    ? "bg-[color:var(--accent)] text-white"
                    : "text-ink-muted-80 hover:text-ink"
                }`}
              >
                {k === "All"
                  ? t("toolbar.cat.all")
                  : k === "Course"
                  ? t("golf.kind_course")
                  : k === "Driving Range"
                  ? t("golf.kind_range")
                  : t("golf.kind_topgolf")}
              </button>
            ))}
          </div>
          <span className="ml-auto atlas-mono text-ink-muted-48">
            {filtered.length}/{GOLF_COURSES.length} · {t("map.pins_label")}
          </span>
          <ExportButton onExport={exportGolf} label={t("export.csv")} />
        </div>
      </section>

      {/* SPLIT LAYOUT: map (60%) + list (40%) */}
      <section className="relative z-0 flex-1 grid md:grid-cols-[1.5fr_1fr] min-h-0">
        {/* Map */}
        <div className="relative border-b md:border-b-0 md:border-r border-hairline">
          <div ref={mapHostRef} className="absolute inset-0" style={{ minHeight: "60vh" }} />
          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-[400] bg-canvas/95 backdrop-blur border border-hairline rounded-md p-3 atlas-fine text-ink-muted-80 max-w-[260px]">
            <p className="atlas-mono text-ink mb-2">LEGEND</p>
            <div className="space-y-1.5">
              <LegendRow color={ACCESS_COLOR["Public"]} label={t("golf.access_public")} />
              <LegendRow color={ACCESS_COLOR["Semi-private"]} label={t("golf.access_semi")} />
              <LegendRow color={ACCESS_COLOR["Members"]} label={t("golf.access_members")} />
            </div>
            <p className="text-ink-muted-48 mt-2">{t("golf.legend_pins")}</p>
          </div>
        </div>

        {/* List rail */}
        <aside className="overflow-y-auto bg-paper" style={{ maxHeight: "calc(100vh - 56px - 200px)" }}>
          {selectedId && (
            <div className="sticky top-0 z-10 bg-[color:var(--accent)] text-white px-5 md:px-6 py-3 shadow-[0_2px_8px_rgba(15,20,25,0.10)] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="atlas-mono opacity-80">{t("golf.selected_label")}</p>
                <p className="apple-body-strong truncate">
                  {filtered.find((g) => g.id === selectedId)?.name ?? ""}
                </p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                aria-label={t("golf.clear_selection")}
                className="press-scale shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 transition-colors"
              >
                ✕
              </button>
            </div>
          )}
          <ol className="divide-y divide-hairline">
            {filtered.map((g, i) => (
              <CourseRow
                key={g.id}
                g={g}
                index={i + 1}
                t={t}
                selected={g.id === selectedId}
                onClick={() => onCardClick(g)}
                refSetter={(el) => {
                  if (el) cardRefs.current.set(g.id, el);
                  else cardRefs.current.delete(g.id);
                }}
              />
            ))}
          </ol>
        </aside>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-hairline bg-paper">
        <div className="mx-auto max-w-[1320px] px-6 py-5 atlas-fine text-ink-muted-48 flex flex-wrap items-center justify-between gap-2">
          <span>{t("golf.footer_source")}</span>
          <span>{t("footer.typeface")}</span>
        </div>
      </footer>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="atlas-mono text-ink-muted-48">{label}</dt>
      <dd className="atlas-display-md text-ink tabular mt-1">{value}</dd>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-3 w-3 rounded-full border border-canvas"
        style={{ background: color }}
      />
      <span>{label}</span>
    </div>
  );
}

function CourseRow({
  g,
  index,
  t,
  selected,
  onClick,
  refSetter,
}: {
  g: GolfCourse;
  index: number;
  t: (k: string, vars?: Record<string, string | number>) => string;
  selected: boolean;
  onClick: () => void;
  refSetter: (el: HTMLLIElement | null) => void;
}) {
  return (
    <li
      ref={refSetter}
      onClick={onClick}
      className={`group cursor-pointer relative px-5 md:px-6 py-5 transition-all hover:bg-canvas ${
        selected
          ? "bg-[color:var(--accent-bg)] pl-6 md:pl-7"
          : ""
      }`}
    >
      {selected && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1 bg-[color:var(--accent)]"
        />
      )}
      <div className="flex items-baseline gap-3">
        <span className="atlas-mono text-ink-muted-48 tabular w-7">
          {String(index).padStart(2, "0")}
        </span>
        <span className="atlas-mono text-[color:var(--accent)]">
          {g.kind === "Course"
            ? `${g.holes ?? "?"} ${t("golf.holes").toUpperCase()}${g.par ? ` · PAR ${g.par}` : ""}`
            : g.kind === "Driving Range"
            ? t("golf.kind_range").toUpperCase()
            : "TOPGOLF"}
        </span>
        {g.membership && (
          <span className="ml-auto atlas-mono text-ink-muted-48">
            {g.membership === "Public"
              ? t("golf.access_public")
              : g.membership === "Members"
              ? t("golf.access_members")
              : g.membership === "Semi-private"
              ? t("golf.access_semi")
              : t("golf.access_resort")}
          </span>
        )}
      </div>
      <h3 className="atlas-display-md text-ink mt-1.5 leading-[1.1]">
        {g.name}
      </h3>
      <p className="apple-caption text-ink-muted-80 mt-1">{g.area}</p>
      {g.designer && (
        <p className="apple-caption text-ink-muted-80 mt-2">
          <span className="text-ink-muted-48">{t("golf.designer")}: </span>
          {g.designer}
          {g.established && (
            <span className="text-ink-muted-48"> · {t("golf.est")} {g.established}</span>
          )}
        </p>
      )}
      <div className="mt-3 flex items-center gap-4 atlas-mono">
        <a
          href={golfMapsUrl(g)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="link-blue normal-case tracking-normal text-[12px]"
        >
          {t("card.open_maps")} →
        </a>
        {g.website && (
          <a
            href={g.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="link-blue normal-case tracking-normal text-[12px]"
          >
            {t("golf.website")} ↗
          </a>
        )}
      </div>
    </li>
  );
}
