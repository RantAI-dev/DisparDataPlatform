/** Helper agregasi untuk dashboard bespoke per indikator (Plan 7). */

/**
 * Parse angka Indonesia. Angka JS dikembalikan apa adanya; string berpola ribuan Indonesia
 * dibaca sebagai ribuan, koma tunggal sebagai desimal, selain itu titik desimal:
 * "1.234.567"->1234567, "1.000"->1000, "1.234,5"->1234.5, "51,85"->51.85,
 * "1,234,567"->1234567, "12.5"->12.5, "3645837"->3645837.
 */
export function idNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim();
  if (!s) return null;
  s = s.replace(/[^\d.,-]/g, "");
  if (/^-?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type Row = Record<string, unknown>;
export type Point = { label: string; value: number };

/** Jumlahkan `valueKey` per `groupKey`. */
export function groupSum(rows: Row[], groupKey: string, valueKey: string): Point[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[groupKey] ?? "—");
    m.set(k, (m.get(k) ?? 0) + (idNum(r[valueKey]) ?? 0));
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

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
/** Format label periode: "201801" -> "Jan 2018"; "2024" tetap "2024". */
export function fmtPeriode(s: string): string {
  const m = /^(\d{4})(\d{2})$/.exec(String(s ?? ""));
  if (m) {
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return `${BULAN[mo - 1]} ${m[1]}`;
  }
  return String(s ?? "");
}
