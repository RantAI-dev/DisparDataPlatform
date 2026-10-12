"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DatasetCharts } from "@/components/DatasetCharts";

const NAVY = "#ed6b23";
const GOLD = "#f0a13a";
const HERO = "radial-gradient(900px 320px at 88% -25%, rgba(237,107,35,0.28), transparent 62%), linear-gradient(160deg, #2a2521 0%, #16130f 100%)";
const PAGE = 50;

type Column = { key: string; desc: string | null; type: string | null };
type Row = Record<string, unknown>;
type DatasetMeta = {
  slug: string;
  title: string;
  description: string;
  sumberData: string[];
  frekuensi: string | null;
  satuan: string | null;
  columns: Column[];
  total: number;
  medallion: MedallionInfo | null;
};

type Medallion = "bronze" | "silver" | "gold";
type MedallionInfo = { level: Medallion; table?: string; mart?: string };

/** Keterangan tiap lapisan lakehouse (arsitektur medallion). */
const MEDAL: Record<Medallion, { label: string; bg: string; fg: string; note: string }> = {
  bronze: {
    label: "Bronze",
    bg: "#f6ebe1",
    fg: "#8a5223",
    note: "salinan mentah apa adanya di lakehouse (Apache Iceberg) — belum ada model bertipe",
  },
  silver: {
    label: "Silver",
    bg: "#eef1f5",
    fg: "#4a5a6b",
    note: "sudah dibersihkan & bertipe; tabel di halaman ini dibaca dari lapisan Silver",
  },
  gold: {
    label: "Gold",
    bg: "#fbf0d6",
    fg: "#8a6a12",
    note: "sudah diringkas menjadi mart penyaji yang dibaca dashboard indikator",
  },
};

const HIDDEN = new Set([
  "id",
  "user_id",
  "uid_upload",
  "batch_upload",
  "jadwal_rilis",
  "tanggal_upload",
  "tanggal_update",
  "created_at",
  "updated_at",
]);

function humanize(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DatasetDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [meta, setMeta] = useState<DatasetMeta | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0); // baris cocok filter aktif
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // muat awal
  const [loadingMore, setLoadingMore] = useState(false);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  // Debounce input pencarian → query server.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  // Muat satu halaman. reset=true → ganti (untuk slug/pencarian baru).
  const load = useCallback(
    async (reset: boolean, curLen: number) => {
      const offset = reset ? 0 : curLen;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await fetch(
          `/api/sdi/${slug}?offset=${offset}&limit=${PAGE}&q=${encodeURIComponent(debouncedQ)}`
        );
        const json = await res.json();
        if (json.error) {
          setError(json.error);
          return;
        }
        setError(null);
        setCount(json.count ?? json.total ?? 0);
        setMeta({
          slug: json.slug,
          title: json.title,
          description: json.description,
          sumberData: json.sumberData ?? [],
          frekuensi: json.frekuensi,
          satuan: json.satuan,
          columns: json.columns ?? [],
          total: json.total ?? 0,
          medallion: json.medallion ?? null,
        });
        setRows((prev) => (reset ? json.rows : [...prev, ...json.rows]));
      } catch {
        setError("Gagal memuat data");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [slug, debouncedQ]
  );

  // Muat awal / saat slug atau pencarian berubah.
  useEffect(() => {
    setRows([]);
    load(true, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, debouncedQ]);

  // Lazy-load saat sentinel terlihat.
  const hasMore = rows.length < count;
  const sentinel = useRef<HTMLDivElement | null>(null);
  const rowsLenRef = useRef(rows.length);
  rowsLenRef.current = rows.length;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          load(false, rowsLenRef.current);
        }
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadingMore, load]);

  const columns = useMemo<Column[]>(() => {
    if (!meta) return [];
    if (meta.columns.length) return meta.columns;
    const first = rows[0] ?? {};
    return Object.keys(first)
      .filter((k) => !HIDDEN.has(k))
      .map((k) => ({ key: k, desc: null, type: null }));
  }, [meta, rows]);

  return (
    <main className="min-h-screen bg-[#faf6f2]">
      <section
        style={{ background: HERO }}
        className="text-white"
      >
        <div className="mx-auto max-w-[1320px] px-6 pt-7 pb-10">
          <Link
            href="/sdi"
            className="text-[12px] font-mono uppercase tracking-widest text-white/60 hover:text-white"
          >
            ← Katalog Pariwisata &amp; Ekraf
          </Link>
          <h1 className="mt-3 text-[26px] md:text-[32px] font-bold tracking-tight max-w-[30ch]">
            {meta?.title ?? humanize(slug)}
          </h1>
          {meta?.description && (
            <p className="mt-2 text-white/75 max-w-[75ch] text-[15px]">
              {meta.description}
            </p>
          )}
          {meta && (
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/80">
              <Meta label="Baris data" value={meta.total.toLocaleString("id-ID")} />
              {meta.satuan && <Meta label="Satuan" value={meta.satuan} />}
              {meta.frekuensi && <Meta label="Frekuensi" value={meta.frekuensi} />}
              {meta.sumberData?.length > 0 && (
                <Meta label="Sumber" value={meta.sumberData.join(", ")} />
              )}
            </div>
          )}
          {meta?.medallion && <MedallionNote info={meta.medallion} />}
        </div>
      </section>

      <section className="mx-auto max-w-[1320px] px-6 py-8 pb-20">
        {error && (
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center text-red-600">
            {error}. Coba{" "}
            <a
              href={`https://satudata.jakarta.go.id/open-data/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              buka di portal SDI ↗
            </a>
            .
          </div>
        )}

        {loading && !error && (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center text-slate-400">
            Memuat data dari Satu Data Jakarta…
          </div>
        )}

        {meta && !loading && rows.length > 0 && (
          <DatasetCharts columns={columns} rows={rows} storageKey={slug} />
        )}

        {meta && !loading && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari di dalam data…"
                className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[14px] outline-none focus:border-[#ed6b23] transition-colors"
              />
              <div className="flex items-center gap-3">
                {/* Unduh seluruh dataset (semua baris, bukan halaman ini saja) */}
                <div className="flex items-center gap-1.5">
                  <a
                    href={`/api/sdi/${slug}/export?format=csv`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:border-[#ed6b23] hover:text-[#ed6b23] transition-colors"
                    title="Unduh semua baris sebagai CSV"
                  >
                    <DownloadIcon /> CSV
                  </a>
                  <a
                    href={`/api/sdi/${slug}/export?format=xlsx`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:border-[#ed6b23] hover:text-[#ed6b23] transition-colors"
                    title="Unduh semua baris sebagai Excel (XLSX)"
                  >
                    <DownloadIcon /> XLSX
                  </a>
                </div>
                <span className="text-[13px] text-slate-500 tabular-nums whitespace-nowrap">
                  {rows.length.toLocaleString("id-ID")} / {count.toLocaleString("id-ID")} baris
                  {debouncedQ && " (hasil pencarian)"}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[14px] border-collapse">
                  <thead>
                    <tr
                      style={{ background: NAVY }}
                      className="text-white text-left text-[12px] uppercase tracking-wider"
                    >
                      <th className="px-4 py-3 font-semibold w-12">#</th>
                      {columns.map((c) => (
                        <th
                          key={c.key}
                          className="px-4 py-3 font-semibold"
                          title={c.desc ?? undefined}
                        >
                          {humanize(c.key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-slate-400 tabular-nums">{i + 1}</td>
                        {columns.map((c) => (
                          <td key={c.key} className="px-4 py-3 text-slate-700 tabular-nums">
                            {renderCell(c.key, row[c.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={columns.length + 1}
                          className="px-4 py-12 text-center text-slate-400"
                        >
                          Tidak ada baris data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Sentinel lazy-load + indikator */}
              {hasMore && (
                <div
                  ref={sentinel}
                  className="py-5 text-center text-[13px] text-slate-400 border-t border-slate-100"
                >
                  {loadingMore ? "Memuat baris berikutnya…" : "Gulir untuk memuat lebih banyak"}
                </div>
              )}
            </div>

            <p className="text-[12px] text-slate-400 mt-4">
              Menampilkan {rows.length.toLocaleString("id-ID")} dari{" "}
              {count.toLocaleString("id-ID")} baris · Sumber: Satu Data Indonesia — Jakarta ·{" "}
              <a
                href={`https://satudata.jakarta.go.id/open-data/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                lihat di portal ↗
              </a>
            </p>
          </>
        )}
      </section>
    </main>
  );
}

