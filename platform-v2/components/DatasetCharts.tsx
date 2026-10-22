"use client";

import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

const PRIMARY = "#ed6b23";
const PALETTE = [
  "#ed6b23", "#f0a13a", "#c94f18", "#f6b860", "#8a3b12",
  "#e8813f", "#b5651d", "#f4a259", "#6b2d0e", "#ffc98a",
];

type Column = { key: string; desc: string | null; type: string | null };
type Row = Record<string, unknown>;
type Kind = "bar" | "hbar" | "line" | "area" | "pie" | "donut";
type Agg = "sum" | "avg" | "count" | "max" | "min";
type Sort = "auto" | "nilai_desc" | "nilai_asc" | "kategori_asc" | "kategori_desc";
type ChartCfg = { id: string; kind: Kind; x: string; y: string; agg: Agg; sort: Sort };

const KINDS: { v: Kind; label: string }[] = [
  { v: "bar", label: "Batang" },
  { v: "hbar", label: "Batang horizontal" },
  { v: "line", label: "Garis" },
  { v: "area", label: "Area" },
  { v: "pie", label: "Pie" },
  { v: "donut", label: "Donat" },
];
const AGGS: { v: Agg; label: string }[] = [
  { v: "sum", label: "Total (sum)" },
  { v: "avg", label: "Rata-rata" },
  { v: "count", label: "Jumlah baris (count)" },
  { v: "max", label: "Maksimum" },
  { v: "min", label: "Minimum" },
];

const SORTS: { v: Sort; label: string }[] = [
  { v: "auto", label: "Otomatis" },
  { v: "nilai_desc", label: "Nilai terbesar dulu" },
  { v: "nilai_asc", label: "Nilai terkecil dulu" },
  { v: "kategori_asc", label: "Kategori A→Z / lama→baru" },
  { v: "kategori_desc", label: "Kategori Z→A / baru→lama" },
];
/** Batas kategori untuk batang/pie; dipilih berdasarkan nilai terbesar sebelum diurutkan. */
const MAX_CATS = 30;

const HIDDEN = new Set([
  "id", "user_id", "uid_upload", "batch_upload", "jadwal_rilis",
  "tanggal_upload", "tanggal_update", "created_at", "updated_at",
]);

const humanize = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\s/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : null;
}
const fmtInt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("id-ID");
function fmtCompact(v: number) {
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `${(v / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (a >= 1_000_000) return `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (a >= 1_000) return `${(v / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`;
  return fmtInt(v);
}

function distinctCount(rows: Row[], key: string, cap = 200): number {
  const s = new Set<string>();
  for (const r of rows) { s.add(String(r[key] ?? "")); if (s.size > cap) break; }
  return s.size;
}
/** Kategori default terbaik: hindari kolom id-like/konstan; utamakan kardinalitas sedang. */
function pickDefaultDim(dims: Column[], rows: Row[]): string {
  let best = dims[0]?.key ?? "";
  let bestScore = Infinity;
  for (const c of dims) {
    if (/(^|_)(no|nomor|id|kode|uuid|slug)(_|$)/i.test(c.key)) continue;
    const dc = distinctCount(rows, c.key);
    if (dc < 2 || dc >= rows.length) continue;
    const score = dc > 40 ? dc + 1000 : Math.abs(dc - 8);
    if (score < bestScore) { bestScore = score; best = c.key; }
  }
  if (!best || distinctCount(rows, best) >= rows.length) {
    for (const c of dims) { const dc = distinctCount(rows, c.key); if (dc >= 2 && dc < rows.length) { best = c.key; break; } }
  }
  return best || dims[0]?.key || "";
}
function isNumericCol(col: Column, rows: Row[]): boolean {
  // Kolom yang jelas kategori/waktu → BUKAN measure meski isinya angka.
  const k = col.key.toLowerCase();
  if (/(^|_)(tahun|triwulan|semester|kuartal|bulan|periode|tanggal|waktu|kode|id|no|nomor|nama|wilayah|kecamatan|kelurahan|kota|lokasi|kategori|jenis|status|slug|latitude|longitude|lat|lon|importance)(_|$)/.test(k)) return false;
  // Hint tipe cuma sinyal POSITIF (lakehouse simpan semua sbg String → jangan
  // pakai 'string/text' utk mendiskualifikasi; andalkan sampling nilai).
  const t = (col.type || "").toLowerCase();
  if (/int|num|dec|float|double|angka|real|money|rupiah/.test(t)) return true;
  let num = 0, tot = 0;
  for (const r of rows.slice(0, 80)) {
    const v = r[col.key];
    if (v === null || v === undefined || v === "") continue;
    tot++;
    if (toNum(v) !== null) num++;
  }
  return tot >= 3 && num / tot >= 0.8;
}

