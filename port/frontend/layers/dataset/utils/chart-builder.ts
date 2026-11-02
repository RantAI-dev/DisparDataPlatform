/**
 * Logika murni pembuat grafik dataset (components/DatasetCharts.tsx v2 @ 464fc15, yang tayang): tebakan kolom angka dan
 * kategori default, opsi ECharts, dan preferensi tersimpan di localStorage dengan kunci yang sama.
 */
import { KOLOM_TERSEMBUNYI } from "../constants";
import type { Baris, Kolom } from "../composables/useDataset";

export type JenisGrafik = "bar" | "hbar" | "line" | "area" | "pie" | "donut";
export type Agregasi = "sum" | "avg" | "count" | "max" | "min";
export type UrutanGrafik = "auto" | "nilai_desc" | "nilai_asc" | "kategori_asc" | "kategori_desc";
export type GrafikCfg = { id: string; kind: JenisGrafik; x: string; y: string; agg: Agregasi; sort: UrutanGrafik };
export type TitikGrafik = { name: string; value: number };

export const JENIS_GRAFIK: { v: JenisGrafik; label: string }[] = [
  { v: "bar", label: "Batang" },
  { v: "hbar", label: "Batang horizontal" },
  { v: "line", label: "Garis" },
  { v: "area", label: "Area" },
  { v: "pie", label: "Pie" },
  { v: "donut", label: "Donat" },
];
export const AGREGASI: { v: Agregasi; label: string }[] = [
  { v: "sum", label: "Total (sum)" },
  { v: "avg", label: "Rata-rata" },
  { v: "count", label: "Jumlah baris (count)" },
  { v: "max", label: "Maksimum" },
  { v: "min", label: "Minimum" },
];

export const URUTAN_GRAFIK: { v: UrutanGrafik; label: string }[] = [
  { v: "auto", label: "Otomatis" },
  { v: "nilai_desc", label: "Nilai terbesar dulu" },
  { v: "nilai_asc", label: "Nilai terkecil dulu" },
  { v: "kategori_asc", label: "Kategori A→Z / lama→baru" },
  { v: "kategori_desc", label: "Kategori Z→A / baru→lama" },
];
/** Batas kategori untuk batang/pie; dipilih berdasarkan nilai terbesar sebelum diurutkan. */
const MAX_CATS = 30;

const PRIMARY = "#ed6b23";
const PALETTE = ["#ed6b23", "#f0a13a", "#c94f18", "#f6b860", "#8a3b12", "#e8813f", "#b5651d", "#f4a259", "#6b2d0e", "#ffc98a"];

/** Kunci localStorage (sama dengan v2 supaya grafik bertahan bila domain sama). */
export const AWALAN_SIMPAN = "dispar:dataset-charts:";

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

function distinctCount(rows: Baris[], key: string, cap = 200): number {
  const s = new Set<string>();
  for (const r of rows) {
    s.add(String(r[key] ?? ""));
    if (s.size > cap) break;
  }
  return s.size;
}

/** Kolom yang boleh dipakai grafik: metadata kolom (atau kunci baris pertama) minus kolom tersembunyi. */
export function kolomGrafik(columns: Kolom[], rows: Baris[]): Kolom[] {
  return (columns.length ? columns : Object.keys(rows[0] ?? {}).map((k) => ({ key: k, desc: null, type: null }))).filter(
    (c) => !KOLOM_TERSEMBUNYI.has(c.key),
  );
}

/** Kategori default terbaik: hindari kolom id-like/konstan; utamakan kardinalitas sedang. */
export function pickDefaultDim(dims: Kolom[], rows: Baris[]): string {
  let best = dims[0]?.key ?? "";
  let bestScore = Infinity;
  for (const c of dims) {
    if (/(^|_)(no|nomor|id|kode|uuid|slug)(_|$)/i.test(c.key)) continue;
    const dc = distinctCount(rows, c.key);
    if (dc < 2 || dc >= rows.length) continue;
    const score = dc > 40 ? dc + 1000 : Math.abs(dc - 8);
    if (score < bestScore) {
      bestScore = score;
      best = c.key;
    }
  }
  if (!best || distinctCount(rows, best) >= rows.length) {
    for (const c of dims) {
      const dc = distinctCount(rows, c.key);
      if (dc >= 2 && dc < rows.length) {
        best = c.key;
        break;
      }
    }
  }
  return best || dims[0]?.key || "";
}

export function isNumericCol(col: Kolom, rows: Baris[]): boolean {
  // Kolom yang jelas kategori/waktu → BUKAN measure meski isinya angka.
  const k = col.key.toLowerCase();
  if (
    /(^|_)(tahun|triwulan|semester|kuartal|bulan|periode|tanggal|waktu|kode|kbli|id|no|nomor|nama|wilayah|kecamatan|kelurahan|kota|lokasi|kategori|jenis|status|slug|latitude|longitude|lat|lon|importance)(_|$)/.test(k)
  )
    return false;
  // Hint tipe hanya sinyal POSITIF; selebihnya sampling nilai.
  const t = (col.type || "").toLowerCase();
  if (/int|num|dec|float|double|angka|real|money|rupiah/.test(t)) return true;
  let num = 0;
  let tot = 0;
  for (const r of rows.slice(0, 80)) {
    const v = r[col.key];
    if (v === null || v === undefined || v === "") continue;
    tot++;
    if (toNum(v) !== null) num++;
  }
  return tot >= 3 && num / tot >= 0.8;
}