/** Lapisan medallion dataset ini di lakehouse + keterangan singkatnya. */
function MedallionNote({ info }: { info: MedallionInfo }) {
  const m = MEDAL[info.level];
  const path =
    info.level === "gold"
      ? ["Bronze", "Silver", "Gold"]
      : info.level === "silver"
        ? ["Bronze", "Silver"]
        : ["Bronze"];
  return (
    <div className="mt-4 inline-flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-white/10 border border-white/15 px-4 py-2.5">
      <span className="text-white/50 uppercase text-[11px] tracking-wider">
        Lapisan lakehouse:
      </span>
      <span className="inline-flex items-center gap-1.5 text-[12px] text-white/70">
        {path.map((p, i) => (
          <span key={p} className="inline-flex items-center gap-1.5">
            {i > 0 && <span className="text-white/30">→</span>}
            {p === m.label ? (
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ background: m.bg, color: m.fg }}
              >
                ◆ {p}
              </span>
            ) : (
              <span>{p}</span>
            )}
          </span>
        ))}
      </span>
      <span className="text-[12.5px] text-white/70 max-w-[70ch]">
        {m.note}
        {info.mart ? ` (${info.mart})` : ""}.
      </span>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-white/50 uppercase text-[11px] tracking-wider">{label}: </span>
      <span className="font-medium" style={{ color: GOLD }}>
        {value}
      </span>
    </span>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/** Render sel: URL → link biru yang bisa diklik; selain itu teks biasa. */
function renderCell(key: string, v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  if (/^https?:\/\//i.test(s)) {
    const k = key.toLowerCase();
    const label = k === "gmaps"
      ? "Peta ↗"
      : k.includes("tripadvisor")
      ? "TripAdvisor ↗"
      : k === "sumber" || k.includes("url")
      ? "Sumber ↗"
      : "Buka ↗";
    return (
      <a
        href={s}
        target="_blank"
        rel="noreferrer"
        style={{ color: "#2563eb" }}
        className="hover:underline whitespace-nowrap font-medium"
      >
        {label}
      </a>
    );
  }
  return fmtCell(v);
}

function fmtCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  if (/^\d{4,}$/.test(s)) {
    const n = Number(s);
    if (!isNaN(n) && s.length > 4) return n.toLocaleString("id-ID");
  }
  return s;
}
