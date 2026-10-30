#!/usr/bin/env node
// Perekam fixture Data API (plan 10). Memanggil Data API LOKAL (lakehouse/data-api, `uv run`)
// untuk setiap URL di daftar-url.txt, lalu menyimpan status, header relevan, dan body MENTAH
// (string, tidak di-parse) ke fixtures/data-api/. Body mentah menjaga presisi angka besar dan
// bentuk JSON persis.
//
//   DATA_API_URL=http://localhost:18080 DATA_API_TOKEN=… node tools/fixture-server/rekam.mjs [--bersihkan]
//
// --bersihkan menghapus rekaman yang URL-nya sudah tidak ada di daftar.
import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalkan, namaBerkas } from "./kunci.mjs";

const SINI = dirname(fileURLToPath(import.meta.url));
const DIR = process.env.FIXTURE_DIR ?? join(SINI, "..", "..", "fixtures", "data-api");
const BASIS = (process.env.DATA_API_URL ?? "http://localhost:18080").replace(/\/+$/, "");
const TOKEN = process.env.DATA_API_TOKEN;
// Header yang ikut direkam dan diputar ulang. X-Request-Id tidak: pemutar memantulkan milik request.
const HEADER = ["content-type", "content-disposition", "cache-control"];

if (!TOKEN) {
  console.error("DATA_API_TOKEN wajib diisi (token mentah untuk Data API lokal).");
  process.exit(2);
}

const daftar = readFileSync(join(SINI, "daftar-url.txt"), "utf8")
  .split("\n")
  .map((b) => b.trim())
  .filter((b) => b && !b.startsWith("#"));

mkdirSync(DIR, { recursive: true });
const ditulis = new Set();
let gagal = 0;

for (const alamat of daftar) {
  const kunci = normalkan(alamat);
  const res = await fetch(BASIS + kunci, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" } });
  const body = await res.text();
  if (res.status >= 500) {
    console.error(`GAGAL ${res.status} ${kunci}`);
    gagal++;
    continue;
  }
  const berkas = namaBerkas(kunci);
  const headers = Object.fromEntries(HEADER.filter((h) => res.headers.has(h)).map((h) => [h, res.headers.get(h)]));
  const rekaman = { kunci, status: res.status, headers, body };
  writeFileSync(join(DIR, berkas), JSON.stringify(rekaman, null, 2) + "\n");
  ditulis.add(berkas);
  console.log(`${res.status} ${kunci} → ${berkas} (${body.length} B)`);
}

if (process.argv.includes("--bersihkan")) {
  for (const berkas of readdirSync(DIR).filter((f) => f.endsWith(".json") && !ditulis.has(f))) {
    rmSync(join(DIR, berkas));
    console.log(`dihapus ${berkas}`);
  }
}

console.log(`${ditulis.size} rekaman ditulis, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
