"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AtlasNav, LangToggle as AtlasLangToggle } from "@/components/atlas/AtlasNav";
import { ExportButton } from "@/components/atlas/ExportButton";
import { type Restaurant, googleMapsUrl, mapsEmbedUrl } from "@/lib/restaurants";
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

type Props = { restaurants: Restaurant[] };

const CATEGORIES = ["All", "Food", "Beverage", "Food & Beverage"] as const;
type Category = (typeof CATEGORIES)[number];

type SortId = "rating" | "reviews" | "name";
const SORT_KEYS: { id: SortId; tKey: string }[] = [
  { id: "rating", tKey: "toolbar.sort.rating" },
  { id: "reviews", tKey: "toolbar.sort.reviews" },
  { id: "name", tKey: "toolbar.sort.name" },
];

type PriceTier = NonNullable<Restaurant["priceRange"]>;

const PRICE_T_KEYS: Record<PriceTier, string> = {
  $: "card.price.$",
  $$: "card.price.$$",
  $$$: "card.price.$$$",
  $$$$: "card.price.$$$$",
};

function formatReviews(n?: number): string {
  if (n == null) return "";
  if (n >= 10000) return Math.round(n / 1000) + "k";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString("en-US");
}

export function Dashboard({ restaurants }: Props) {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  // Hydrate stored language preference after mount to avoid SSR mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "id" || stored === "en") setLang(stored);
    } catch {}
  }, []);
  // Keep <html lang> in sync for accessibility / SEO.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(lang, key, vars);

  const onToggleLang = () => {
    const next: Lang = lang === "id" ? "en" : "id";
    setLang(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string>("All");
  const [city, setCity] = useState<string>("All");
  const [category, setCategory] = useState<Category>("All");
  const [sort, setSort] = useState<SortId>("rating");
  const [viewMode, setViewMode] = useState<"cards" | "rows">("cards");

  // Persist the view-mode preference across sessions.
  useEffect(() => {
    try {
      const v = window.localStorage.getItem("dpj.view");
      if (v === "cards" || v === "rows") setViewMode(v);
    } catch {}
  }, []);
  function onSetViewMode(v: "cards" | "rows") {
    setViewMode(v);
    try {
      window.localStorage.setItem("dpj.view", v);
    } catch {}
  }
  const [refreshing, startRefresh] = useTransition();
  const [refreshResult, setRefreshResult] = useState<{
    checkedAt: string;
    totalSources: number;
    reachable: number;
    results: { url: string; ok: boolean; status: number }[];
  } | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Map every source URL → its first human label, so the details panel
  // shows "Wanderlog — Italian Jakarta" rather than the raw URL.
  const urlLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    restaurants.forEach((r) =>
      r.sources.forEach((s) => {
        if (!m.has(s.url)) m.set(s.url, s.label);
      })
    );
    return m;
  }, [restaurants]);

  const cuisineOptions = useMemo(() => {
    const set = new Set<string>();
    restaurants.forEach((r) => set.add(r.cuisine));
    return ["All", ...Array.from(set).sort()];
  }, [restaurants]);

  // DKI Jakarta sub-regions first, then Greater-Jakarta cities, alphabetical
  // fallback. Mirrors lib/restaurants.ts → CITY_ORDER without re-importing.
  const cityOptions = useMemo(() => {
    const ORDER = [
      "Central Jakarta",
      "South Jakarta",
      "North Jakarta",
      "West Jakarta",
      "East Jakarta",
      "Kepulauan Seribu",
      "Tangerang",
      "Bekasi",
      "Depok",
      "Bogor",
    ];
    const present = new Set<string>();
    restaurants.forEach((r) => present.add(r.city));
    const ordered: string[] = [];
    for (const c of ORDER) if (present.has(c)) ordered.push(c);
    for (const c of [...present].sort()) {
      if (!ordered.includes(c)) ordered.push(c);
    }
    return ["All", ...ordered];
  }, [restaurants]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = restaurants.filter((r) => {
      if (cuisine !== "All" && r.cuisine !== cuisine) return false;
      if (city !== "All" && r.city !== city) return false;
      if (category !== "All" && r.category !== category) return false;
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
    if (sort === "rating") {
      sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    } else if (sort === "reviews") {
      sorted.sort((a, b) => (b.reviewCount ?? -1) - (a.reviewCount ?? -1));
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [restaurants, query, cuisine, city, category, sort]);

  const stats = useMemo(() => {
    const cuisines = new Set(restaurants.map((r) => r.cuisine)).size;
    const rated = restaurants.filter((r) => r.rating != null);
    const avg =
      rated.length > 0
        ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length
        : 0;
    return {
      total: restaurants.length,
      cuisines,
      ratedCount: rated.length,
      avgRating: avg,
    };
  }, [restaurants]);

  async function exportRestaurants(format: ExportFormat) {
    if (filtered.length === 0) {
      alert(t("export.empty_rows"));
      return;
    }
    const columns: CsvColumn<Restaurant>[] = [
      { header: "No", value: (_r, i) => i + 1 },
      { header: "Nama", value: (r) => r.name },
      { header: "Kuliner", value: (r) => r.cuisine },
      { header: "Kategori", value: (r) => r.category },
      { header: "Kota", value: (r) => r.city },
      { header: "Area", value: (r) => r.area },
      { header: "Alamat", value: (r) => r.address ?? "" },
      { header: "Rating", value: (r) => r.rating ?? "" },
      { header: "Jumlah Ulasan", value: (r) => r.reviewCount ?? "" },
      { header: "Sumber Rating", value: (r) => r.ratingSource ?? "" },
      { header: "Tier Harga", value: (r) => r.priceRange ?? "" },
      { header: "Catatan Harga", value: (r) => r.priceNote ?? "" },
      { header: "Highlights", value: (r) => r.highlights.join(" · ") },
      { header: "Deskripsi", value: (r) => r.description ?? "" },
      { header: "Tipe Data", value: (r) => r.source },
      { header: "Lat", value: (r) => r.lat ?? "" },
      { header: "Lng", value: (r) => r.lng ?? "" },
      { header: "Telepon", value: (r) => r.phone ?? "" },
      { header: "Website", value: (r) => r.website ?? "" },
      { header: "Google Maps", value: (r) => googleMapsUrl(r) },
      {
        header: "Sumber",
        value: (r) => r.sources.map((s) => `${s.label} <${s.url}>`).join(" | "),
      },
    ];
    await downloadSpreadsheet(
      `jakarta-atlas-restoran-${dateStamp()}`,
      filtered,
      columns,
      format,
      "Restoran"
    );
  }

  function verify() {
    setRefreshError(null);
    startRefresh(async () => {
      try {
        const res = await fetch("/api/refresh", { cache: "no-store" });
        const data = await res.json();
        setRefreshResult({
          checkedAt: data.checkedAt,
          totalSources: data.totalSources,
          reachable: data.reachable,
          results: data.results ?? [],
        });
        setDetailsOpen(true);
      } catch {
        setRefreshError(t("verify.error"));
      }
    });
  }

  function formatRelativeCheck(iso: string): string {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const s = Math.floor(diff / 1000);
    if (s < 60) return t("verify.time_seconds", { n: s });
    const m = Math.floor(s / 60);
    if (m < 60) return t("verify.time_minutes", { n: m });
    const h = Math.floor(m / 60);
    return t("verify.time_hours", { n: h });
  }

  return (
    <main className="min-h-screen bg-canvas">
      <AtlasNav
        view="list"
        langToggle={<AtlasLangToggle lang={lang} onToggle={onToggleLang} t={t} />}
        rightSlot={
          <VerifyControl
            refreshing={refreshing}
            result={refreshResult}
            error={refreshError}
            detailsOpen={detailsOpen}
            onVerify={verify}
            onToggleDetails={() => setDetailsOpen((v) => !v)}
            formatRelative={formatRelativeCheck}
            t={t}
          />
        }
      />
      {detailsOpen && refreshResult && (
        <VerifyDetails
          result={refreshResult}
          urlLabelMap={urlLabelMap}
          onClose={() => setDetailsOpen(false)}
          t={t}
        />
      )}

      {/* ── HERO TILE (white, full-bleed) ── */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[1280px] px-6 py-[80px] md:py-[120px] text-center">
          <p className="apple-caption-strong text-ink-muted-80 appear" style={{ animationDelay: "0ms" }}>
            {t("hero.eyebrow")}
          </p>
          <h1 className="apple-hero apple-title-tight mt-3 text-ink appear" style={{ animationDelay: "80ms" }}>
            {t("hero.title_a")}
            <br />
            <span className="text-ink-muted-48">{t("hero.title_b")}</span>
          </h1>
          <p
            className="apple-lead mt-6 max-w-[760px] mx-auto appear"
            style={{ animationDelay: "160ms" }}
          >
            {t("hero.lead_prefix")}{" "}
            <span className="text-ink">
              {t("hero.lead_count", { n: stats.total })}
            </span>{" "}
            {t("hero.lead_suffix")}
          </p>
          <div
            className="mt-9 flex items-center justify-center gap-4 appear"
            style={{ animationDelay: "240ms" }}
          >
            <a href="#directory" className="press-scale pill-primary">
              {t("hero.cta_browse")}
            </a>
            <a href="#sources" className="press-scale pill-secondary">
              {t("hero.cta_how")}
            </a>
          </div>
        </div>
      </section>

      {/* ── STATS TILE (parchment) ── */}
      <section className="bg-parchment border-y border-hairline">
        <div className="mx-auto max-w-[1280px] px-6 py-[64px] md:py-[80px] grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6 text-center">
          <Stat number={String(stats.total)} label={t("stat.establishments")} />
          <Stat number={String(stats.cuisines)} label={t("stat.cuisines")} />
          <Stat
            number={stats.avgRating ? stats.avgRating.toFixed(2) : "—"}
            label={t("stat.avg_rating")}
            small="/5"
          />
          <Stat number={String(stats.ratedCount)} label={t("stat.rated_count")} />
        </div>
      </section>

      {/* ── TOOLBAR (frosted, sticky under sub-nav) ──
       *  Two clean rows so the search field always gets full width and
       *  the filter chips align without squishing.
       */}
      <section
        id="filters"
        className="sticky top-[56px] z-10 frosted"
      >
        <div className="mx-auto max-w-[1280px] px-6 py-3 space-y-3">
          {/* Row 1 — search + count chip + export (single line) */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <svg
                viewBox="0 0 24 24"
                className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted-48"
                aria-hidden
              >
                <path
                  fill="currentColor"
                  d="M10 18a8 8 0 1 1 5.293-1.707l4.207 4.207-1.414 1.414-4.207-4.207A7.96 7.96 0 0 1 10 18zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"
                />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("toolbar.search_placeholder")}
                className="w-full bg-canvas border border-hairline rounded-lg pl-11 pr-16 h-10 text-[14px] placeholder:text-ink-muted-48 focus:outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-ring)] transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 apple-caption tabular text-ink-muted-48">
                {filtered.length}/{restaurants.length}
              </span>
            </div>
            <ViewToggle value={viewMode} onChange={onSetViewMode} t={t} />
            <ExportButton
              onExport={exportRestaurants}
              label={t("export.csv")}
            />
          </div>

          {/* Row 2 — filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Pill
              renderAs="select"
              value={city}
              options={cityOptions.map((c) => ({
                id: c,
                label: c === "All" ? t("toolbar.city_all") : t(`city.${c}`),
              }))}
              onChange={setCity}
            />
            <Pill
              renderAs="select"
              value={cuisine}
              options={cuisineOptions.map((c) => ({
                id: c,
                label: c === "All" ? t("toolbar.cuisine_all") : c,
              }))}
              onChange={setCuisine}
            />
            <span className="hidden md:inline-block h-5 w-px bg-hairline mx-1" />
            <Segmented
              options={CATEGORIES.map((c) => ({
                id: c,
                label:
                  c === "All"
                    ? t("toolbar.cat.all")
                    : c === "Food"
                    ? t("toolbar.cat.food")
                    : c === "Beverage"
                    ? t("toolbar.cat.beverage")
                    : t("toolbar.cat.both"),
              }))}
              value={category}
              onChange={(v) => setCategory(v as Category)}
            />
            <span className="hidden md:inline-block h-5 w-px bg-hairline mx-1" />
            <Segmented
              options={SORT_KEYS.map((s) => ({ id: s.id, label: t(s.tKey) }))}
              value={sort}
              onChange={(v) => setSort(v as SortId)}
            />
          </div>
        </div>
      </section>

      {/* ── DIRECTORY (cards or rows depending on view mode) ── */}
      <section id="directory" className="bg-canvas">
        <div className="mx-auto max-w-[1280px] px-6 py-10 md:py-14">
          {filtered.length === 0 ? (
            <div className="py-24 text-center">
              <p className="apple-display-lg text-ink">{t("empty.title")}</p>
              <p className="apple-lead mt-3 text-ink-muted-48">
                {t("empty.hint")}{" "}
                <span className="text-primary">Senopati</span>,{" "}
                <span className="text-primary">Menteng</span>,{" "}
                <span className="text-primary">SCBD</span>.
              </p>
            </div>
          ) : viewMode === "cards" ? (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => (
                <Card key={r.id} r={r} t={t} />
              ))}
            </ul>
          ) : (
            <ListView restaurants={filtered} t={t} />
          )}
        </div>
      </section>

      {/* ── FOOTER (parchment) ── */}
      <footer id="sources" className="bg-parchment border-t border-hairline">
        <div className="mx-auto max-w-[1280px] px-6 py-16 grid md:grid-cols-12 gap-8">
          <div className="md:col-span-6">
            <p className="apple-caption-strong text-ink">{t("footer.about_title")}</p>
            <p className="apple-body mt-3 text-ink-muted-80 max-w-[60ch]">
              {t("footer.about_body")}
            </p>
          </div>
          <div className="md:col-span-3">
            <p className="apple-caption-strong text-ink">{t("footer.inspect")}</p>
            <ul className="mt-3 space-y-2.5 apple-body">
              <li>
                <a className="link-blue" href="/api/restaurants" target="_blank" rel="noopener noreferrer">
                  {t("footer.raw_json")}
                </a>
              </li>
              <li>
                <a className="link-blue" href="/api/refresh" target="_blank" rel="noopener noreferrer">
                  {t("footer.source_liveness")}
                </a>
              </li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <p className="apple-caption-strong text-ink">{t("footer.coverage")}</p>
            <ul className="mt-3 space-y-2.5 apple-body text-ink-muted-80">
              <li>{t("footer.coverage.estab", { n: stats.total })}</li>
              <li>{t("footer.coverage.cuisines", { n: stats.cuisines })}</li>
              <li>{t("footer.coverage.rated", { n: stats.ratedCount })}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-hairline">
          <div className="mx-auto max-w-[1280px] px-6 py-5 apple-fine text-ink-muted-48 flex items-center justify-between">
            <span>{t("footer.copyright", { year: new Date().getUTCFullYear() })}</span>
            <span>{t("footer.typeface")}</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ────────────────────────  STAT  ──────────────────────── */

function Stat({
  number,
  label,
  small,
}: {
  number: string;
  label: string;
  small?: string;
}) {
  return (
    <div>
      <div className="apple-hero apple-title-tight text-ink tabular">
        {number}
        {small && (
          <span className="text-ink-muted-48 text-[0.4em] align-middle ml-1">
            {small}
          </span>
        )}
      </div>
      <p className="apple-caption text-ink-muted-80 mt-1">{label}</p>
    </div>
  );
}

/* ────────────────────────  CARD  ──────────────────────── */

type TFn = (key: string, vars?: Record<string, string | number>) => string;

function Card({ r, t }: { r: Restaurant; t: TFn }) {
  return (
    <li className="utility-card group bg-canvas border border-hairline rounded-apple_lg overflow-hidden flex flex-col">
      {/* Map preview — the "product image" slot per DESIGN.md store-utility-card. */}
      <a
        href={googleMapsUrl(r)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t("card.open_maps")} — ${r.name}`}
        className="relative block bg-parchment border-b border-hairline overflow-hidden group/map"
      >
        <div className="aspect-[16/9] w-full">
          <iframe
            src={mapsEmbedUrl(r)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full pointer-events-none select-none"
            title={`Map — ${r.name}`}
            aria-hidden="true"
          />
        </div>
        <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 bg-canvas/95 backdrop-blur border border-hairline rounded-full px-2.5 py-1 apple-fine text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)] opacity-0 group-hover/map:opacity-100 transition-opacity duration-200">
          {t("card.open_chip")}
        </span>
      </a>

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="apple-caption-strong text-primary tracking-[0.06em] text-[11px] uppercase truncate">
            {r.cuisine}
          </p>
          <span
            className={`shrink-0 apple-fine uppercase tracking-wider px-1.5 py-0.5 rounded ${
              r.source === "curated"
                ? "bg-primary/10 text-primary"
                : "bg-ink-muted-80/10 text-ink-muted-80"
            }`}
            title={
              r.source === "curated"
                ? t("card.source_curated_full")
                : t("card.source_osm_full")
            }
          >
            {r.source === "curated"
              ? t("card.source_curated")
              : t("card.source_osm")}
          </span>
        </div>

        <h3 className="apple-tagline apple-title-tight text-ink mt-1.5 leading-[1.15]">
          {r.name}
        </h3>

        <p className="apple-caption text-ink-muted-48 mt-1">
          {r.area}
          {r.priceRange && (
            <>
              <span className="mx-1.5 text-ink-muted-48/60">·</span>
              <span className="text-ink-muted-80">{r.priceRange}</span>
              <span className="text-ink-muted-48"> {t(PRICE_T_KEYS[r.priceRange])}</span>
            </>
          )}
        </p>

        {r.rating != null && (
          <p className="apple-caption mt-4 flex items-center gap-1.5 text-ink">
            <StarIcon />
            <span className="apple-caption-strong tabular">
              {r.rating.toFixed(1)}
            </span>
            {r.reviewCount != null && r.reviewCount > 0 && (
              <span className="text-ink-muted-48">
                · {formatReviews(r.reviewCount)} {t("card.reviews")}
                {r.ratingSource && ` · ${r.ratingSource}`}
              </span>
            )}
          </p>
        )}

        {r.description && (
          <p className="apple-caption text-ink-muted-80 mt-3 line-clamp-3">
            {r.description}
          </p>
        )}

        {r.source === "osm" && !r.description && (
          <p className="apple-caption text-ink-muted-48 mt-3 italic">
            {t("card.osm_note")}
          </p>
        )}

        <div className="mt-auto pt-5 flex items-center justify-between gap-4">
          <a
            href={googleMapsUrl(r)}
            target="_blank"
            rel="noopener noreferrer"
            className="press-scale link-blue apple-caption-strong inline-flex items-center gap-1"
          >
            {t("card.open_maps")}
            <span aria-hidden>↗</span>
          </a>
          {r.sources[0] && (
            <a
              href={r.sources[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="press-scale link-blue apple-caption inline-flex items-center gap-1"
              title={r.sources[0].label}
            >
              {t("card.source")}
              <span aria-hidden>↗</span>
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

/* ──────────────────────  LANGUAGE TOGGLE  ──────────────────── */

function LangToggle({
  lang,
  onToggle,
  t,
}: {
  lang: Lang;
  onToggle: () => void;
  t: TFn;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch language to ${t("nav.switch_to")}`}
      title={`Switch to ${t("nav.switch_to")}`}
      className="press-scale inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas px-2.5 py-1.5 hover:border-ink-muted-48 transition-colors"
    >
      <span className="apple-caption-strong tabular text-ink uppercase tracking-wider">
        {lang.toUpperCase()}
      </span>
      <span className="apple-fine text-ink-muted-48">/</span>
      <span className="apple-fine tabular text-ink-muted-48 uppercase tracking-wider">
        {t("nav.switch_to")}
      </span>
    </button>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
      />
    </svg>
  );
}

/* ──────────────────  SEGMENTED CONTROL  ────────────────── */

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex p-1 bg-canvas border border-hairline rounded-full">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`press-scale rounded-full px-3.5 py-1.5 apple-caption ${
              active
                ? "bg-primary text-white"
                : "text-ink-muted-80 hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────  PILL SELECT  ──────────────────── */

function Pill({
  value,
  options,
  onChange,
}: {
  renderAs: "select";
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
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
        <path
          fill="currentColor"
          d="M7 10l5 5 5-5z"
        />
      </svg>
    </div>
  );
}

/* ──────────────────  VERIFY CONTROL  ──────────────────── */

type VerifyResult = {
  checkedAt: string;
  totalSources: number;
  reachable: number;
  results: { url: string; ok: boolean; status: number }[];
};

function VerifyControl({
  refreshing,
  result,
  error,
  detailsOpen,
  onVerify,
  onToggleDetails,
  formatRelative,
  t,
}: {
  refreshing: boolean;
  result: VerifyResult | null;
  error: string | null;
  detailsOpen: boolean;
  onVerify: () => void;
  onToggleDetails: () => void;
  formatRelative: (iso: string) => string;
  t: TFn;
}) {
  // Compact pill — matches the height of neighbouring nav controls
  // (Daftar/Peta tabs, lang toggle). The default `.pill-primary` is
  // sized for hero CTAs; here we want sub-nav rhythm.
  const compactBase =
    "press-scale inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 apple-caption-strong";

  if (!refreshing && !result && !error) {
    return (
      <button
        onClick={onVerify}
        className={`${compactBase} bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-deep)]`}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-200" />
        {t("verify.idle")}
      </button>
    );
  }

  if (refreshing) {
    return (
      <div
        className={`${compactBase} bg-[color:var(--accent)] text-white cursor-progress`}
      >
        <Spinner />
        {t("verify.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <button
        onClick={onVerify}
        className="press-scale inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas px-3 py-1.5 apple-caption text-ink hover:border-ink-muted-48 transition-colors"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
        {error}
        <span className="text-primary">{t("verify.retry")}</span>
      </button>
    );
  }

  const r = result!;
  const allOk = r.reachable === r.totalSources;
  const someFail = r.reachable < r.totalSources && r.reachable > 0;
  const dotClass = allOk
    ? "bg-emerald-500"
    : someFail
    ? "bg-amber-500"
    : "bg-rose-500";

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={onToggleDetails}
        aria-expanded={detailsOpen}
        className="press-scale inline-flex items-center gap-2 rounded-full bg-canvas border border-hairline pl-2.5 pr-2 py-1.5 hover:border-ink-muted-48 transition-colors"
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />
        <span className="apple-caption-strong tabular text-ink">
          {r.reachable}/{r.totalSources}
        </span>
        <span className="apple-caption text-ink-muted-48">{t("verify.sources_live")}</span>
        <span className="apple-fine text-ink-muted-48">
          · {formatRelative(r.checkedAt)}
        </span>
        <Chevron open={detailsOpen} />
      </button>
      <button
        onClick={onVerify}
        title={t("verify.reverify")}
        className="press-scale inline-flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-canvas hover:border-ink-muted-48 transition-colors"
        aria-label={t("verify.reverify")}
      >
        <RotateIcon />
      </button>
    </div>
  );
}

function VerifyDetails({
  result,
  urlLabelMap,
  onClose,
  t,
}: {
  result: VerifyResult;
  urlLabelMap: Map<string, string>;
  onClose: () => void;
  t: TFn;
}) {
  const reachable = result.results.filter((x) => x.ok);
  const unreachable = result.results.filter((x) => !x.ok);
  return (
    <div className="border-t border-hairline bg-canvas/95">
      <div className="mx-auto max-w-[1280px] px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <p className="apple-caption-strong text-ink">
            {t("verify.details.title")}
            <span className="ml-2 apple-caption text-ink-muted-48">
              {t("verify.details.checked", {
                date: new Date(result.checkedAt).toLocaleString("en-GB", {
                  hour12: false,
                }),
              })}
            </span>
          </p>
          <button
            onClick={onClose}
            aria-label={t("verify.details.close")}
            className="press-scale inline-flex h-7 w-7 items-center justify-center rounded-full border border-hairline bg-canvas hover:border-ink-muted-48 transition-colors apple-caption"
          >
            ✕
          </button>
        </div>

        <p className="apple-caption text-ink-muted-80">
          {result.reachable === result.totalSources
            ? t("verify.details.summary_ok", { total: result.totalSources })
            : t("verify.details.summary_partial", {
                reachable: result.reachable,
                total: result.totalSources,
                failed: unreachable.length,
              })}
        </p>

        <div className="mt-4 grid gap-1.5 max-h-[260px] overflow-y-auto pr-1">
          {[...reachable, ...unreachable].map((row) => {
            const label =
              urlLabelMap.get(row.url) ??
              new URL(row.url).hostname.replace(/^www\./, "");
            return (
              <a
                key={row.url}
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group grid grid-cols-[16px_1fr_64px_64px] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-parchment transition-colors"
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full justify-self-center ${
                    row.ok
                      ? "bg-emerald-500"
                      : row.status >= 500 || row.status === 0
                      ? "bg-rose-500"
                      : "bg-amber-500"
                  }`}
                  aria-hidden
                />
                <span className="apple-caption text-ink truncate group-hover:text-primary transition-colors">
                  {label}
                </span>
                <span className="apple-fine text-ink-muted-48 tabular text-right">
                  {row.status || "—"}
                </span>
                <span className="apple-fine text-ink-muted-48 text-right">
                  {row.ok
                    ? t("verify.details.status_ok")
                    : t("verify.details.status_blocked")}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-spin" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3 w-3 text-ink-muted-48 transition-transform ${
        open ? "rotate-180" : ""
      }`}
      aria-hidden
    >
      <path fill="currentColor" d="M7 10l5 5 5-5z" />
    </svg>
  );
}

function RotateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-ink-muted-80" aria-hidden>
      <path
        fill="currentColor"
        d="M12 5V2L7 6l5 4V7c2.76 0 5 2.24 5 5a5 5 0 0 1-9.58 2H5.34A7 7 0 1 0 12 5z"
      />
    </svg>
  );
}

/* ──────────────────────  VIEW TOGGLE  ──────────────────── */

function ViewToggle({
  value,
  onChange,
  t,
}: {
  value: "cards" | "rows";
  onChange: (v: "cards" | "rows") => void;
  t: TFn;
}) {
  return (
    <div
      className="inline-flex p-0.5 bg-canvas border border-hairline rounded-full"
      role="radiogroup"
      aria-label="View mode"
    >
      <button
        role="radio"
        aria-checked={value === "cards"}
        onClick={() => onChange("cards")}
        className={`press-scale rounded-full px-3 py-1.5 apple-caption-strong inline-flex items-center gap-1.5 ${
          value === "cards"
            ? "bg-ink text-white"
            : "text-ink-muted-80 hover:text-ink"
        }`}
      >
        <CardsIcon />
        <span className="hidden sm:inline">{t("view.cards")}</span>
      </button>
      <button
        role="radio"
        aria-checked={value === "rows"}
        onClick={() => onChange("rows")}
        className={`press-scale rounded-full px-3 py-1.5 apple-caption-strong inline-flex items-center gap-1.5 ${
          value === "rows"
            ? "bg-ink text-white"
            : "text-ink-muted-80 hover:text-ink"
        }`}
      >
        <ListIcon />
        <span className="hidden sm:inline">{t("view.rows")}</span>
      </button>
    </div>
  );
}

function CardsIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ──────────────────────  LIST VIEW  ──────────────────── */

function ListView({
  restaurants,
  t,
}: {
  restaurants: Restaurant[];
  t: TFn;
}) {
  return (
    <div className="border border-hairline rounded-apple_lg overflow-hidden bg-canvas">
      {/* Sticky header row */}
      <div className="hidden md:grid grid-cols-[44px_minmax(0,1fr)_180px_120px_70px_120px] items-center gap-3 px-4 py-3 bg-paper border-b border-hairline atlas-mono text-ink-muted-48">
        <span className="text-right">#</span>
        <span>{t("list.header.place")}</span>
        <span className="text-right">{t("list.header.rating")}</span>
        <span>{t("list.header.cuisine")}</span>
        <span className="text-right">{t("list.header.price")}</span>
        <span className="text-right">{t("list.header.actions")}</span>
      </div>
      <ol>
        {restaurants.map((r, i) => (
          <ListRow key={r.id} r={r} index={i + 1} t={t} />
        ))}
      </ol>
    </div>
  );
}

function ListRow({
  r,
  index,
  t,
}: {
  r: Restaurant;
  index: number;
  t: TFn;
}) {
  return (
    <li className="grid grid-cols-[44px_minmax(0,1fr)] md:grid-cols-[44px_minmax(0,1fr)_180px_120px_70px_120px] items-center gap-3 px-4 py-3.5 border-b border-divider hover:bg-paper transition-colors">
      <span className="atlas-mono text-ink-muted-48 tabular text-right">
        {String(index).padStart(3, "0")}
      </span>

      {/* Place */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="apple-body-strong text-ink truncate">{r.name}</span>
          <span
            className={`shrink-0 apple-fine uppercase tracking-wider px-1.5 py-0.5 rounded ${
              r.source === "curated"
                ? "bg-[color:var(--accent-bg)] text-[color:var(--accent)]"
                : "bg-ink-muted-80/10 text-ink-muted-80"
            }`}
          >
            {r.source === "curated"
              ? t("card.source_curated")
              : t("card.source_osm")}
          </span>
        </div>
        <p className="apple-fine text-ink-muted-48 truncate mt-0.5 md:hidden">
          {r.cuisine} · {r.area}
        </p>
        <p className="apple-fine text-ink-muted-48 truncate mt-0.5 hidden md:block">
          {r.area}
        </p>
      </div>

      {/* Rating (md+) */}
      <div className="hidden md:flex items-baseline justify-end gap-1.5">
        {r.rating != null ? (
          <>
            <StarIcon />
            <span className="apple-caption-strong tabular text-ink">
              {r.rating.toFixed(1)}
            </span>
            {r.reviewCount != null && r.reviewCount > 0 && (
              <span className="apple-fine tabular text-ink-muted-48">
                · {formatReviews(r.reviewCount)}
              </span>
            )}
          </>
        ) : (
          <span className="apple-fine text-ink-muted-48">—</span>
        )}
      </div>

      {/* Cuisine (md+) */}
      <span className="hidden md:block apple-caption text-ink-muted-80 truncate">
        {r.cuisine}
      </span>

      {/* Price (md+) */}
      <span className="hidden md:block text-right">
        {r.priceRange ? (
          <span className="apple-caption-strong text-[color:var(--accent)] tabular">
            {r.priceRange}
          </span>
        ) : (
          <span className="apple-fine text-ink-muted-48">—</span>
        )}
      </span>

      {/* Actions (md+) */}
      <div className="hidden md:flex items-center justify-end gap-3 apple-fine">
        <a
          href={googleMapsUrl(r)}
          target="_blank"
          rel="noopener noreferrer"
          className="link-blue inline-flex items-center gap-0.5 apple-caption-strong"
        >
          Maps <span aria-hidden>↗</span>
        </a>
        {r.sources[0] && (
          <a
            href={r.sources[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="link-blue inline-flex items-center gap-0.5"
          >
            {t("card.source")} <span aria-hidden>↗</span>
          </a>
        )}
      </div>
    </li>
  );
}
