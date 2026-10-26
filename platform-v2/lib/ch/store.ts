import { q } from "./client";
import { buildClauses, FilterError, kindOf, type ColKind, type Facet, type RowQuery } from "./query-filter";

/**
 * Primitif data lakehouse — pengganti tabel Postgres lama (dataset/datasetSync/
 * datasetColumn/record). Bentuk kembalian identik dengan drizzle lama.
 *
 * Dua sumber metadata di-UNION:
 *   bronze_meta.*      — dataset primer SDI (tier=primer)
 *   bronze_meta_sec.*  — dataset sekunder olahan (tier=sekunder)
 *
 * BARIS diambil dari lapisan SILVER (processed: bertipe, dibersihkan) —
 * `silver.<table_name>` — bukan Bronze mentah. Itulah yang ditampilkan.
 */

const META = "lake.`bronze_meta.dataset_catalog`";
const META_SEC = "lake.`bronze_meta_sec.dataset_catalog`";
const SYNC = "lake.`bronze_meta.dataset_sync`";
const SYNC_SEC = "lake.`bronze_meta_sec.dataset_sync`";
const COL = "lake.`bronze_meta.dataset_column`";
const COL_SEC = "lake.`bronze_meta_sec.dataset_column`";

export type CatalogRow = {
  slug: string; title: string; description: string; tags: string[];
  views: number; updated_at: string | null; tier: string; table_name: string;
};

/** Katalog SEMUA dataset (primer + sekunder). */
export async function catalog(): Promise<CatalogRow[]> {
  const rows = await q<{
    slug: string; title: string; description: string; tags: string;
    views: string; updated_at: string; tier: string; table_name: string;
  }>(
    `SELECT slug, title, description, tags, toString(views) AS views, updated_at, tier, table_name FROM ${META}
     UNION ALL
     SELECT slug, title, description, tags, toString(views) AS views, updated_at, tier, table_name FROM ${META_SEC}`,
  );
  return rows.map((r) => ({
    slug: r.slug, title: r.title, description: r.description,
    tags: safeJsonArray(r.tags), views: Number(r.views) || 0,
    updated_at: r.updated_at || null, tier: r.tier, table_name: r.table_name,
  }));
}

export type SyncRow = {
  slug: string; title: string; description: string; sumberData: string[];
  frekuensi: string | null; satuan: string | null; klasifikasi: string | null;
  kontak: string | null; author: string | null; total: number; table_name: string;
};

/** Metadata satu dataset (cari di primer, lalu sekunder). */
export async function sync(slug: string): Promise<SyncRow | null> {
  const rows = await q<Record<string, string>>(
    `SELECT slug, title, description, sumber_data, frekuensi, satuan, klasifikasi,
            kontak, author, toString(total) AS total, table_name FROM ${SYNC} WHERE slug={slug:String}
     UNION ALL
     SELECT slug, title, description, sumber_data, frekuensi, satuan, klasifikasi,
            kontak, author, toString(total) AS total, table_name FROM ${SYNC_SEC} WHERE slug={slug:String}
     LIMIT 1`,
    { slug },
  );
  const r = rows[0];
  if (!r) return null;
  return {
    slug: r.slug, title: r.title, description: r.description,
    sumberData: safeJsonArray(r.sumber_data),
    frekuensi: r.frekuensi || null, satuan: r.satuan || null,
    klasifikasi: r.klasifikasi || null, kontak: r.kontak || null,
    author: r.author || null, total: Number(r.total) || 0, table_name: r.table_name,
  };
}

/** Map slug→total untuk SEMUA dataset (readiness). */
export async function syncTotals(): Promise<Map<string, number>> {
  const rows = await q<{ slug: string; total: string }>(
    `SELECT slug, toString(total) AS total FROM ${SYNC}
     UNION ALL SELECT slug, toString(total) AS total FROM ${SYNC_SEC}`,
  );
  return new Map(rows.map((r) => [r.slug, Number(r.total) || 0]));
}

export type ColumnDef = { key: string; description: string | null; type: string | null; ordinal: number };

/** Definisi kolom satu dataset (primer lalu sekunder). */
export async function columns(slug: string): Promise<ColumnDef[]> {
  const rows = await q<{ key_asli: string; deskripsi: string; tipe: string; ord: string }>(
    `SELECT key_asli, deskripsi, tipe, toString(ord) AS ord FROM ${COL} WHERE slug={slug:String}
     UNION ALL
     SELECT key_asli, deskripsi, tipe, toString(ord) AS ord FROM ${COL_SEC} WHERE slug={slug:String}
     ORDER BY ord`,
    { slug },
  );
  return rows.map((r) => ({
    key: r.key_asli, description: r.deskripsi || null,
    type: r.tipe || null, ordinal: Number(r.ord) || 0,
  }));
}

