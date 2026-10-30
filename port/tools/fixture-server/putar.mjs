#!/usr/bin/env node
// Pemutar fixture Data API (plan 10). Melayani rekaman di fixtures/data-api/ sebagai pengganti
// Data API untuk CI dan e2e. URL yang tidak terekam dijawab 599 supaya kekurangan rekaman
// langsung terlihat, bukan tertutup data palsu.
//
//   node tools/fixture-server/putar.mjs            # port 8080, direktori fixtures/data-api
//   PORT=18080 FIXTURE_DIR=… node tools/fixture-server/putar.mjs
import { createServer } from "node:http";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalkan } from "./kunci.mjs";

const AKAR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function muatRekaman(dir) {
  const rekaman = new Map();
  for (const berkas of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const r = JSON.parse(readFileSync(join(dir, berkas), "utf8"));
    rekaman.set(r.kunci, r);
  }
  return rekaman;
}

function json(res, status, isi) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(isi));
}

export function buatServer(rekaman) {
  return createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return json(res, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Pemutar fixture hanya melayani GET." } });
    }
    const kunci = normalkan(req.url ?? "/");
    const r = rekaman.get(kunci);
    if (!r) {
      return json(res, 599, {
        error: {
          code: "FIXTURE_TIDAK_ADA",
          message: "URL ini belum direkam. Tambahkan ke tools/fixture-server/daftar-url.txt lalu jalankan rekam.mjs.",
          detail: { kunci },
        },
      });
    }
    const requestId = req.headers["x-request-id"];
    res.writeHead(r.status, {
      "content-type": "application/json",
      ...r.headers,
      ...(requestId ? { "x-request-id": requestId } : {}),
    });
    res.end(req.method === "HEAD" ? undefined : r.body);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.env.FIXTURE_DIR ?? join(AKAR, "fixtures", "data-api");
  const port = Number(process.env.PORT ?? 8080);
  const rekaman = muatRekaman(dir);
  buatServer(rekaman).listen(port, () => {
    console.log(`pemutar fixture: ${rekaman.size} rekaman dari ${dir}, port ${port}`);
  });
}
