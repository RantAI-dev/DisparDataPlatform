"use client";

/**
 * ATLAS — Toko Suvenir Jakarta, tampilan DAFTAR.
 *
 * Konsep 1:1 dengan section Direktori Restoran (components/Dashboard.tsx):
 * AtlasNav toggle List|Map → hero tile → stats tile (parchment) → toolbar
 * sticky (cari + toggle grid/tabel + unduh, lalu baris filter) → grid kartu
 * dengan slot preview peta di atas seperti "store utility card" di DESIGN.md.
 * Petanya sendiri halaman terpisah: /atlas/souvenir/map (SouvenirMapView).
 *
 * Catatan data: TripAdvisor menaruh banyak usaha non-suvenir di kategori
 * "Gift & Specialty Shops", jadi filter relevansi default = "Toko suvenir"
 * (Ya + Sebagian) supaya angka yang tampil tidak menyesatkan.
 */
import { useMemo, useState } from "react";

import { AtlasNav } from "@/components/atlas/AtlasNav";
import { ExportButton } from "@/components/atlas/ExportButton";
import {
  SOUVENIR_SHOPS,
  souvenirEmbedUrl,
  souvenirMapsUrl,
  souvenirProducts,
  type SouvenirShop,
} from "@/lib/souvenir";
import {
  type CsvColumn,
  type ExportFormat,
  dateStamp,
  downloadSpreadsheet,
} from "@/lib/export";

const RELEVANCE = ["Toko suvenir", "Suvenir murni", "Sebagian", "Semua"] as const;
type Relevance = (typeof RELEVANCE)[number];

const SORTS = [
  { id: "reviews", label: "Ulasan terbanyak" },
  { id: "rating", label: "Rating tertinggi" },
  { id: "name", label: "Nama A–Z" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

function matchesRelevance(s: SouvenirShop, f: Relevance): boolean {
  if (f === "Semua") return true;
  if (f === "Suvenir murni") return s.relevance === "Ya";
  if (f === "Sebagian") return s.relevance === "Sebagian";
  return s.relevance === "Ya" || s.relevance === "Sebagian";
}

/** "?" = produk belum terverifikasi; jangan ditampilkan mentah sebagai label. */
const productLabel = (s: SouvenirShop): string =>
  s.product && s.product !== "?" ? s.product : s.category;

function formatReviews(n?: number): string {
  if (n == null) return "";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString("id-ID");
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[color:var(--accent)]" aria-hidden>
      <path
        fill="currentColor"
        d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9L12 3z"
      />
    </svg>
  );
}

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
        {small && <span className="apple-lead text-ink-muted-48"> {small}</span>}
      </div>
      <div className="apple-caption text-ink-muted-80 mt-1.5">{label}</div>
    </div>
  );
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

/** Badge relevansi — sejajar dengan badge sumber curated/OSM di kartu restoran. */
function RelevanceBadge({ s }: { s: SouvenirShop }) {
  const map: Record<string, { text: string; cls: string; title: string }> = {
    Ya: {
      text: "SUVENIR",
      cls: "bg-primary/10 text-primary",
      title: "Toko suvenir/oleh-oleh/kerajinan",
    },
    Sebagian: {
      text: "SEBAGIAN",
      cls: "bg-[color:var(--accent)]/10 text-[color:var(--accent)]",
      title: "Pasar/mal — suvenir hanya sebagian dari isinya",
    },
    Tidak: {
      text: "NON-SUVENIR",
      cls: "bg-ink-muted-80/10 text-ink-muted-80",
      title: "Dikategorikan TripAdvisor sebagai gift shop, tapi bukan toko suvenir",
    },
  };
  const v = map[s.relevance] ?? {
    text: "BELUM TERVERIFIKASI",
    cls: "bg-ink-muted-80/10 text-ink-muted-80",
    title: "Relevansi belum terverifikasi",
  };
  return (
    <span
      className={`shrink-0 apple-fine uppercase tracking-wider px-1.5 py-0.5 rounded ${v.cls}`}
      title={v.title}
    >
      {v.text}
    </span>
  );
}

