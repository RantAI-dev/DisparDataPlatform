/**
 * DATA MAP — peta seluruh data yang bisa dibaca AI (Silver + Gold), diporting
 * dari `data_map.rs` RantAI-Lakehouse.
 *
 * Isinya per tabel: judul & deskripsi katalog, jumlah baris, kolom bertipe,
 * rentang nilai (angka/tanggal) dan contoh nilai teks yang benar-benar
 * tersimpan. Dibangun sekali lalu di-cache (stale-while-revalidate), karena
 * butuh ±600 query ringan ke ClickHouse.
 *
 * Hanya memakai SHOW TABLES / DESCRIBE / SELECT — akun `dispar_app` tidak bisa
 * membaca system.* (QUERY_CACHE_USED_WITH_SYSTEM_TABLE).
 */
import { q } from "@/lib/ch/client";

export type ColKind = "num" | "date" | "text" | "other";

export type ColInfo = {
  name: string;
  type: string;
  kind: ColKind;
  min?: string;
  max?: string;
  uniq?: number;
  samples?: string[];
};

export type TableInfo = {
  db: "silver" | "serving";
  name: string;
  fq: string;
  rows: number;
  title?: string;
  description?: string;
  tier?: string;
  cols: ColInfo[];
  /** Kolom kunci (tahun, bulan, kategori) — satu baris per kombinasi ini. */
  grain: string[];
  /** Kolom angka yang dijumlahkan. */
  measures: string[];
  error?: string;
};

export type DataMap = { builtAt: number; tables: TableInfo[] };

const TTL_MS = 30 * 60 * 1000;
const CONCURRENCY = 8;
const MAX_STATS_COLS = 30;
const SAMPLE_N = 12;
/** Kolom teks dengan nilai unik ≤ ini dianggap kategori (contoh nilainya ditampilkan). */
const CATEGORICAL_MAX = 80;

function baseType(t: string): string {
  let s = t;
  for (;;) {
    const m = s.match(/^(Nullable|LowCardinality)\((.*)\)$/);
    if (!m) return s;
    s = m[2];
  }
}

function kindOf(t: string): ColKind {
  const b = baseType(t);
  if (/^(U?Int\d+|Float\d+|Decimal)/.test(b)) return "num";
  if (/^(Date|DateTime)/.test(b)) return "date";
  if (/^(String|FixedString|Enum)/.test(b)) return "text";
  return "other";
}

const KEY_LIKE = /(^|_)(tahun|year|bulan|month|periode|period|tanggal|date|tgl|kode|code|id|no|nomor|kuartal|triwulan|semester|minggu|week|lat|lon|latitude|longitude|rt|rw)($|_)/i;

const ident = (s: string) => "`" + s.replace(/`/g, "\\`") + "`";

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

type CatalogRow = { table_name: string; title: string; description: string; tier: string };

async function loadCatalog(): Promise<Map<string, CatalogRow>> {
  const map = new Map<string, CatalogRow>();
  for (const ns of ["bronze_meta", "bronze_meta_sec"]) {
    try {
      const rows = await q<CatalogRow>(
        `SELECT ifNull(table_name,'') table_name, ifNull(title,'') title,
                ifNull(description,'') description, ifNull(tier,'') tier
         FROM lake.\`${ns}.dataset_catalog\``,
      );
      for (const r of rows) {
        const key = r.table_name.replace(/^.*\./, "");
        if (key && !map.has(key)) map.set(key, r);
      }
    } catch {
      /* katalog opsional */
    }
  }
  return map;
}

