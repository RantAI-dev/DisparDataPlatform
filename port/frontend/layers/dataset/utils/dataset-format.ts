/**
 * Format tampilan halaman dataset (app/sdi/[slug]/page.tsx dan DatasetFilters.tsx v2).
 */
import type { Filter } from "./query-filter";

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "periode_data" → "Periode Data". */
export const humanizeKolom = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** "2025-01-01" → "Jan 2025"; nilai tahun ("2018") dibiarkan apa adanya. */
function fmtTitikPeriode(v: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(v);
  return m ? `${BULAN_PENDEK[Number(m[2]) - 1] ?? m[2]} ${m[1]}` : v;
}

/** Rentang periode: "Jan 2025 – Agu 2026", atau satu titik bila min = max. */
export function fmtRentangPeriode(p: { min: string; max: string }): string {
  const a = fmtTitikPeriode(String(p.min));
  const b = fmtTitikPeriode(String(p.max));
  return a === b ? a : `${a} – ${b}`;
}

/** Sel teks: kosong → "—"; deret digit > 4 → format id-ID (tahun 4 digit dibiarkan). */
export function fmtSel(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  if (/^\d{4,}$/.test(s)) {
    const n = Number(s);
    if (!isNaN(n) && s.length > 4) return n.toLocaleString("id-ID");
  }
  return s;
}

/** Label tautan bila sel berisi URL (renderCell v2), selain itu null. */
export function labelTautan(key: string, v: unknown): string | null {
  if (v === null || v === undefined || !/^https?:\/\//i.test(String(v))) return null;
  const k = key.toLowerCase();
  if (k === "gmaps") return "Peta ↗";
  if (k.includes("tripadvisor")) return "TripAdvisor ↗";
  if (k === "sumber" || k.includes("url")) return "Sumber ↗";
  return "Buka ↗";
}

/** Label chip filter: `Kebangsaan: JEPANG, MALAYSIA`, `… 5 nilai`, rentang `lo – hi` (`…` ujung terbuka). */
export function labelChip(f: Filter): string {
  if (f.op === "in") return `${humanizeKolom(f.col)}: ${f.values.length > 2 ? `${f.values.length} nilai` : f.values.join(", ")}`;
  return `${humanizeKolom(f.col)}: ${f.min || "…"} – ${f.max || "…"}`;
}