/**
 * Kolom yang ditampilkan/di-export untuk satu dataset: definisi kolom SDI +
 * kolom Silver yang tidak terdaftar di metadata SDI. SDI tidak pernah
 * mendaftarkan `periode_data` sebagai kolom (ia ditempel ke tiap baris), jadi
 * tanpa ini periode hilang dari tabel, grafik, dan export. `periode_data`
 * ditaruh paling depan; kolom tambahan lain di belakang. Kolom metadata yang tidak
 * ada di Silver (mis. `id` yang sengaja dibuang generator Silver) tidak ditampilkan,
 * karena isinya pasti kosong.
 */
export async function displayColumns(slug: string): Promise<ColumnDef[]> {
  const cols = await columns(slug);
  if (!cols.length) return cols;
  const table = await tableFor(slug);
  if (!table || !(await silverAda()).has(table)) return cols;
  const schema = await schemaFor(table);
  const known = new Set(cols.map((c) => c.key));
  const extra = [...schema.keys()]
    .filter((k) => !known.has(k))
    .map((k): ColumnDef => ({ key: k, description: null, type: null, ordinal: 0 }));
  const lead = extra.filter((c) => c.key === "periode_data");
  const rest = extra.filter((c) => c.key !== "periode_data");
  return [...lead, ...cols.filter((c) => schema.has(c.key)), ...rest];
}

/**
 * Rentang `periode_data` satu dataset dari Silver: {min, max} sebagai string
 * ("2025-01-01" untuk kolom Date, "2018" untuk kolom tahun). null bila tidak ada.
 */
export async function periode(slug: string): Promise<{ min: string; max: string } | null> {
  const table = await tableFor(slug);
  if (!table || !(await silverAda()).has(table)) return null;
  if (!(await schemaFor(table)).has("periode_data")) return null;
  const rows = await q<{ lo: string | null; hi: string | null }>(
    `SELECT toString(min(periode_data)) AS lo, toString(max(periode_data)) AS hi
     FROM silver.\`${table}\` WHERE periode_data IS NOT NULL`,
  );
  const r = rows[0];
  if (!r?.lo || !r?.hi) return null;
  return { min: r.lo, max: r.hi };
}

/** Peta slug→Set(kunci) beberapa dataset (primer + sekunder). */
export async function columnKeys(slugs: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (!slugs.length) return map;
  const rows = await q<{ slug: string; key_asli: string }>(
    `SELECT slug, key_asli FROM ${COL} WHERE slug IN {slugs:Array(String)}
     UNION ALL SELECT slug, key_asli FROM ${COL_SEC} WHERE slug IN {slugs:Array(String)}`,
    { slugs },
  );
  for (const c of rows) {
    let set = map.get(c.slug);
    if (!set) map.set(c.slug, (set = new Set()));
    set.add(c.key_asli);
  }
  return map;
}

/** Peta slug→tier (primer + sekunder). */
export async function tiers(slugs: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!slugs.length) return map;
  const rows = await q<{ slug: string; tier: string }>(
    `SELECT slug, tier FROM ${META} WHERE slug IN {slugs:Array(String)}
     UNION ALL SELECT slug, tier FROM ${META_SEC} WHERE slug IN {slugs:Array(String)}`,
    { slugs },
  );
  for (const r of rows) map.set(r.slug, r.tier);
  return map;
}

/** table_name (nama tabel Silver/Bronze) untuk sebuah slug. */
async function tableFor(slug: string): Promise<string | null> {
  const rows = await q<{ table_name: string }>(
    `SELECT table_name FROM ${META} WHERE slug={slug:String}
     UNION ALL SELECT table_name FROM ${META_SEC} WHERE slug={slug:String} LIMIT 1`,
    { slug },
  );
  return rows[0]?.table_name ?? null;
}

/** Tabel Silver yang tersedia (baris ditampilkan dari sini = processed). */
let _silverCache: Set<string> | null = null;
async function silverAda(): Promise<Set<string>> {
  if (_silverCache) return _silverCache;
  const rows = await q<{ name: string }>(`SHOW TABLES FROM silver`);
  _silverCache = new Set(rows.map((r) => r.name));
  return _silverCache;
}