async function describeTable(db: "silver" | "serving", name: string, cat?: CatalogRow): Promise<TableInfo> {
  const fq = `${db}.${name}`;
  const info: TableInfo = {
    db, name, fq, rows: 0, cols: [], grain: [], measures: [],
    title: cat?.title || undefined,
    description: cat?.description ? cat.description.replace(/\s+/g, " ").slice(0, 300) : undefined,
    tier: cat?.tier || undefined,
  };
  try {
    const desc = await q<{ name: string; type: string }>(`DESCRIBE TABLE ${db}.${ident(name)}`);
    info.cols = desc
      .filter((c) => !c.name.startsWith("_"))
      .map((c) => ({ name: c.name, type: baseType(c.type), kind: kindOf(c.type) }));

    const statCols = info.cols.slice(0, MAX_STATS_COLS);
    const exprs = ["count() AS __n"];
    statCols.forEach((c, i) => {
      const id = ident(c.name);
      if (c.kind === "num" || c.kind === "date") {
        exprs.push(`toString(min(${id})) AS mn${i}`, `toString(max(${id})) AS mx${i}`);
      } else if (c.kind === "text") {
        exprs.push(
          `uniq(${id}) AS u${i}`,
          `arrayMap(x -> substring(x, 1, 48), arraySort(groupUniqArray(${SAMPLE_N})(${id}))) AS s${i}`,
        );
      }
    });
    const [st] = await q<Record<string, unknown>>(`SELECT ${exprs.join(", ")} FROM ${db}.${ident(name)}`);
    info.rows = Number(st?.__n ?? 0);
    statCols.forEach((c, i) => {
      if (c.kind === "num" || c.kind === "date") {
        c.min = st?.[`mn${i}`] as string | undefined;
        c.max = st?.[`mx${i}`] as string | undefined;
      } else if (c.kind === "text") {
        c.uniq = Number(st?.[`u${i}`] ?? 0);
        if (c.uniq <= CATEGORICAL_MAX) c.samples = (st?.[`s${i}`] as string[] | undefined) ?? [];
      }
    });

    for (const c of info.cols) {
      if (c.kind === "date" || KEY_LIKE.test(c.name)) info.grain.push(c.name);
      else if (c.kind === "text" && c.uniq != null && c.uniq <= CATEGORICAL_MAX && c.uniq < info.rows) info.grain.push(c.name);
      else if (c.kind === "num") info.measures.push(c.name);
    }
  } catch (e) {
    info.error = (e instanceof Error ? e.message : String(e)).slice(0, 160);
  }
  return info;
}

async function build(): Promise<DataMap> {
  const [silver, serving, catalog] = await Promise.all([
    q<{ name: string }>(`SHOW TABLES FROM silver`),
    q<{ name: string }>(`SHOW TABLES FROM serving`),
    loadCatalog(),
  ]);
  const targets: { db: "silver" | "serving"; name: string }[] = [
    ...serving
      .map((r) => r.name)
      .filter((n) => n.startsWith("mart_") && !n.endsWith("_baru"))
      .map((name) => ({ db: "serving" as const, name })),
    ...silver.map((r) => ({ db: "silver" as const, name: r.name })),
  ];
  const tables = await pool(targets, CONCURRENCY, (t) => describeTable(t.db, t.name, catalog.get(t.name)));
  return { builtAt: Date.now(), tables };
}

/* ---------- cache (stale-while-revalidate) ---------- */

const g = globalThis as unknown as { __disparDataMap?: { value?: DataMap; pending?: Promise<DataMap> } };
const cache = (g.__disparDataMap ??= {});

function refresh(): Promise<DataMap> {
  if (!cache.pending) {
    cache.pending = build()
      .then((m) => {
        cache.value = m;
        return m;
      })
      .finally(() => {
        cache.pending = undefined;
      });
  }
  return cache.pending;
}

export async function getDataMap(): Promise<DataMap> {
  if (cache.value) {
    if (Date.now() - cache.value.builtAt > TTL_MS) void refresh().catch(() => {});
    return cache.value;
  }
  return refresh();
}

/* ---------- render untuk prompt ---------- */

const fmtN = (n: number) => n.toLocaleString("id-ID");

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Satu baris per tabel — untuk daftar lengkap di system prompt (sengaja ringkas). */
export function compactLine(t: TableInfo): string {
  const maxCols = t.db === "serving" ? 20 : 6;
  const cols = t.cols.map((c) => c.name);
  const shown = cols.slice(0, maxCols).join(", ") + (cols.length > maxCols ? ", …" : "");
  // Judul hanya ditulis kalau menambah informasi di luar nama tabel.
  const s = t.title ? slug(t.title) : "";
  const title = s && !t.name.includes(s.slice(0, 40)) ? ` "${t.title!.slice(0, 80)}"` : "";
  return `- ${t.fq} [${fmtN(t.rows)}]${title}: ${shown}`;
}

