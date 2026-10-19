/**
 * Filter, sort, dan pencarian untuk baris dataset di Silver.
 *
 * Dipakai bersama oleh tabel (`/api/sdi/[slug]`), unduhan (`/export`), dan
 * grafik (`/aggregate`) supaya ketiganya selalu menampilkan baris yang sama.
 *
 * Parameter URL:
 *   q=<teks>                       pencarian teks di semua kolom
 *   f=<kolom>:in:<nilai>           filter kategori; ulangi `f` untuk nilai lain di kolom yang sama
 *   f=<kolom>:range:<min>..<max>   filter angka/tanggal; salah satu ujung boleh kosong
 *   sort=<kolom>:asc|desc          urutan satu kolom
 *
 * Keamanan: nama kolom hanya diterima bila ada di skema tabel (lalu dikutip
 * backtick), dan semua nilai dikirim sebagai parameter query ClickHouse —
 * tidak pernah disambung ke teks SQL. Input yang tidak valid → `FilterError`
 * (route mengembalikan 400).
 */

export const MAX_FILTERS = 20;
export const MAX_VALUES = 100;
const MAX_VALUE_LEN = 500;

export class FilterError extends Error {}

export type Filter =
  | { col: string; op: "in"; values: string[] }
  | { col: string; op: "range"; min: string; max: string };

export type Sort = { col: string; dir: "asc" | "desc" };

export type RowQuery = { search: string; filters: Filter[]; sort: Sort | null };

export type ColKind = "angka" | "tanggal" | "teks" | "lain";

/** Pilihan filter satu kolom (dari `/api/sdi/[slug]/facets`). */
export type Facet = {
  key: string;
  kind: "kategori" | "angka" | "tanggal" | "none";
  values?: { v: string; n: number }[];
  min?: string;
  max?: string;
};

/** Jenis filter untuk sebuah tipe ClickHouse (Nullable/LowCardinality dilepas). */
export function kindOf(type: string): ColKind {
  let t = type;
  for (let u = t; ; t = u) {
    u = t.replace(/^(?:Nullable|LowCardinality)\((.*)\)$/, "$1");
    if (u === t) break;
  }
  if (/^(U?Int\d+|Float\d+|Decimal)/.test(t)) return "angka";
  if (/^(Date|Date32|DateTime)/.test(t)) return "tanggal";
  if (t === "String" || t.startsWith("FixedString")) return "teks";
  return "lain";
}

/** Parse parameter URL tanpa menyentuh skema (validasi kolom ada di `buildClauses`). */
export function parseRowQuery(sp: URLSearchParams): RowQuery {
  const search = (sp.get("q") || "").trim().slice(0, MAX_VALUE_LEN);

  const byCol = new Map<string, Filter>();
  for (const raw of sp.getAll("f")) {
    const i = raw.indexOf(":");
    const j = raw.indexOf(":", i + 1);
    if (i <= 0 || j < 0) throw new FilterError(`Format filter tidak valid: ${raw}`);
    const col = raw.slice(0, i);
    const op = raw.slice(i + 1, j);
    const value = raw.slice(j + 1);
    if (value.length > MAX_VALUE_LEN) throw new FilterError("Nilai filter terlalu panjang");

    if (op === "in") {
      const prev = byCol.get(col);
      if (prev && prev.op !== "in") throw new FilterError(`Filter ganda untuk kolom ${col}`);
      const values = prev ? prev.values : [];
      if (!values.includes(value)) values.push(value);
      if (values.length > MAX_VALUES) throw new FilterError(`Terlalu banyak nilai untuk kolom ${col}`);
      byCol.set(col, { col, op: "in", values });
    } else if (op === "range") {
      if (byCol.has(col)) throw new FilterError(`Filter ganda untuk kolom ${col}`);
      const k = value.indexOf("..");
      if (k < 0) throw new FilterError(`Rentang tidak valid: ${value}`);
      const min = value.slice(0, k).trim();
      const max = value.slice(k + 2).trim();
      if (!min && !max) throw new FilterError(`Rentang kosong untuk kolom ${col}`);
      byCol.set(col, { col, op: "range", min, max });
    } else {
      throw new FilterError(`Operator tidak dikenal: ${op}`);
    }
  }
  if (byCol.size > MAX_FILTERS) throw new FilterError("Terlalu banyak filter");

  let sort: Sort | null = null;
  const s = sp.get("sort");
  if (s) {
    const k = s.lastIndexOf(":");
    const dir = s.slice(k + 1);
    if (k <= 0 || (dir !== "asc" && dir !== "desc")) throw new FilterError(`Sort tidak valid: ${s}`);
    sort = { col: s.slice(0, k), dir };
  }

  return { search, filters: [...byCol.values()], sort };
}