/* ── Medallion (Bronze / Silver / Gold) ──────────────────────────────────── */

export type Medallion = "bronze" | "silver" | "gold";
export type MedallionInfo = {
  level: Medallion;
  /** Nama tabel di lake (Bronze/Silver). */
  table: string;
  /** Mart penyaji yang memakai dataset ini (hanya untuk level "gold"). */
  mart?: string;
};

/**
 * Sumber tiap mart Gold → tabel dasar yang mengisinya.
 *
 * Diturunkan dari SQL lakehouse (satu-satunya tempat mart dibangun):
 *   lakehouse/clickhouse/sql/20-silver-wisman.sql   → silver.wisman
 *   lakehouse/clickhouse/sql/21-silver-curated.sql  → silver.restoran / kunjungan_dtw / event
 *   lakehouse/clickhouse/sql/22-silver-atlas.sql    → silver.atlas
 *   lakehouse/clickhouse/sql/11-dim-more.sql        → silver.dim_indikator
 *   lakehouse/clickhouse/sql/{30,31}-gold*.sql      → serving.mart_*
 *
 * Ditulis eksplisit (bukan dibaca dari system.tables) karena akun app bersifat
 * readonly + query-cache: membaca system.* ditolak ClickHouse. Keberadaan mart
 * dan tabel Silver-nya tetap diverifikasi ke server sebelum diklaim "gold".
 */
const GOLD_SOURCES: Record<string, string[]> = {
  mart_wisman: [
    "data_jumlah_kunjungan_dan_ranking_wisatawan_mancanegara_ke_provinsi_dki_jakarta_melalui_pintu_soekarno_hatta_berdasarkan_kebangsaan",
  ],
  mart_kuliner: ["data_usaha_jasa_makanan_dan_minuman_jenis_usaha_restoran_di_dki_jakarta"],
  mart_event: ["data_event_pariwisata_dan_kebudayaan_dki_jakarta_2011_2019"],
  mart_kunjungan_dtw: ["kunjungan_31_dtw_juli_2026_sumber_mentah"],
  mart_atlas: ["atlas_restoran", "atlas_souvenir", "atlas_nightlife", "atlas_pertunjukan"],
  mart_gci_readiness: ["gci_gpci_indicators"],
};

/** Mart penyaji yang benar-benar ada di lakehouse. */
let _servingCache: Set<string> | null = null;
async function servingAda(): Promise<Set<string>> {
  if (_servingCache) return _servingCache;
  const rows = await q<{ name: string }>(`SHOW TABLES FROM serving`);
  _servingCache = new Set(rows.map((r) => r.name));
  return _servingCache;
}

/**
 * Peta slug → lapisan medallion tertinggi yang sudah dicapai dataset:
 *   bronze — baru tersalin apa adanya ke lake (belum punya model bertipe),
 *   silver — sudah punya model bersih & bertipe (inilah yang ditampilkan),
 *   gold   — sudah dipakai mart penyaji dashboard.
 */
export async function medallion(): Promise<Map<string, MedallionInfo>> {
  const [rows, silver, serving] = await Promise.all([catalog(), silverAda(), servingAda()]);

  // tabel dasar → mart yang memakainya (hanya mart yang benar-benar ada)
  const goldOf = new Map<string, string>();
  for (const [mart, sources] of Object.entries(GOLD_SOURCES)) {
    if (!serving.has(mart)) continue;
    for (const t of sources) if (!goldOf.has(t)) goldOf.set(t, mart);
  }

  const map = new Map<string, MedallionInfo>();
  for (const r of rows) {
    const table = r.table_name;
    if (!table) continue;
    const mart = goldOf.get(table);
    if (mart) map.set(r.slug, { level: "gold", table, mart });
    else if (silver.has(table)) map.set(r.slug, { level: "silver", table });
    else map.set(r.slug, { level: "bronze", table });
  }
  return map;
}

/**
 * Medallion untuk dataset lokal (halaman Atlas) yang datanya juga ada di lake
 * sebagai berkas Bronze. Kunci = id dataset sekunder pada lib/secondary.ts.
 * Dataset yang belum masuk lake sengaja tidak dipetakan (tidak diberi label).
 */
export const ATLAS_TABLES: Record<string, string> = {
  "sec-gci-resto": "atlas_restoran",
  "sec-events": "atlas_pertunjukan",
};

