"use client";

/**
 * Tabel dataset SDI yang bisa disematkan (tanpa hero) — search + lazy-load,
 * baca dari /api/sdi/<slug> (DB-backed). Dipakai di halaman indikator GCI
 * pariwisata untuk menampilkan data pendukung. Tema putih + header oranye.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtCell } from "@/lib/format-sel";

const ACCENT = "#ed6b23";
const PAGE = 50;

type Column = { key: string; desc: string | null; type: string | null };
type Row = Record<string, unknown>;

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

export function SdiTable({
  slug,
  /** Batasi & urutkan kolom yang tampil (pakai key kolom). */
  columns: onlyKeys,
}: {
  slug: string;
  columns?: string[];
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [metaCols, setMetaCols] = useState<Column[]>([]);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [sumber, setSumber] = useState<{ label: string; portalUrl: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

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
        setTotal(json.total ?? 0);
        setMetaCols(json.columns ?? []);
        // Respons lama (cache) tanpa sumberLabel → tanpa tag/footer sumber, bukan "undefined".
        setSumber(json.sumberLabel ? { label: json.sumberLabel, portalUrl: json.portalUrl ?? null } : null);
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

  useEffect(() => {
    setRows([]);
    load(true, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, debouncedQ]);

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
    let cols = metaCols;
    if (!cols.length) {
      const first = rows[0] ?? {};
      cols = Object.keys(first)
        .filter((k) => !HIDDEN.has(k))
        .map((k) => ({ key: k, desc: null, type: null }));
    }
    if (onlyKeys?.length) {
      const byKey = new Map(cols.map((c) => [c.key, c]));
      return onlyKeys
        .map((k) => byKey.get(k) ?? { key: k, desc: null, type: null })
        .filter(Boolean) as Column[];
    }
    return cols;
  }, [metaCols, rows, onlyKeys]);
  // Tag sumber di kanan tabel, kecuali kolom `sumber` dataset sudah berisi label sumber per baris
  // (bukan tautan), mis. HKI gabungan SDI + nota dinas.
  const sumberTag = sumber && !rows.some((r) => isLabelSumber("sumber", r.sumber)) ? sumber.label : null;
  // Label sumber per baris sudah ada → kolom `sumber` dipindah ke paling kanan.
  const kolomTabel = sumberTag ? columns : [...columns.filter((c) => c.key !== "sumber"), ...columns.filter((c) => c.key === "sumber")];
  const nCols = columns.length + 1 + (sumberTag ? 1 : 0);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-white p-8 text-center text-red-600">
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
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari di dalam data…"
          className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-[#ed6b23]"
        />
        <span className="whitespace-nowrap text-[13px] tabular-nums text-slate-500">
          {rows.length.toLocaleString("id-ID")} / {count.toLocaleString("id-ID")} baris
          {debouncedQ && " (hasil pencarian)"}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr
                style={{ background: ACCENT }}
                className="text-left text-[12px] uppercase tracking-wider text-white"
              >
                <th className="w-12 px-4 py-3 font-semibold">#</th>
                {kolomTabel.map((c) => (
                  <th key={c.key} className="px-4 py-3 font-semibold" title={c.desc ?? undefined}>
                    {humanize(c.key)}
                  </th>
                ))}
                {sumberTag && <th className="px-4 py-3 font-semibold">Sumber Data</th>}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={nCols} className="px-4 py-12 text-center text-slate-400">
                    Memuat data…
                  </td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100 transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 tabular-nums text-slate-400">{i + 1}</td>
                  {kolomTabel.map((c) => (
                    <td key={c.key} className="px-4 py-3 tabular-nums text-slate-700">
                      {isLabelSumber(c.key, row[c.key]) ? (
                        <SumberTag label={String(row[c.key])} />
                      ) : (
                        fmtCell(c.key, row[c.key])
                      )}
                    </td>
                  ))}
                  {sumberTag && (
                    <td className="px-4 py-3">
                      <SumberTag label={sumberTag} />
                    </td>
                  )}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={nCols} className="px-4 py-12 text-center text-slate-400">
                    Tidak ada baris data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div
            ref={sentinel}
            className="border-t border-slate-100 py-5 text-center text-[13px] text-slate-400"
          >
            {loadingMore ? "Memuat baris berikutnya…" : "Gulir untuk memuat lebih banyak"}
          </div>
        )}
      </div>

      <p className="mt-3 text-[12px] text-slate-400">
        Menampilkan {rows.length.toLocaleString("id-ID")} dari{" "}
        {(total || count).toLocaleString("id-ID")} baris
        {sumber && ` · Sumber: ${sumber.label}`}
        {sumber?.portalUrl && (
          <>
            {" · "}
            <a href={sumber.portalUrl} target="_blank" rel="noreferrer" className="underline">
              lihat di portal ↗
            </a>
          </>
        )}
      </p>
    </div>
  );
}

/** Nilai kolom `sumber` yang berupa label teks (bukan tautan) → ditampilkan sebagai tag. */
export const isLabelSumber = (key: string, v: unknown) => key === "sumber" && !!v && !/^https?:\/\//i.test(String(v));

/** Tag sumber data per baris (kolom paling kanan tabel dataset). */
export function SumberTag({ label }: { label: string }) {
  return (
    <span className="inline-block min-w-[12rem] max-w-[22rem] rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[12px] leading-snug text-slate-600">
      {label}
    </span>
  );
}