/** Uraian lengkap satu tabel: kolom, rentang, nilai yang tersimpan, grain. */
export function detailBlock(t: TableInfo): string {
  const lines: string[] = [];
  const head = `${t.fq} (${fmtN(t.rows)} baris)` + (t.title ? ` — "${t.title}"` : "") + (t.tier ? ` [sumber ${t.tier}]` : "");
  lines.push(head);
  if (t.description) lines.push(`  deskripsi: ${t.description}`);
  if (t.error) lines.push(`  (tidak bisa dibaca: ${t.error})`);
  if (t.grain.length || t.measures.length)
    lines.push(
      `  grain: satu baris per ${t.grain.length ? t.grain.join(" × ") : "(baris detail)"}` +
        (t.measures.length ? `; ukuran: ${t.measures.join(", ")} (SUM untuk total)` : ""),
    );
  for (const c of t.cols) {
    let s = `    ${c.name} ${c.type}`;
    if (c.min != null && c.max != null && (c.min !== "" || c.max !== "")) s += ` — rentang ${c.min}..${c.max}`;
    if (c.kind === "text" && c.uniq != null) {
      s += ` — ${fmtN(c.uniq)} nilai unik`;
      if (c.samples?.length) s += `: ${c.samples.map((v) => JSON.stringify(v)).join(" | ")}`;
    }
    lines.push(s);
  }
  return lines.join("\n");
}

/** Daftar lengkap semua tabel (dipakai di system prompt, stabil → bisa di-cache provider). */
export function catalogSection(map: DataMap): string {
  const gold = map.tables.filter((t) => t.db === "serving" && t.rows > 0);
  const silver = map.tables.filter((t) => t.db === "silver" && t.rows > 0);
  const empty = map.tables.filter((t) => t.rows === 0);
  return [
    `GOLD (database \`serving\`, mart teragregasi — utamakan untuk angka):`,
    ...gold.map(compactLine),
    ``,
    `SILVER (database \`silver\`, baris detail bertipe — ${silver.length} tabel; [n] = jumlah baris):`,
    ...silver.map(compactLine),
    empty.length ? `\nTabel kosong (0 baris, jangan dipakai): ${empty.map((t) => t.fq).join(", ")}` : "",
  ].join("\n");
}

/* ---------- pencarian ---------- */

const STOP = new Set(
  "yang dan di ke dari untuk dengan pada per atau berapa apa saja tampilkan buat buatkan grafik chart data jumlah total tahun bulan jakarta dki provinsi the of in by show".split(" "),
);

function terms(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t)))];
}

export function searchTables(map: DataMap, query: string, k = 8): TableInfo[] {
  const ts = terms(query);
  if (!ts.length) return [];
  const scored = map.tables
    .filter((t) => t.rows > 0)
    .map((t) => {
      const name = t.name.toLowerCase();
      const title = (t.title ?? "").toLowerCase();
      const desc = (t.description ?? "").toLowerCase();
      const cols = t.cols.map((c) => c.name.toLowerCase()).join(" ");
      const vals = t.cols.flatMap((c) => c.samples ?? []).join(" ").toLowerCase();
      let score = 0;
      for (const w of ts) {
        if (name.includes(w)) score += 3;
        if (title.includes(w)) score += 3;
        if (cols.includes(w)) score += 2;
        if (desc.includes(w)) score += 1;
        if (vals.includes(w)) score += 1;
      }
      if (t.db === "serving") score *= 1.3;
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.t.rows - a.t.rows);
  return scored.slice(0, k).map((x) => x.t);
}

export function findTable(map: DataMap, ref: string): TableInfo | undefined {
  const r = ref.trim().replace(/[`"]/g, "").toLowerCase();
  return (
    map.tables.find((t) => t.fq.toLowerCase() === r) ??
    map.tables.find((t) => t.name.toLowerCase() === r.replace(/^(silver|serving)\./, ""))
  );
}