function Card({ s }: { s: SouvenirShop }) {
  return (
    <li className="utility-card group bg-canvas border border-hairline rounded-apple_lg overflow-hidden flex flex-col">
      <a
        href={souvenirMapsUrl(s)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Buka di Google Maps — ${s.name}`}
        className="relative block bg-parchment border-b border-hairline overflow-hidden group/map"
      >
        <div className="aspect-[16/9] w-full">
          <iframe
            src={souvenirEmbedUrl(s)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full pointer-events-none select-none"
            title={`Peta — ${s.name}`}
            aria-hidden="true"
          />
        </div>
        <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 bg-canvas/95 backdrop-blur border border-hairline rounded-full px-2.5 py-1 apple-fine text-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)] opacity-0 group-hover/map:opacity-100 transition-opacity duration-200">
          Buka peta
        </span>
      </a>

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="apple-caption-strong text-primary tracking-[0.06em] text-[11px] uppercase truncate">
            {productLabel(s)}
          </p>
          <RelevanceBadge s={s} />
        </div>

        <h3 className="apple-tagline apple-title-tight text-ink mt-1.5 leading-[1.15]">
          {s.name}
        </h3>

        <p className="apple-caption text-ink-muted-48 mt-1">
          {[s.district, s.city].filter(Boolean).join(" · ")}
        </p>

        {s.rating != null && (
          <p className="apple-caption mt-4 flex items-center gap-1.5 text-ink">
            <StarIcon />
            <span className="apple-caption-strong tabular">
              {s.rating.toFixed(1).replace(".", ",")}
            </span>
            {s.reviews != null && s.reviews > 0 && (
              <span className="text-ink-muted-48">
                · {formatReviews(s.reviews)} ulasan · TripAdvisor
              </span>
            )}
          </p>
        )}

        {s.address && (
          <p className="apple-caption text-ink-muted-80 mt-3 line-clamp-2">
            {s.address}
          </p>
        )}

        {s.coordSource === "Koreksi riset" && (
          <p className="apple-fine text-ink-muted-48 mt-2 italic">
            Koordinat telah dikoreksi.
          </p>
        )}

        <div className="mt-auto pt-5 flex items-center justify-between gap-4">
          <a
            href={souvenirMapsUrl(s)}
            target="_blank"
            rel="noopener noreferrer"
            className="press-scale link-blue apple-caption-strong inline-flex items-center gap-1"
          >
            Buka di Maps
            <span aria-hidden>↗</span>
          </a>
          {s.url && (
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="press-scale link-blue apple-caption inline-flex items-center gap-1"
              title="Halaman TripAdvisor"
            >
              Sumber
              <span aria-hidden>↗</span>
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export function SouvenirView() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("All");
  const [product, setProduct] = useState("All");
  const [relevance, setRelevance] = useState<Relevance>("Toko suvenir");
  const [sort, setSort] = useState<SortId>("reviews");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const cityOptions = useMemo(() => {
    const set = new Set(
      SOUVENIR_SHOPS.map((s) => s.city).filter((c): c is string => !!c)
    );
    return ["All", ...[...set].sort()];
  }, []);
  const productOptions = useMemo(() => ["All", ...souvenirProducts()], []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = SOUVENIR_SHOPS.filter((s) => {
      if (!matchesRelevance(s, relevance)) return false;
      if (city !== "All" && s.city !== city) return false;
      if (product !== "All" && s.product !== product) return false;
      if (!q) return true;
      return [s.name, s.product, s.address, s.district, s.city]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
    return rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "id");
      if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      return (b.reviews ?? 0) - (a.reviews ?? 0);
    });
  }, [query, city, product, relevance, sort]);

  const stats = useMemo(() => {
    const ya = SOUVENIR_SHOPS.filter((s) => s.relevance === "Ya").length;
    const rated = SOUVENIR_SHOPS.filter((s) => s.rating != null);
    const avg = rated.length
      ? rated.reduce((n, s) => n + (s.rating as number), 0) / rated.length
      : 0;
    return {
      total: SOUVENIR_SHOPS.length,
      ya,
      // Hanya yang tegas BUKAN toko suvenir. Jangan pakai total-ya: itu ikut
      // menyapu "Sebagian" (pasar/mal) dan yang belum terverifikasi.
      tidak: SOUVENIR_SHOPS.filter((s) => s.relevance === "Tidak").length,
      sebagian: SOUVENIR_SHOPS.filter((s) => s.relevance === "Sebagian").length,
      belumPasti: SOUVENIR_SHOPS.filter(
        (s) => !["Ya", "Sebagian", "Tidak"].includes(s.relevance)
      ).length,
      avg,
      geo: SOUVENIR_SHOPS.filter((s) => s.lat != null).length,
    };
  }, []);

  async function exportSouvenir(format: ExportFormat) {
    const columns: CsvColumn<SouvenirShop>[] = [
      { header: "No", value: (_s, i) => i + 1 },
      { header: "Nama", value: (s) => s.name },
      { header: "Kategori TripAdvisor", value: (s) => s.category },
      { header: "Relevan Suvenir", value: (s) => s.relevance },
      { header: "Produk Utama", value: (s) => s.product ?? "" },
      { header: "Alamat", value: (s) => s.address ?? "" },
      { header: "Kota Administrasi", value: (s) => s.city ?? "" },
      { header: "Kecamatan", value: (s) => s.district ?? "" },
      { header: "Lintang", value: (s) => s.lat ?? "" },
      { header: "Bujur", value: (s) => s.lng ?? "" },
      { header: "Sumber Koordinat", value: (s) => s.coordSource ?? "" },
      { header: "Telepon", value: (s) => s.phone ?? "" },
      { header: "Rating", value: (s) => s.rating ?? "" },
      { header: "Jumlah Ulasan", value: (s) => s.reviews ?? "" },
      { header: "Status", value: (s) => s.status ?? "" },
      { header: "Catatan", value: (s) => s.note ?? "" },
      { header: "URL TripAdvisor", value: (s) => s.url ?? "" },
    ];
    await downloadSpreadsheet(
      `jakarta-atlas-suvenir-${dateStamp()}`,
      filtered,
      columns,
      format,
      "Suvenir"
    );
  }

  return (
    <main className="min-h-screen bg-canvas">
      <AtlasNav view="list" />

      {/* ── HERO TILE ── */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[1280px] px-6 py-[80px] md:py-[120px] text-center">
          <p className="apple-caption-strong text-ink-muted-80">
            Data sekunder · Daya tarik belanja (GPCI CI-SH)
          </p>
          <h1 className="apple-hero apple-title-tight mt-3 text-ink">
            Toko suvenir Jakarta,
            <br />
            <span className="text-ink-muted-48">sudah disaring.</span>
          </h1>
          <p className="apple-lead mt-6 max-w-[760px] mx-auto">
            <span className="text-ink">{stats.total} listing</span> TripAdvisor
            kategori Shopping, ditandai satu per satu mana yang benar-benar toko
            suvenir — karena {stats.tidak} di antaranya ternyata money changer,
            service HP, dan toko elektronik.
          </p>
          <div className="mt-9 flex items-center justify-center gap-4">
            <a href="#directory" className="press-scale pill-primary">
              Lihat daftar
            </a>
          </div>
        </div>
      </section>

      {/* ── STATS TILE ── */}
      <section className="bg-parchment border-y border-hairline">
        <div className="mx-auto max-w-[1280px] px-6 py-[64px] md:py-[80px] grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6 text-center">
          <Stat number={String(stats.total)} label="Listing terdata" />
          <Stat number={String(stats.ya)} label="Toko suvenir murni" />
          <Stat
            number={stats.avg ? stats.avg.toFixed(2).replace(".", ",") : "—"}
            label="Rating rata-rata"
            small="/5"
          />
          <Stat number={String(stats.geo)} label="Titik berkoordinat" />
        </div>
      </section>

      {/* ── TOOLBAR ── */}
      <section id="filters" className="sticky top-[56px] z-10 frosted">
        <div className="mx-auto max-w-[1280px] px-6 py-3 space-y-3">
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
                placeholder="Cari nama toko, produk, atau alamat…"
                className="w-full bg-canvas border border-hairline rounded-lg pl-11 pr-16 h-10 text-[14px] placeholder:text-ink-muted-48 focus:outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-ring)] transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 apple-caption tabular text-ink-muted-48">
                {filtered.length}/{SOUVENIR_SHOPS.length}
              </span>
            </div>
            <div className="inline-flex p-0.5 bg-canvas border border-hairline rounded-full">
              {(["grid", "table"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`press-scale rounded-full px-3 py-1 apple-caption-strong ${
                    viewMode === m
                      ? "bg-ink text-white"
                      : "text-ink-muted-80 hover:text-ink"
                  }`}
                >
                  {m === "grid" ? "Kartu" : "Tabel"}
                </button>
              ))}
            </div>
            <ExportButton onExport={exportSouvenir} label="Unduh" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
            <span className="hidden md:inline-block h-5 w-px bg-hairline mx-1" />
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
            <span className="hidden md:inline-block h-5 w-px bg-hairline mx-1" />
            <MiniSelect
              value={sort}
              onChange={(v) => setSort(v as SortId)}
              options={SORTS.map((s) => ({ id: s.id, label: s.label }))}
            />
          </div>
        </div>
      </section>

      {/* ── DIRECTORY ── */}
      <section id="directory" className="mx-auto max-w-[1280px] px-6 py-12">
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="apple-tagline text-ink">Tidak ada toko yang cocok</p>
            <p className="apple-caption text-ink-muted-48 mt-2">
              Coba longgarkan filter atau kosongkan kolom pencarian.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((s) => (
              <Card key={s.id} s={s} />
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto border border-hairline rounded-apple_lg bg-canvas">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-hairline bg-parchment">
                  {["Nama", "Produk", "Wilayah", "Rating", "Relevansi", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="apple-caption-strong text-ink-muted-80 px-4 py-3"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 apple-caption-strong text-ink">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 apple-caption text-ink-muted-80">
                      {s.product && s.product !== "?" ? s.product : "—"}
                    </td>
                    <td className="px-4 py-3 apple-caption text-ink-muted-80">
                      {[s.district, s.city].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 apple-caption tabular text-ink-muted-80">
                      {s.rating != null
                        ? `${s.rating.toFixed(1).replace(".", ",")} (${s.reviews ?? 0})`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <RelevanceBadge s={s} />
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={souvenirMapsUrl(s)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="press-scale link-blue apple-caption whitespace-nowrap"
                      >
                        Maps ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── SOURCES ── */}
      <section id="sources" className="border-t border-hairline bg-parchment">
        <div className="mx-auto max-w-[1280px] px-6 py-12 grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="apple-tagline text-ink">Cara data ini dikumpulkan</h2>
            <p className="apple-caption text-ink-muted-80 mt-3 max-w-[60ch]">
              Data berasal dari TripAdvisor (kategori Shopping, Jakarta) dan
              diverifikasi dengan sumber terbuka.
            </p>
          </div>
          <div>
            <h2 className="apple-tagline text-ink">Yang perlu diperhatikan</h2>
            <ul className="apple-caption text-ink-muted-80 mt-3 space-y-2 max-w-[60ch]">
              <li>
                · Pecahan {stats.total} listing: {stats.ya} toko suvenir murni,{" "}
                {stats.sebagian} pasar/mal yang hanya sebagian menjual suvenir,{" "}
                {stats.tidak} bukan toko suvenir sama sekali
                {stats.belumPasti > 0 &&
                  `, dan ${stats.belumPasti} belum terverifikasi`}
                .
              </li>
              <li>
                · Rating dan ulasan adalah angka TripAdvisor, bukan Google —
                sampelnya kecil untuk toko-toko baru.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline px-6 py-6">
        <p className="atlas-mono text-ink-muted-48 mx-auto max-w-[1280px]">
          SUMBER · TRIPADVISOR + VERIFIKASI SUMBER TERBUKA · DIPERBARUI 29
          JULI 2026
        </p>
      </footer>
    </main>
  );
}