/** Urutan kategori: angka dibanding sebagai angka, sisanya teks (tanggal ISO ikut benar). */
function byName(a: TitikGrafik, b: TitikGrafik): number {
  const na = toNum(a.name);
  const nb = toNum(b.name);
  if (na !== null && nb !== null) return na - nb;
  return a.name.localeCompare(b.name, "id", { numeric: true });
}

export function sortPoints(points: TitikGrafik[], kind: JenisGrafik, sort: UrutanGrafik): TitikGrafik[] {
  const timeLike = kind === "line" || kind === "area";
  // Garis/area memakai semua titik; batang/pie dibatasi ke kategori bernilai terbesar.
  const pool = timeLike ? [...points] : [...points].sort((a, b) => b.value - a.value).slice(0, MAX_CATS);
  const mode = sort === "auto" ? (timeLike ? "kategori_asc" : "nilai_desc") : sort;
  switch (mode) {
    case "nilai_desc":
      return pool.sort((a, b) => b.value - a.value);
    case "nilai_asc":
      return pool.sort((a, b) => a.value - b.value);
    case "kategori_asc":
      return pool.sort(byName);
    case "kategori_desc":
      return pool.sort((a, b) => byName(b, a));
  }
}

export function buildOption(cfg: GrafikCfg, points: TitikGrafik[]): { option: Record<string, unknown>; empty: boolean } {
  const data = sortPoints(points, cfg.kind, cfg.sort);
  if (!data.length) return { option: {}, empty: true };

  const horizontal = cfg.kind === "hbar";
  const cats = data.map((d) => d.name);
  const vals = data.map((d) => d.value);
  const base = {
    color: PALETTE,
    textStyle: { fontFamily: "inherit", color: "#334155" },
    tooltip: {
      trigger: cfg.kind === "pie" || cfg.kind === "donut" ? "item" : "axis",
      valueFormatter: (v: unknown) => (typeof v === "number" ? fmtInt(v) : String(v)),
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
        series: [
          {
            type: "pie",
            radius: cfg.kind === "donut" ? ["45%", "72%"] : "70%",
            center: ["50%", "46%"],
            avoidLabelOverlap: true,
            itemStyle: { borderColor: "#fff", borderWidth: 2 },
            label: { show: false },
            data: data.map((d) => ({ name: d.name, value: d.value })),
          },
        ],
      },
    };
  }

  const valueAxis = {
    type: "value",
    axisLabel: { color: "#64748b", fontSize: 11, formatter: (v: number) => fmtCompact(v) },
    splitLine: { lineStyle: { color: "rgba(0,0,0,0.06)" } },
    axisLine: { show: false },
    axisTick: { show: false },
  };
  const catAxis = {
    type: "category",
    data: horizontal ? [...cats].reverse() : cats,
    axisLabel: { color: "#64748b", fontSize: 11, interval: 0, hideOverlap: true, ...(horizontal ? {} : { rotate: cats.length > 6 ? 30 : 0 }) },
    axisLine: { lineStyle: { color: "rgba(0,0,0,0.12)" } },
    axisTick: { show: false },
  };
  const isLine = cfg.kind === "line" || cfg.kind === "area";

  return {
    empty: false,
    option: {
      ...base,
      xAxis: horizontal ? valueAxis : catAxis,
      yAxis: horizontal ? catAxis : valueAxis,
      series: [
        {
          type: isLine ? "line" : "bar",
          data: horizontal ? [...vals].reverse() : vals,
          barMaxWidth: 34,
          smooth: isLine,
          showSymbol: cfg.kind === "line",
          symbolSize: 6,
          lineStyle: isLine ? { width: 2, color: PRIMARY } : undefined,
          itemStyle: { color: PRIMARY, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
          areaStyle:
            cfg.kind === "area"
              ? {
                  color: {
                    type: "linear",
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: "rgba(237,107,35,0.28)" },
                      { offset: 1, color: "rgba(237,107,35,0.02)" },
                    ],
                  },
                }
              : undefined,
        },
      ],
    },
  };
}

let seq = 0;
export const idGrafik = () => `c${++seq}`;

/** Pulihkan grafik tersimpan; jenis, agregasi, atau kolom yang tak dikenal dibuang. */
export function muatGrafik(raw: string | null, valid: Set<string>): GrafikCfg[] {
  try {
    const list = raw ? (JSON.parse(raw) as Omit<GrafikCfg, "id">[]) : [];
    return list
      .filter(
        (c) =>
          JENIS_GRAFIK.some((k) => k.v === c.kind) &&
          AGREGASI.some((a) => a.v === c.agg) &&
          valid.has(c.x) &&
          (c.agg === "count" || valid.has(c.y)),
      )
      .map((c) => ({
        id: idGrafik(),
        kind: c.kind,
        x: c.x,
        y: c.y,
        agg: c.agg,
        // Grafik lama belum punya `sort` → pakai urutan otomatis seperti sebelumnya.
        sort: URUTAN_GRAFIK.some((o) => o.v === c.sort) ? c.sort : "auto",
      }));
  } catch {
    return [];
  }
}

/** Isi yang disimpan: tanpa `id`; daftar kosong → null (kunci dihapus). */
export function simpanGrafik(charts: GrafikCfg[]): string | null {
  return charts.length ? JSON.stringify(charts.map(({ kind, x, y, agg, sort }) => ({ kind, x, y, agg, sort }))) : null;
}

export function judulGrafik(cfg: GrafikCfg, humanize: (k: string) => string): string {
  return `${AGREGASI.find((a) => a.v === cfg.agg)?.label ?? cfg.agg}${cfg.agg === "count" ? "" : ` ${humanize(cfg.y)}`} per ${humanize(cfg.x)}`;
}
