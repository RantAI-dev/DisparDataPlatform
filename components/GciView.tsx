"use client";

import { useEffect, useMemo, useState } from "react";

import { AtlasNav, LangToggle } from "@/components/atlas/AtlasNav";
import { ExportButton } from "@/components/atlas/ExportButton";
import {
  GCI_RESTAURANTS,
  TIER_ORDER,
  CITY_ORDER,
  gciMapsUrl,
  gciAddress,
  gciStats,
  type GciRestaurant,
  type GciTier,
} from "@/lib/gci";
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
import tripadvisorData from "@/data/sekunder/restoran-tripadvisor-jakarta.json";

const TIER_FILTERS = ["Semua", ...TIER_ORDER] as const;
type TierFilter = (typeof TIER_FILTERS)[number];

const SOURCE_FILTERS = ["Semua", "Ada rating", "Belum ada rating"] as const;
type SourceFilter = (typeof SOURCE_FILTERS)[number];

const PAGE = 200;

// Kolom & baris apa adanya dari hasil crawl TripAdvisor — lihat
// data/sekunder/restoran-tripadvisor-jakarta.json. Kolom "michelin" sengaja
// kosong: Jakarta belum punya restoran berbintang Michelin.
const TA_COLUMNS = tripadvisorData.columns;
const TA_ROWS = tripadvisorData.rows as Record<string, string>[];

/** Rating ditampilkan gaya Indonesia: 4,9 */
function fmtRating(r?: number): string {
  if (r === undefined) return "—";
  return r.toFixed(1).replace(".", ",");
}