type Point = { name: string; value: number };

/** Urutan kategori: angka dibanding sebagai angka, sisanya teks (tanggal ISO ikut benar). */
function byName(a: Point, b: Point): number {
  const na = toNum(a.name), nb = toNum(b.name);
  if (na !== null && nb !== null) return na - nb;
  return a.name.localeCompare(b.name, "id", { numeric: true });
}

function sortPoints(points: Point[], kind: Kind, sort: Sort): Point[] {
  const timeLike = kind === "line" || kind === "area";
  // Garis/area memakai semua titik; batang/pie dibatasi ke kategori bernilai terbesar.
  const pool = timeLike ? [...points] : [...points].sort((a, b) => b.value - a.value).slice(0, MAX_CATS);
  const mode = sort === "auto" ? (timeLike ? "kategori_asc" : "nilai_desc") : sort;
  switch (mode) {
    case "nilai_desc": return pool.sort((a, b) => b.value - a.value);
    case "nilai_asc": return pool.sort((a, b) => a.value - b.value);
    case "kategori_asc": return pool.sort(byName);
    case "kategori_desc": return pool.sort((a, b) => byName(b, a));
  }
}

function buildOption(cfg: ChartCfg, points: Point[]): { option: EChartsOption; empty: boolean } {
  const data = sortPoints(points, cfg.kind, cfg.sort);
  if (!data.length) return { option: {}, empty: true };

  const horizontal = cfg.kind === "hbar";
  const cats = data.map((d) => d.name);
  const vals = data.map((d) => d.value);
  const base: EChartsOption = {
    color: PALETTE,
    textStyle: { fontFamily: "inherit", color: "#334155" },
    tooltip: {
      trigger: cfg.kind === "pie" || cfg.kind === "donut" ? "item" : "axis",
      valueFormatter: (v) => (typeof v === "number" ? fmtInt(v) : String(v)),
    },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
  };

  if (cfg.kind === "pie" || cfg.kind === "donut") {
    return {
      empty: false,
      option: {
        ...base,
        grid: undefined,
        legend: { bottom: 0, type: "scroll", textStyle: { color: "#475569", fontSize: 11 }, icon: "circle" },
        series: [{
          type: "pie",
          radius: cfg.kind === "donut" ? ["45%", "72%"] : "70%",
          center: ["50%", "46%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "#fff", borderWidth: 2 },
          label: { show: false },
          data: data.map((d) => ({ name: d.name, value: d.value })),
        }],
      },
    };
  }

  const valueAxis = {
    type: "value" as const,
    axisLabel: { color: "#64748b", fontSize: 11, formatter: (v: number) => fmtCompact(v) },
    splitLine: { lineStyle: { color: "rgba(0,0,0,0.06)" } },
    axisLine: { show: false }, axisTick: { show: false },
  };
  const catAxis = {
    type: "category" as const,
    data: horizontal ? [...cats].reverse() : cats,
    axisLabel: {
      color: "#64748b", fontSize: 11, interval: 0, hideOverlap: true,
      ...(horizontal ? {} : { rotate: cats.length > 6 ? 30 : 0 }),
    },
    axisLine: { lineStyle: { color: "rgba(0,0,0,0.12)" } },
    axisTick: { show: false },
  };
  const isLine = cfg.kind === "line" || cfg.kind === "area";
  const seriesVals = horizontal ? [...vals].reverse() : vals;

  return {
    empty: false,
    option: {
      ...base,
      xAxis: horizontal ? valueAxis : catAxis,
      yAxis: horizontal ? catAxis : valueAxis,
      series: [{
        type: isLine ? "line" : "bar",
        data: seriesVals,
        barMaxWidth: 34,
        smooth: isLine,
        showSymbol: cfg.kind === "line",
        symbolSize: 6,
        lineStyle: isLine ? { width: 2, color: PRIMARY } : undefined,
        itemStyle: { color: PRIMARY, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
        areaStyle: cfg.kind === "area"
          ? { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(237,107,35,0.28)" }, { offset: 1, color: "rgba(237,107,35,0.02)" }] } }
          : undefined,
      }],
    },
  };
}

let seq = 0;
const nid = () => `c${++seq}`;

/** Grafik yang dibuat pengguna disimpan per dataset di localStorage browser ini. */
const STORE_PREFIX = "dispar:dataset-charts:";

function loadCharts(key: string, valid: Set<string>): ChartCfg[] {
  try {
    const raw = window.localStorage.getItem(STORE_PREFIX + key);
    const list = raw ? (JSON.parse(raw) as Omit<ChartCfg, "id">[]) : [];
    return list
      .filter((c) => KINDS.some((k) => k.v === c.kind) && AGGS.some((a) => a.v === c.agg) && valid.has(c.x) && (c.agg === "count" || valid.has(c.y)))
      .map((c) => ({
        id: nid(), kind: c.kind, x: c.x, y: c.y, agg: c.agg,
        // Grafik lama belum punya `sort` → pakai urutan otomatis seperti sebelumnya.
        sort: SORTS.some((o) => o.v === c.sort) ? c.sort : "auto",
      }));
  } catch {
    return [];
  }
}

/** Data satu grafik, diringkas di server atas seluruh baris yang cocok dengan filter. */
function useChartData(slug: string, cfg: ChartCfg, query: string): Point[] | "gagal" | null {
  const [data, setData] = useState<Point[] | "gagal" | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    const p = new URLSearchParams(query);
    p.set("x", cfg.x);
    p.set("agg", cfg.agg);
    if (cfg.agg !== "count") p.set("y", cfg.y);
    fetch(`/api/sdi/${slug}/aggregate?${p}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { if (alive) setData(j.data ?? []); })
      .catch(() => { if (alive) setData("gagal"); });
    return () => { alive = false; };
  }, [slug, cfg.x, cfg.y, cfg.agg, query]);
  return data;
}

function ChartBody({ slug, cfg, query }: { slug: string; cfg: ChartCfg; query: string }) {
  const data = useChartData(slug, cfg, query);
  if (data === null) return <p className="grid h-[280px] place-items-center text-[13px] text-slate-400">Memuat grafik…</p>;
  if (data === "gagal") return <p className="grid h-[280px] place-items-center text-[13px] text-red-500">Gagal memuat grafik.</p>;
  const { option, empty } = buildOption(cfg, data);
  return empty
    ? <p className="grid h-[280px] place-items-center text-[13px] text-slate-400">Tak ada nilai untuk dirangkum.</p>
    : <ReactECharts option={option} style={{ height: 300, width: "100%" }} notMerge lazyUpdate opts={{ renderer: "canvas" }} />;
}

/**
 * Pembuat grafik dari data dataset. User memilih tipe + kolom X/Y + agregasi;
 * angka diringkas di server atas SELURUH baris yang cocok dengan pencarian/filter
 * aktif (`query`), sedangkan baris termuat hanya dipakai menebak kolom angka dan
 * kategori default. Konfigurasinya disimpan per dataset di localStorage browser.
 */
export function DatasetCharts({
  slug, columns, rows, storageKey, query, count,
}: {
  slug: string;
  columns: Column[];
  rows: Row[];
  storageKey: string;
  /** Parameter pencarian/filter aktif (format lib/ch/query-filter.ts), tanpa sort. */
  query: string;
  /** Jumlah baris yang cocok dengan filter. */
  count: number;
}) {
  const cols = useMemo(
    () => (columns.length ? columns : Object.keys(rows[0] ?? {}).map((k) => ({ key: k, desc: null, type: null })))
      .filter((c) => !HIDDEN.has(c.key)),
    [columns, rows],
  );
  const measures = useMemo(() => cols.filter((c) => isNumericCol(c, rows)), [cols, rows]);
  const dimensions = useMemo(() => {
    const d = cols.filter((c) => !measures.includes(c));
    return d.length ? d : cols;
  }, [cols, measures]);

  const defX = useMemo(() => pickDefaultDim(dimensions, rows) || cols[0]?.key || "", [dimensions, rows, cols]);
  const defY = measures[0]?.key ?? "";
  const [kind, setKind] = useState<Kind>("bar");
  const [x, setX] = useState(defX);
  const [y, setY] = useState(defY);
  const [agg, setAgg] = useState<Agg>(defY ? "sum" : "count");
  const [sort, setSort] = useState<Sort>("auto");
  // Tidak ada grafik bawaan; yang ditambahkan pengguna dipulihkan dari localStorage.
  const [charts, setCharts] = useState<ChartCfg[]>(() => loadCharts(storageKey, new Set(cols.map((c) => c.key))));
  useEffect(() => {
    try {
      const data = charts.map(({ kind, x, y, agg, sort }) => ({ kind, x, y, agg, sort }));
      if (data.length) window.localStorage.setItem(STORE_PREFIX + storageKey, JSON.stringify(data));
      else window.localStorage.removeItem(STORE_PREFIX + storageKey);
    } catch {
      // localStorage tidak tersedia (mode privat/diblokir): grafik tetap jalan tanpa disimpan.
    }
  }, [charts, storageKey]);

  if (!rows.length || !cols.length) return null;

  const add = () => {
    if (!x) return;
    setCharts((c) => [{ id: nid(), kind, x, y: agg === "count" ? "" : y, agg, sort }, ...c]);
  };
  const remove = (id: string) => setCharts((c) => c.filter((k) => k.id !== id));
  const setChartSort = (id: string, s: Sort) =>
    setCharts((c) => c.map((k) => (k.id === id ? { ...k, sort: s } : k)));

  const sel = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#ed6b23] transition-colors";

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-[16px] font-bold tracking-tight text-slate-800">Visualisasi Data</h2>
        <span className="text-[12px] text-slate-400">Grafik dari {count.toLocaleString("id-ID")} baris{query && " (terfilter)"} · tersimpan di browser ini</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Tipe grafik">
            <select className={sel} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
            </select>
          </Field>
          <Field label="Kategori (X)">
            <select className={sel} value={x} onChange={(e) => setX(e.target.value)}>
              {dimensions.map((c) => <option key={c.key} value={c.key}>{humanize(c.key)}</option>)}
              {measures.filter((m) => !dimensions.includes(m)).map((c) => <option key={c.key} value={c.key}>{humanize(c.key)}</option>)}
            </select>
          </Field>
          <Field label="Agregasi">
            <select className={sel} value={agg} onChange={(e) => setAgg(e.target.value as Agg)}>
              {AGGS.filter((a) => a.v === "count" || measures.length > 0).map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
            </select>
          </Field>
          {agg !== "count" && (
            <Field label="Nilai (Y)">
              <select className={sel} value={y} onChange={(e) => setY(e.target.value)} disabled={!measures.length}>
                {measures.length
                  ? measures.map((c) => <option key={c.key} value={c.key}>{humanize(c.key)}</option>)
                  : <option value="">(tak ada kolom angka)</option>}
              </select>
            </Field>
          )}
          <Field label="Urutkan">
            <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </Field>
          <button
            onClick={add}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: PRIMARY }}
          >
            + Tambah grafik
          </button>
        </div>
        {!measures.length && (
          <p className="mt-3 text-[12px] text-slate-500">
            Tak ada kolom angka terdeteksi — pakai <b>Jumlah baris (count)</b> untuk frekuensi per kategori.
          </p>
        )}
      </div>

      {charts.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-400 text-[14px]">
          Belum ada grafik. Pilih tipe &amp; kolom di atas, lalu “Tambah grafik”.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {charts.map((cfg) => {
            const title = `${AGGS.find((a) => a.v === cfg.agg)?.label ?? cfg.agg}${cfg.agg === "count" ? "" : ` ${humanize(cfg.y)}`} per ${humanize(cfg.x)}`;
            return (
              <div key={cfg.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slate-700">{title}</p>
                    <p className="text-[11px] text-slate-400">{KINDS.find((k) => k.v === cfg.kind)?.label}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <select
                      aria-label="Urutkan grafik"
                      value={cfg.sort}
                      onChange={(e) => setChartSort(cfg.id, e.target.value as Sort)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-600 outline-none focus:border-[#ed6b23]"
                    >
                      {SORTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </select>
                    <button
                      onClick={() => remove(cfg.id)}
                      aria-label="Hapus grafik"
                      className="shrink-0 rounded-md px-2 py-1 text-[12px] text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-colors"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  <ChartBody slug={slug} cfg={cfg} query={query} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
