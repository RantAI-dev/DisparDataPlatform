/**
 * Isi halaman /docs (plan 11, P3) dari ekspor Scramble `docs/api/laravel-openapi.json`, bukan teks
 * tulisan tangan. Rute `sistem/*` (admin/kesehatan) tidak ditampilkan.
 *
 *   npm run docs:api        # tulis ulang layers/docs/data/endpoints.json
 *
 * Vitest (DS-F08) memastikan endpoints.json sama dengan hasil fungsi ini atas ekspor yang di-commit;
 * CI backend memastikan ekspor itu sama dengan kode.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type DocParam = { name: string; in: "path" | "query" | "header"; type: string; required: boolean; desc: string };
export type DocEndpoint = {
  id: string;
  method: "GET" | "POST";
  path: string;
  title: string;
  desc: string;
  params: DocParam[];
  /** path + query contoh untuk cURL, tanpa base URL. */
  contoh: string;
  /** "json" = envelope JSON, "berkas" = unduhan (ekspor). */
  respons: "json" | "berkas";
  errors: { code: string; when: string }[];
};

type Schema = { type?: string | string[]; enum?: string[]; minimum?: number; maximum?: number; maxLength?: number; items?: Schema };
type OpenApiParam = { name: string; in: DocParam["in"]; required?: boolean; description?: string; schema?: Schema };
type OpenApiOp = { operationId: string; summary?: string; description?: string; parameters?: OpenApiParam[]; responses?: Record<string, unknown> };
type OpenApi = { paths: Record<string, Record<string, OpenApiOp>> };

/** Slug contoh = S1 (docs/skenario/dataset.md). */
const SLUG_CONTOH = "data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan";
const CONTOH_WAJIB: Record<string, string> = { x: "kebangsaan", agg: "count" };
const ARTI_STATUS: Record<string, string> = {
  "401": "Token tidak ada atau tidak valid.",
  "403": "Token tidak memiliki izin untuk akses ini.",
  "422": "Parameter tidak sesuai aturan (rincian per parameter di errors.fields).",
};

function tipe(s: Schema = {}): string {
  const t = (Array.isArray(s.type) ? s.type.filter((x) => x !== "null")[0] : s.type) ?? "string";
  if (s.enum) return s.enum.join(" | ");
  if (t === "array") return `${tipe(s.items)}[]`;
  if (t === "integer" && s.maximum !== undefined) return `integer (${s.minimum ?? 0}–${s.maximum})`;
  if (t === "integer" && s.minimum !== undefined) return `integer (≥ ${s.minimum})`;
  return t;
}

/** Docblock PHP dibungkus per baris; di halaman ditampilkan sebagai satu paragraf. */
const satuBaris = (s?: string) => (s ?? "").replace(/\s*\n\s*/g, " ").trim();

export function dariOpenApi(api: OpenApi): DocEndpoint[] {
  const hasil: DocEndpoint[] = [];
  for (const [path, ops] of Object.entries(api.paths)) {
    if (path.startsWith("/sistem/")) continue;
    for (const [metode, op] of Object.entries(ops)) {
      const params = (op.parameters ?? []).map((p) => ({
        name: p.name,
        in: p.in,
        type: tipe(p.schema),
        required: Boolean(p.required),
        desc: satuBaris(p.description),
      }));
      const query = params.filter((p) => p.in === "query" && p.required).map((p) => `${p.name}=${CONTOH_WAJIB[p.name] ?? ""}`);
      hasil.push({
        id: op.operationId.replace(/\./g, "-"),
        method: metode.toUpperCase() as DocEndpoint["method"],
        path: `/api/v1${path}`,
        title: op.summary ?? op.operationId,
        desc: satuBaris(op.description),
        params,
        contoh: `/api/v1${path.replace("{slug}", SLUG_CONTOH)}${query.length ? `?${query.join("&")}` : ""}`,
        respons: path.endsWith("/ekspor") ? "berkas" : "json",
        errors: Object.keys(op.responses ?? {})
          .filter((k) => k !== "200")
          .map((code) => ({ code, when: ARTI_STATUS[code] ?? "" })),
      });
    }
  }
  return hasil;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const akar = fileURLToPath(new URL("..", import.meta.url));
  const api = JSON.parse(readFileSync(`${akar}../docs/api/laravel-openapi.json`, "utf8")) as OpenApi;
  writeFileSync(`${akar}layers/docs/data/endpoints.json`, `${JSON.stringify(dariOpenApi(api), null, 2)}\n`);
  console.log("layers/docs/data/endpoints.json ditulis");
}