/** Kembalikan parameter URL dari sebuah RowQuery (dipakai klien). */
export function rowQueryParams(rq: RowQuery): URLSearchParams {
  const sp = new URLSearchParams();
  if (rq.search) sp.set("q", rq.search);
  for (const f of rq.filters) {
    if (f.op === "in") for (const v of f.values) sp.append("f", `${f.col}:in:${v}`);
    else sp.append("f", `${f.col}:range:${f.min}..${f.max}`);
  }
  if (rq.sort) sp.set("sort", `${rq.sort.col}:${rq.sort.dir}`);
  return sp;
}

const NUM = /^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function quoteCol(schema: Map<string, string>, col: string): string {
  if (!schema.has(col) || col.includes("`")) throw new FilterError(`Kolom tidak dikenal: ${col}`);
  return `\`${col}\``;
}

/**
 * Susun klausa WHERE dan ORDER BY ter-parameter untuk skema tabel tertentu.
 * `schema` = nama kolom → tipe ClickHouse (tanpa kolom audit).
 */
export function buildClauses(
  rq: RowQuery,
  schema: Map<string, string>,
): { where: string; orderBy: string; params: Record<string, unknown> } {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (rq.search) {
    clauses.push("positionCaseInsensitive(toString(tuple(*)), {q:String}) > 0");
    params.q = rq.search;
  }

  rq.filters.forEach((f, i) => {
    const col = quoteCol(schema, f.col);
    const kind = kindOf(schema.get(f.col)!);
    if (f.op === "in") {
      clauses.push(`toString(${col}) IN {f${i}:Array(String)}`);
      params[`f${i}`] = f.values;
      return;
    }
    if (kind === "angka") {
      for (const [v, cmp, key] of [[f.min, ">=", "lo"], [f.max, "<=", "hi"]] as const) {
        if (!v) continue;
        if (!NUM.test(v)) throw new FilterError(`Angka tidak valid: ${v}`);
        clauses.push(`${col} ${cmp} {f${i}${key}:Float64}`);
        params[`f${i}${key}`] = Number(v);
      }
    } else if (kind === "tanggal") {
      for (const [v, cmp, key] of [[f.min, ">=", "lo"], [f.max, "<=", "hi"]] as const) {
        if (!v) continue;
        if (!DATE.test(v)) throw new FilterError(`Tanggal tidak valid: ${v}`);
        clauses.push(`toDate(${col}) ${cmp} {f${i}${key}:Date}`);
        params[`f${i}${key}`] = v;
      }
    } else {
      throw new FilterError(`Kolom ${f.col} tidak mendukung filter rentang`);
    }
  });

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  // Pengurut cadangan deterministik: baris dengan nilai sort sama tetap
  // berurutan konsisten antar-halaman lazy-load (tidak terulang/terlewat).
  const orderBy = rq.sort
    ? `ORDER BY ${quoteCol(schema, rq.sort.col)} ${rq.sort.dir === "asc" ? "ASC" : "DESC"} NULLS LAST, cityHash64(toString(tuple(*)))`
    : "";
  return { where, orderBy, params };
}

export function isFiltered(rq: RowQuery): boolean {
  return Boolean(rq.search) || rq.filters.length > 0;
}