/** Medallion untuk tabel berkas Atlas (di luar katalog SDI). */
export async function medallionForTables(
  tables: string[],
): Promise<Map<string, MedallionInfo>> {
  const [silver, serving] = await Promise.all([silverAda(), servingAda()]);
  const goldOf = new Map<string, string>();
  for (const [mart, sources] of Object.entries(GOLD_SOURCES)) {
    if (!serving.has(mart)) continue;
    for (const t of sources) if (!goldOf.has(t)) goldOf.set(t, mart);
  }
  const map = new Map<string, MedallionInfo>();
  for (const table of tables) {
    const mart = goldOf.get(table);
    if (mart) map.set(table, { level: "gold", table, mart });
    else if (silver.has(table)) map.set(table, { level: "silver", table });
    else map.set(table, { level: "bronze", table });
  }
  return map;
}

/** Kolom audit lakehouse — disembunyikan dari tampilan. */
const AUDIT = new Set(["_ingested_at", "_source_url", "_batch_id", "_row_hash", "_tenant"]);
function stripAudit(r: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(r)) if (!AUDIT.has(k)) out[k] = r[k];
  return out;
}

/** Seluruh baris dataset dari SILVER (processed). */
export async function rowsForRaw(slug: string): Promise<Record<string, unknown>[]> {
  const table = await tableFor(slug);
  if (!table || !(await silverAda()).has(table)) return [];
  const rows = await q<Record<string, unknown>>(`SELECT * FROM silver.\`${table}\``);
  return rows.map(stripAudit);
}

export const rowsFor = rowsForRaw;

/**
 * Skema tabel Silver: nama kolom → tipe ClickHouse, tanpa kolom audit.
 * Di-cache 5 menit supaya filter tidak memanggil DESCRIBE di setiap request,
 * tetapi perubahan skema dari pipeline tetap terbaca.
 */
const SCHEMA_TTL_MS = 5 * 60 * 1000;
const _schemaCache = new Map<string, { at: number; schema: Map<string, string> }>();
async function schemaFor(table: string): Promise<Map<string, string>> {
  const hit = _schemaCache.get(table);
  if (hit && Date.now() - hit.at < SCHEMA_TTL_MS) return hit.schema;
  const rows = await q<{ name: string; type: string }>(`DESCRIBE TABLE silver.\`${table}\``);
  const schema = new Map(rows.filter((r) => !AUDIT.has(r.name)).map((r) => [r.name, r.type]));
  _schemaCache.set(table, { at: Date.now(), schema });
  return schema;
}

/** Tabel Silver + skema sebuah slug, atau null bila belum ada di Silver. */
async function silverTable(slug: string): Promise<{ ref: string; schema: Map<string, string> } | null> {
  const table = await tableFor(slug);
  if (!table || !(await silverAda()).has(table)) return null;
  return { ref: `silver.\`${table}\``, schema: await schemaFor(table) };
}