export function GciView() {
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  // ?tab=tripadvisor buka langsung tab raw (dipakai link dari katalog /sdi).
  const [view, setView] = useState<"gci" | "tripadvisor">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "tripadvisor") return "tripadvisor";
    }
    return "gci";
  });
  const [taQ, setTaQ] = useState("");
  const [tier, setTier] = useState<TierFilter>("Semua");
  const [city, setCity] = useState<string>("Semua");
  const [src, setSrc] = useState<SourceFilter>("Semua");
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(PAGE);
  // Default: hanya ekspor venue yang punya rating (tidak ada sel kosong).
  const [exportRatedOnly, setExportRatedOnly] = useState(true);

  // localStorage hanya dibaca di klien lewat handler; default 'id' untuk SSR.
  const t = (key: string) => translate(lang, key);

  function onToggleLang() {
    const next: Lang = lang === "id" ? "en" : "id";
    setLang(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  const stats = useMemo(() => gciStats(), []);

  const cityOptions = useMemo(() => {
    const present = new Set(GCI_RESTAURANTS.map((r) => r.city));
    return ["Semua", ...CITY_ORDER.filter((c) => present.has(c))];
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return GCI_RESTAURANTS.filter((r) => {
      if (tier !== "Semua" && r.tier !== tier) return false;
      if (city !== "Semua" && r.city !== city) return false;
      if (src === "Ada rating" && r.rating === undefined) return false;
      if (src === "Belum ada rating" && r.rating !== undefined) return false;
      if (
        needle &&
        !`${r.name} ${r.cuisine} ${r.area} ${r.address ?? ""} ${r.hotel ?? ""}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [tier, city, src, q]);

  // Reset jumlah baris yang ditampilkan setiap filter berubah.
  useEffect(() => {
    setVisible(PAGE);
  }, [tier, city, src, q]);

  const taFiltered = useMemo(() => {
    const needle = taQ.trim().toLowerCase();
    if (!needle) return TA_ROWS;
    return TA_ROWS.filter((row) =>
      TA_COLUMNS.some((c) => String(row[c.key] ?? "").toLowerCase().includes(needle))
    );
  }, [taQ]);

  const paged = filtered.slice(0, visible);

  // Baris yang benar-benar diekspor: ikut filter aktif, dan (default) hanya
  // yang punya rating supaya tidak ada sel Rating/Ulasan yang kosong.
  const exportRows = exportRatedOnly
    ? filtered.filter((r) => r.rating !== undefined)
    : filtered;

  async function exportGci(format: ExportFormat) {
    if (exportRows.length === 0) {
      alert("Tidak ada data untuk diekspor — coba longgarkan filter.");
      return;
    }
    // 7 kolom inti SESUAI Google Sheet GCI, lalu kolom bonus untuk tim.
    const columns: CsvColumn<GciRestaurant>[] = [
      { header: "No.", value: (_r, i) => i + 1 },
      { header: "Nama", value: (r) => r.name },
      { header: "Jenis Cuisine", value: (r) => r.cuisine },
      { header: "Alamat", value: (r) => gciAddress(r) },
      { header: "Rating", value: (r) => (r.rating !== undefined ? fmtRating(r.rating) : "") },
      { header: "Jumlah Ulasan", value: (r) => r.reviewCount ?? "" },
      { header: "Sumber Rating", value: (r) => r.ratingSource },
      // ── kolom bantu (boleh dihapus sebelum submit) ──
      // Area (kawasan) disembunyikan dari kolom utama, datanya tetap disimpan di sini.
      { header: "Area", value: (r) => r.area },
      { header: "Tingkat Harga", value: (r) => (r.priceLevel ? (r.priceSource === "editorial" ? `${r.priceLevel} (perkiraan)` : r.priceLevel) : "") },
      { header: "Tier", value: (r) => r.tier },
      { header: "Hotel", value: (r) => r.hotel ?? "" },
      { header: "Catatan", value: (r) => (r.needsVerify ? "Perlu verifikasi angka" : "") },
      { header: "Google Maps", value: (r) => gciMapsUrl(r) },
    ];
    await downloadSpreadsheet(
      `data-restoran-GCI-${dateStamp()}`,
      exportRows,
      columns,
      format,
      "Restoran GCI"
    );
  }

  return (
    <main data-section="gci" className="min-h-screen flex flex-col bg-paper">
      <AtlasNav
        section="gci"
        t={t}
        langToggle={<LangToggle lang={lang} onToggle={onToggleLang} t={t} />}
      />

      {/* HERO — konteks GCI + deadline */}
      <section className="border-b border-hairline bg-paper">
        <div className="mx-auto max-w-[1320px] px-6 py-10 md:py-14">
          <div className="flex items-center gap-3">
            <span className="atlas-mono text-ink-muted-48">
              GLOBAL CITY INDEX · DISPAREKRAF DKI
            </span>
            <span className="flex-1 border-t border-hairline" />
            <span className="atlas-coord">SENIN · 22 JUNI 2026 · 16.00 WIB</span>
          </div>
          <div className="mt-6 grid md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-7">
              <h1 className="atlas-display text-ink">
                Restoran{" "}
                <span className="atlas-italic text-[color:var(--accent)]">
                  GCI
                </span>
              </h1>
              <p className="apple-body mt-4 text-ink-muted-80 max-w-[60ch]">
                Inventarisasi seluruh restoran &amp; cafe di Jakarta beserta
                keberagaman kuliner internasional — termasuk restoran hotel
                bintang 3 &amp; 4 — untuk Global City Index.
              </p>
            </div>
            <dl className="md:col-span-5 grid grid-cols-4 gap-x-4 gap-y-1 md:border-l md:border-hairline md:pl-6">
              <StatTile label="TOTAL" value={String(stats.total)} />
              <StatTile label="ADA RATING" value={String(stats.rated)} />
              <StatTile label="HOTEL" value={String(stats.hotel)} />
              <StatTile label="CAFE" value={String(stats.cafe)} />
            </dl>
          </div>
        </div>
      </section>

      {/* TAB — Restoran GCI (kurasi) vs Kuliner TripAdvisor (raw) */}
      <section className="border-b border-hairline bg-paper">
        <div className="mx-auto max-w-[1320px] px-6 py-3">
          <div className="inline-flex p-1 bg-canvas border border-hairline rounded-full">
            <button
              onClick={() => setView("gci")}
              className={`press-scale rounded-full px-4 py-1.5 apple-caption whitespace-nowrap ${
                view === "gci"
                  ? "bg-[color:var(--accent)] text-white"
                  : "text-ink-muted-80 hover:text-ink"
              }`}
            >
              Restoran GCI
            </button>
            <button
              onClick={() => setView("tripadvisor")}
              className={`press-scale rounded-full px-4 py-1.5 apple-caption whitespace-nowrap ${
                view === "tripadvisor"
                  ? "bg-[color:var(--accent)] text-white"
                  : "text-ink-muted-80 hover:text-ink"
              }`}
            >
              Kuliner TripAdvisor
            </button>
          </div>
        </div>
      </section>

      {view === "tripadvisor" && (
        <>
          <section className="frosted border-b border-hairline sticky top-[56px] z-20">
            <div className="mx-auto max-w-[1320px] px-6 py-3 flex flex-wrap items-center gap-3">
              <span className="atlas-mono text-ink-muted-48">FILTER ·</span>
              <input
                value={taQ}
                onChange={(e) => setTaQ(e.target.value)}
                placeholder="Cari nama / masakan / alamat…"
                className="bg-canvas border border-hairline rounded-full h-9 px-4 apple-caption text-ink placeholder:text-ink-muted-48 focus:outline-none focus:border-[color:var(--accent)] min-w-[200px]"
              />
              <span className="ml-auto atlas-mono text-ink-muted-48">
                {taFiltered.length}/{TA_ROWS.length} entri
              </span>
            </div>
          </section>

          <section className="flex-1">
            <div className="mx-auto max-w-[1320px] px-6 py-6">
              <p className="apple-caption text-ink-muted-48 mb-3">
                Tabel mentah hasil crawl TripAdvisor — belum diolah/di-dedup ke
                format GCI. Kolom &quot;Michelin&quot; kosong: Jakarta belum
                punya restoran berbintang Michelin.
              </p>
              <div className="overflow-x-auto border border-hairline rounded-lg bg-canvas">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hairline bg-paper">
                      <Th className="w-12 text-right pr-3">No.</Th>
                      {TA_COLUMNS.map((c) => (
                        <Th key={c.key}>{c.label}</Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {taFiltered.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-hairline last:border-0 hover:bg-paper transition-colors"
                      >
                        <td className="px-3 py-3 text-right atlas-mono text-ink-muted-48 tabular align-top">
                          {i + 1}
                        </td>
                        {TA_COLUMNS.map((c) => {
                          const val = row[c.key];
                          const isUrl =
                            c.key === "url_tripadvisor" || c.key === "gmaps";
                          return (
                            <td
                              key={c.key}
                              className="px-3 py-3 align-top apple-caption text-ink-muted-80 max-w-[280px]"
                            >
                              {isUrl && val ? (
                                <a
                                  href={val}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[color:var(--accent)] hover:underline"
                                >
                                  Buka
                                </a>
                              ) : (
                                val || "—"
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {taFiltered.length === 0 && (
                      <tr>
                        <td
                          colSpan={TA_COLUMNS.length + 1}
                          className="px-3 py-12 text-center apple-caption text-ink-muted-48"
                        >
                          Tidak ada entri yang cocok dengan pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}

      {/* FILTER STRIP */}
      {view === "gci" && (
      <>
      <section className="frosted border-b border-hairline sticky top-[56px] z-20">
        <div className="mx-auto max-w-[1320px] px-6 py-3 flex flex-wrap items-center gap-3">
          <span className="atlas-mono text-ink-muted-48">FILTER ·</span>

          {/* Tier */}
          <div className="inline-flex p-1 bg-canvas border border-hairline rounded-full flex-wrap">
            {TIER_FILTERS.map((k) => (
              <button
                key={k}
                onClick={() => setTier(k)}
                className={`press-scale rounded-full px-3 py-1 apple-caption whitespace-nowrap ${
                  tier === k
                    ? "bg-[color:var(--accent)] text-white"
                    : "text-ink-muted-80 hover:text-ink"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {/* Kota */}
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="appearance-none press-scale bg-canvas border border-hairline rounded-full h-9 pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink focus:outline-none cursor-pointer"
          >
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Sumber data */}
          <select
            value={src}
            onChange={(e) => setSrc(e.target.value as SourceFilter)}
            className="appearance-none press-scale bg-canvas border border-hairline rounded-full h-9 pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink focus:outline-none cursor-pointer"
          >
            {SOURCE_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "Semua" ? "Semua (rating)" : s}
              </option>
            ))}
          </select>

          {/* Cari */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama / kuliner / area…"
            className="bg-canvas border border-hairline rounded-full h-9 px-4 apple-caption text-ink placeholder:text-ink-muted-48 focus:outline-none focus:border-[color:var(--accent)] min-w-[200px]"
          />

          <span className="ml-auto atlas-mono text-ink-muted-48">
            {filtered.length}/{GCI_RESTAURANTS.length} entri
          </span>
          <label
            className="flex items-center gap-1.5 apple-caption text-ink-muted-80 cursor-pointer select-none"
            title="Saat ekspor, hanya sertakan venue yang punya rating (tanpa sel kosong)"
          >
            <input
              type="checkbox"
              checked={exportRatedOnly}
              onChange={(e) => setExportRatedOnly(e.target.checked)}
              className="accent-[color:var(--accent)] h-3.5 w-3.5"
            />
            hanya ber-rating
          </label>
          <ExportButton
            onExport={exportGci}
            label={`Ekspor Excel (${exportRows.length})`}
          />
        </div>
      </section>

      {/* TABEL — 7 kolom Google Sheet GCI */}
      <section className="flex-1">
        <div className="mx-auto max-w-[1320px] px-6 py-6">
          <div className="overflow-x-auto border border-hairline rounded-lg bg-canvas">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline bg-paper">
                  <Th className="w-12 text-right pr-3">No.</Th>
                  <Th>Nama</Th>
                  <Th>Jenis Cuisine</Th>
                  <Th>Alamat</Th>
                  <Th className="text-center">Harga</Th>
                  <Th className="text-right">Rating</Th>
                  <Th className="text-right">Jumlah Ulasan</Th>
                  <Th>Sumber</Th>
                  <Th>Tier</Th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr
                    key={r.id}
                    className="border-b border-hairline last:border-0 hover:bg-paper transition-colors"
                  >
                    <td className="px-3 py-3 text-right atlas-mono text-ink-muted-48 tabular align-top">
                      {i + 1}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <a
                        href={gciMapsUrl(r)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="apple-body-strong text-ink hover:text-[color:var(--accent)]"
                      >
                        {r.name}
                      </a>
                      {r.hotel && (
                        <div className="apple-fine text-ink-muted-48 mt-0.5">
                          {r.hotel}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top apple-caption text-ink-muted-80">
                      {r.cuisine}
                    </td>
                    <td className="px-3 py-3 align-top apple-caption text-ink-muted-80 max-w-[280px]">
                      {gciAddress(r)}
                    </td>
                    <td className="px-3 py-3 align-top text-center atlas-mono tabular text-ink-muted-80">
                      {r.priceLevel ?? "—"}
                      {r.priceLevel && r.priceSource === "editorial" && (
                        <span
                          title="Perkiraan editorial — Google tidak punya data harga untuk venue ini"
                          className="text-[color:var(--accent)]"
                        >
                          {" "}*
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right atlas-mono tabular text-ink">
                      {fmtRating(r.rating)}
                      {r.needsVerify && (
                        <span
                          title="Perlu verifikasi angka"
                          className="text-[color:var(--accent)]"
                        >
                          {" "}*
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right atlas-mono tabular text-ink-muted-80">
                      {r.reviewCount?.toLocaleString("id-ID") ?? "—"}
                    </td>
                    <td className="px-3 py-3 align-top apple-caption text-ink-muted-80">
                      {r.ratingSource}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <TierBadge tier={r.tier} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-12 text-center apple-caption text-ink-muted-48"
                    >
                      Tidak ada entri yang cocok dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > visible && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => setVisible((v) => v + PAGE)}
                className="press-scale rounded-full border border-hairline bg-canvas px-5 py-2 apple-caption-strong text-ink hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] transition-colors"
              >
                Muat {Math.min(PAGE, filtered.length - visible)} lagi
              </button>
              <button
                onClick={() => setVisible(filtered.length)}
                className="press-scale apple-caption text-ink-muted-80 hover:text-[color:var(--accent)]"
              >
                Tampilkan semua ({filtered.length})
              </button>
            </div>
          )}

          <p className="apple-caption text-ink-muted-48 mt-3 text-center">
            Menampilkan {paged.length} dari {filtered.length} entri terfilter.
            Ekspor selalu mengikutkan seluruh {filtered.length} entri hasil
            filter.
          </p>
        </div>
      </section>
      </>
      )}

      {/* FOOTER */}
      <footer className="border-t border-hairline bg-paper">
        <div className="mx-auto max-w-[1320px] px-6 py-5 atlas-fine text-ink-muted-48 flex flex-wrap items-center justify-between gap-2">
          <span>
            Sumber: Wanderlog, TripAdvisor, situs hotel resmi (data Google). GCI
            — Disparekraf DKI Jakarta.
          </span>
          <span>{translate(lang, "footer.typeface")}</span>
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

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 atlas-mono text-ink-muted-48 font-medium whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

const TIER_STYLE: Record<GciTier, string> = {
  "Hotel ★5": "bg-[rgba(26,58,90,0.10)] text-[#1A3A5A]",
  "Hotel ★4": "bg-[rgba(14,124,66,0.10)] text-[color:var(--accent-deep)]",
  "Hotel ★3": "bg-[rgba(200,161,75,0.16)] text-[#8a6d23]",
  Restoran: "bg-[rgba(15,23,42,0.06)] text-ink-muted-80",
  Cafe: "bg-[rgba(139,90,43,0.12)] text-[#8B5A2B]",
};

function TierBadge({ tier }: { tier: GciTier }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 apple-fine whitespace-nowrap ${TIER_STYLE[tier]}`}
    >
      {tier}
    </span>
  );
}
