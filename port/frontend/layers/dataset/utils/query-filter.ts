/**
 * Filter, sort, dan pencarian baris dataset (lib/ch/query-filter.ts v2, bagian klien). Satu bentuk
 * dipakai tabel, unduhan, dan grafik supaya ketiganya selalu menampilkan baris yang sama:
 *
 *   q=<teks>   f=<kolom>:in:<nilai> (berulang)   f=<kolom>:range:<min>..<max>   sort=<kolom>:asc|desc
 *
 * Ke Laravel, `f` dikirim sebagai `f[]` (useApi); Laravel meneruskannya ke Data API sebagai `f=`.
 */
export type Filter = { col: string; op: "in"; values: string[] } | { col: string; op: "range"; min: string; max: string };
export type Sort = { col: string; dir: "asc" | "desc" };
export type RowQuery = { search: string; filters: Filter[]; sort: Sort | null };

/** Bagian query untuk API: `q`, `f` (array), `sort`; kosong dibuang. */
export function queryBaris(rq: RowQuery): { q?: string; f?: string[]; sort?: string } {
  const f: string[] = [];
  for (const x of rq.filters) {
    if (x.op === "in") for (const v of x.values) f.push(`${x.col}:in:${v}`);
    else f.push(`${x.col}:range:${x.min}..${x.max}`);
  }
  return {
    ...(rq.search ? { q: rq.search } : {}),
    ...(f.length ? { f } : {}),
    ...(rq.sort ? { sort: `${rq.sort.col}:${rq.sort.dir}` } : {}),
  };
}

/** Kebalikan `queryBaris` (parseRowQuery v2 tanpa batas jumlah; validasi ada di Data API). */
export function parseQueryBaris(qs: { q?: string; f?: string[]; sort?: string }): RowQuery {
  const byCol = new Map<string, Filter>();
  for (const raw of qs.f ?? []) {
    const i = raw.indexOf(":");
    const j = raw.indexOf(":", i + 1);
    if (i <= 0 || j < 0) continue;
    const col = raw.slice(0, i);
    const op = raw.slice(i + 1, j);
    const value = raw.slice(j + 1);
    if (op === "in") {
      const prev = byCol.get(col);
      const values = prev?.op === "in" ? prev.values : [];
      if (!values.includes(value)) values.push(value);
      byCol.set(col, { col, op: "in", values });
    } else if (op === "range") {
      const k = value.indexOf("..");
      if (k >= 0) byCol.set(col, { col, op: "range", min: value.slice(0, k).trim(), max: value.slice(k + 2).trim() });
    }
  }
  let sort: Sort | null = null;
  if (qs.sort) {
    const k = qs.sort.lastIndexOf(":");
    const dir = qs.sort.slice(k + 1);
    if (k > 0 && (dir === "asc" || dir === "desc")) sort = { col: qs.sort.slice(0, k), dir };
  }
  return { search: (qs.q ?? "").trim(), filters: [...byCol.values()], sort };
}

/** Ganti (atau hapus bila `next` null) filter satu kolom (DatasetFilters.tsx withFilter). */
export function denganFilter(filters: Filter[], col: string, next: Filter | null): Filter[] {
  const rest = filters.filter((f) => f.col !== col);
  return next ? [...rest, next] : rest;
}