/** Baris dataset dipaginasi dengan pencarian, filter, dan sort, dari SILVER (processed). */
export async function rowsPage(
  slug: string, offset: number, limit: number, rq: RowQuery,
): Promise<{ rows: Record<string, unknown>[]; count: number }> {
  const t = await silverTable(slug);
  if (!t) return { rows: [], count: 0 };
  const { where, orderBy, params } = buildClauses(rq, t.schema);
  const [rows, cnt] = await Promise.all([
    q<Record<string, unknown>>(
      `SELECT * FROM ${t.ref} ${where} ${orderBy} LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
      { ...params, limit, offset },
    ),
    q<{ c: string }>(`SELECT toString(count()) AS c FROM ${t.ref} ${where}`, params),
  ]);
  return { rows: rows.map(stripAudit), count: Number(cnt[0]?.c ?? 0) };
}

/** Seluruh baris yang cocok dengan pencarian/filter/sort (untuk unduhan). */
export async function rowsFiltered(slug: string, rq: RowQuery): Promise<Record<string, unknown>[]> {
  const t = await silverTable(slug);
  if (!t) return [];
  const { where, orderBy, params } = buildClauses(rq, t.schema);
  const rows = await q<Record<string, unknown>>(`SELECT * FROM ${t.ref} ${where} ${orderBy}`, params);
  return rows.map(stripAudit);
}

export const FACET_MAX_VALUES = 50;

/**
 * Pilihan filter per kolom, dihitung atas SELURUH dataset (bukan hasil filter)
 * supaya pilihan tidak hilang saat filter lain aktif.
 */
export async function facets(slug: string): Promise<Facet[]> {
  const t = await silverTable(slug);
  if (!t) return [];
  const cols = [...t.schema].map(([key, type]) => ({ key, kind: kindOf(type) as ColKind }));
  const ranged = cols.filter((c) => c.kind === "angka" || c.kind === "tanggal");
  const texts = cols.filter((c) => c.kind === "teks");

  const stats = new Map<string, string>();
  const exprs = [
    ...ranged.flatMap((c, i) => [`toString(min(\`${c.key}\`)) AS mn${i}`, `toString(max(\`${c.key}\`)) AS mx${i}`]),
    // uniqUpTo cukup menjawab "≤ batas atau tidak" tanpa menghitung semua nilai unik.
    ...texts.map((c, i) => `toString(uniqUpTo(${FACET_MAX_VALUES + 1})(\`${c.key}\`)) AS u${i}`),
  ];
  if (exprs.length) {
    const [row] = await q<Record<string, string>>(`SELECT ${exprs.join(", ")} FROM ${t.ref}`);
    for (const [k, v] of Object.entries(row ?? {})) stats.set(k, v);
  }

  // Nilai semua kolom kategori (≤ FACET_MAX_VALUES unik) dalam satu query.
  const small = texts.filter((_, i) => Number(stats.get(`u${i}`)) <= FACET_MAX_VALUES);
  const valuesOf = new Map<string, { v: string; n: number }[]>(small.map((c) => [c.key, []]));
  if (small.length) {
    const rows = await q<{ k: string; v: string; n: string }>(
      small.map((c, i) =>
        `SELECT {k${i}:String} AS k, toString(\`${c.key}\`) AS v, toString(count()) AS n FROM ${t.ref}
         WHERE \`${c.key}\` IS NOT NULL AND toString(\`${c.key}\`) != '' GROUP BY v`,
      ).join(" UNION ALL "),
      Object.fromEntries(small.map((c, i) => [`k${i}`, c.key])),
    );
    for (const r of rows) valuesOf.get(r.k)!.push({ v: r.v, n: Number(r.n) });
    for (const list of valuesOf.values()) list.sort((a, b) => b.n - a.n || a.v.localeCompare(b.v, "id"));
  }

  return cols.map((c): Facet => {
    const ri = ranged.indexOf(c);
    if (ri >= 0) return { key: c.key, kind: c.kind as "angka" | "tanggal", min: stats.get(`mn${ri}`), max: stats.get(`mx${ri}`) };
    const values = valuesOf.get(c.key);
    return values ? { key: c.key, kind: "kategori", values } : { key: c.key, kind: "none" };
  });
}

export type Agg = "sum" | "avg" | "count" | "max" | "min";
/** Batas kelompok yang dikembalikan; grafik sendiri memotong ke 30 teratas. */
const AGG_MAX_GROUPS = 1000;

/**
 * Agregasi untuk grafik atas SELURUH baris yang cocok dengan pencarian/filter.
 * Label kosong → "—"; nilai y teks diubah ke angka (koma → titik) seperti di klien.
 */
export async function aggregate(
  slug: string, rq: RowQuery, x: string, y: string, agg: Agg,
): Promise<{ name: string; value: number }[]> {
  const t = await silverTable(slug);
  if (!t) return [];
  if (!t.schema.has(x) || (agg !== "count" && !t.schema.has(y))) throw new FilterError("Kolom grafik tidak dikenal");
  const { where, params } = buildClauses({ ...rq, sort: null }, t.schema);
  const label = `if(trim(ifNull(toString(\`${x}\`), '')) = '', '—', trim(toString(\`${x}\`)))`;
  const num = `toFloat64OrNull(replaceAll(replaceAll(toString(\`${y}\`), ' ', ''), ',', '.'))`;
  const value = agg === "count" ? "count()" : `${agg}(${num})`;
  const having = agg === "count" ? "" : `HAVING count(${num}) > 0`;
  const rows = await q<{ name: string; value: string }>(
    `SELECT ${label} AS name, toString(${value}) AS value FROM ${t.ref} ${where}
     GROUP BY name ${having} ORDER BY ${value} DESC LIMIT ${AGG_MAX_GROUPS}`,
    params,
  );
  return rows.map((r) => ({ name: r.name, value: Number(r.value) }));
}

function safeJsonArray(s: string): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
