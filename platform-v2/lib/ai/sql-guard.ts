/**
 * Penjaga SQL buatan AI. Ini lapis pertama saja — lapis kedua adalah akun
 * ClickHouse `dispar_app` (profil `app_readonly`: readonly=1, 30 dtk, 100k baris),
 * yang juga menolak table function seperti url() di mode readonly.
 *
 * Aturan: satu statement SELECT/WITH, hanya database `silver` dan `serving`,
 * tanpa table function, tanpa SETTINGS/FORMAT, dan hasil selalu dibungkus LIMIT.
 */

const WRITE_WORDS =
  /\b(insert|alter|drop|delete|update|create|truncate|attach|detach|rename|grant|revoke|optimize|kill|exchange|undrop|backup|restore)\b/i;

const TABLE_FUNCS =
  /\b(url|urlcluster|s3|s3cluster|gcs|azureblobstorage\w*|hdfs\w*|file|filecluster|remote|remotesecure|cluster|clusterallreplicas|mysql|postgresql|sqlite|mongodb|redis|jdbc|odbc|executable|input|iceberg\w*|deltalake\w*|hudi\w*|merge|loop|viewifpermitted|fuzzjson|generaterandom|ytsaurus|arrowflight)\s*\(/i;

/** Buang komentar dan isi string literal supaya pengecekan kata kunci tidak tertipu. */
function stripLiterals(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^'\\]|\\.|'')*'/g, "''");
}

export type GuardResult = { ok: true; sql: string } | { ok: false; error: string };

export function guardSql(raw: string, limit = 500): GuardResult {
  const sql = String(raw ?? "").trim().replace(/;+\s*$/, "");
  if (!sql) return { ok: false, error: "SQL kosong" };
  const bare = stripLiterals(sql);
  if (bare.includes(";")) return { ok: false, error: "Hanya satu statement yang diizinkan" };
  if (!/^\s*\(?\s*(with|select)\b/i.test(bare)) return { ok: false, error: "Hanya SELECT/WITH yang diizinkan" };
  if (WRITE_WORDS.test(bare)) return { ok: false, error: "Query mengandung perintah tulis — ditolak" };
  if (/\bsettings\b/i.test(bare)) return { ok: false, error: "SETTINGS tidak diizinkan" };
  if (/\bformat\s+[a-z]/i.test(bare)) return { ok: false, error: "FORMAT tidak diizinkan" };
  if (TABLE_FUNCS.test(bare)) return { ok: false, error: "Table function (url/s3/remote/file/…) tidak diizinkan" };
  // Setiap nama tabel berkualifikasi db.tabel harus di silver atau serving.
  for (const m of bare.matchAll(/\b(?:from|join)\s+[`"]?([a-z_][a-z0-9_]*)[`"]?\s*\.\s*[`"]?[a-z0-9_]/gi)) {
    const db = m[1].toLowerCase();
    if (db !== "silver" && db !== "serving")
      return { ok: false, error: `Database '${db}' tidak diizinkan — hanya silver.* dan serving.*` };
  }
  if (/\b(system|information_schema|lake)\s*\.\s*[`"a-z_]/i.test(bare))
    return { ok: false, error: "Hanya silver.* dan serving.* yang boleh dibaca" };
  const cap = Math.max(1, Math.min(limit, 5000));
  return { ok: true, sql: `SELECT * FROM (\n${sql}\n) LIMIT ${cap}` };
}
