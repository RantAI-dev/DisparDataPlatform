/**
 * Format dan parser angka gaya Indonesia (inventaris A §4.5), disatukan dari lib/agg.ts,
 * components/dashboard/Kit.tsx, dan lib/gmti.ts platform-v2. Nama `idNum` di React dipakai untuk
 * dua hal berbeda; di sini parsernya bernama `parseIdNum`.
 */

export type Row = Record<string, unknown>;
export type Point = { label: string; value: number };

/** 1234567 → "1.234.567", 51.85 → "51,85" (formatter semua chart; `idNum` lib/gmti.ts). */
export const idfmt = (v: number) => v.toLocaleString("id-ID");

/** Angka dengan d desimal tetap (Kit.tsx). */
export const idNum = (v: number, d = 0) => v.toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });

/**
 * Parse angka Indonesia: "51,85"->51.85, "3645837"->3645837.
 * Ditiru persis (K-10) dengan quirk-nya: titik diikuti angka dianggap desimal ("1.000"->1,
 * "1.234,5"->1.2345, "1.234.567"->null), dan hanya koma pertama yang jadi desimal
 * ("1,234,567"->1.234567). Komentar asli di lib/agg.ts mengklaim "1.234.567"->1234567.
 */
export function parseIdNum(v: unknown): number | null {
  let s = String(v ?? "").trim();
  if (!s) return null;
  if (s.includes(",") && !/\.\d/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** Format label periode: "201801" -> "Jan 2018"; "2024" tetap "2024". */
export function fmtPeriode(s: string): string {
  const m = /^(\d{4})(\d{2})$/.exec(String(s ?? ""));
  if (m) {
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return `${BULAN[mo - 1]} ${m[1]}`;
  }
  return String(s ?? "");
}

/** Jumlahkan `valueKey` per `groupKey`. */
export function groupSum(rows: Row[], groupKey: string, valueKey: string): Point[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[groupKey] ?? "—");
    m.set(k, (m.get(k) ?? 0) + (parseIdNum(r[valueKey]) ?? 0));
  }
  return [...m].map(([label, value]) => ({ label, value }));
}

/** Hitung jumlah baris per `groupKey` (untuk registry/event: tiap baris = 1 record). */
export function groupCount(rows: Row[], groupKey: string): Point[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[groupKey] ?? "—");
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([label, value]) => ({ label, value }));
}

/** Series per periode (sum nilai, atau count baris bila valueKey tak diberi). */
export function byPeriod(rows: Row[], periodKey: string, valueKey?: string): Point[] {
  const agg = valueKey ? groupSum(rows, periodKey, valueKey) : groupCount(rows, periodKey);
  return agg.sort((a, b) => a.label.localeCompare(b.label));
}

export function topN(arr: Point[], n = 10): Point[] {
  return [...arr].sort((a, b) => b.value - a.value).slice(0, n);
}

export function total(arr: Point[]): number {
  return arr.reduce((s, x) => s + x.value, 0);
}
