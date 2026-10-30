// Proxy /_api (SPEC §5.2) dan halaman error, dijalankan pada build Nuxt sungguhan dengan Laravel palsu.
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { $fetch, fetch, setup } from "@nuxt/test-utils/e2e";

const TOKEN = "token-frontend-rahasia-uji";
const diterima: IncomingMessage[] = [];
const laravel = createServer((req, res) => {
  diterima.push(req);
  // Laravel "nakal": memantulkan Authorization di header. Proxy tidak boleh meneruskannya.
  res.writeHead(200, {
    "content-type": "application/json",
    "x-request-id": String(req.headers["x-request-id"] ?? ""),
    "x-pantul-auth": String(req.headers.authorization ?? ""),
    "set-cookie": "sesi=x",
  });
  res.end(JSON.stringify({ success: true, message: "OK", data: { path: req.url }, meta: { request_id: "r" } }));
});
await new Promise<void>((r) => laravel.listen(0, "127.0.0.1", r));
afterAll(() => laravel.close());

await setup({
  rootDir: fileURLToPath(new URL("../..", import.meta.url)),
  server: true,
  browser: false,
  env: {
    NUXT_LARAVEL_URL: `http://127.0.0.1:${(laravel.address() as AddressInfo).port}`,
    NUXT_FRONTEND_TOKEN: TOKEN,
  },
});

describe("proxy /_api", () => {
  it("meneruskan GET ke /api/v1 dengan token, f[] berulang, XFF, dan X-Request-Id", async () => {
    const res = await fetch("/_api/dataset/x/baris?f[]=a&f[]=b&page=2", {
      headers: { "x-request-id": "rid-uji-123", "x-forwarded-for": "203.0.113.9" },
    });
    expect(res.status).toBe(200);
    const req = diterima.at(-1)!;
    expect(req.url).toBe("/api/v1/dataset/x/baris?f[]=a&f[]=b&page=2");
    expect(req.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(req.headers["x-request-id"]).toBe("rid-uji-123");
    expect(String(req.headers["x-forwarded-for"])).toMatch(/^203\.0\.113\.9, /);
    expect(res.headers.get("x-request-id")).toBe("rid-uji-123");
  });

  it("tidak pernah mengembalikan token ke browser", async () => {
    const res = await fetch("/_api/katalog");
    const semuaHeader = [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
    expect(semuaHeader).not.toContain(TOKEN);
    expect(res.headers.get("x-pantul-auth")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.text()).not.toContain(TOKEN);
  });

  it("menolak selain GET (405)", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const res = await fetch("/_api/katalog", { method });
      expect(res.status).toBe(405);
    }
  });

  it("menolak sistem/* (404) tanpa meneruskan ke Laravel", async () => {
    const sebelum = diterima.length;
    for (const alamat of ["/_api/sistem/kesehatan", "/_api/sistem/log", "/_api/SISTEM/job", "/_api/%73istem/kesehatan", "/_api/sistem%2Flog"]) {
      expect((await fetch(alamat)).status).toBe(404);
    }
    expect(diterima.length).toBe(sebelum);
  });

  it("menolak jalur yang keluar dari /api/v1 (../)", async () => {
    const sebelum = diterima.length;
    // Sampai ke proxy (encoded slash/backslash, UTF-8 rusak) → 404 oleh proxy.
    for (const alamat of ["/_api/..%2f..%2fsanctum/csrf-cookie", "/_api/katalog/..%5c..%5cx", "/_api/%E0%A4%A"]) {
      expect((await fetch(alamat)).status).toBe(404);
    }
    // %2e%2e sudah dinormalkan klien HTTP menjadi /docs/api (bukan /_api): tidak sampai ke proxy.
    await fetch("/_api/%2e%2e/%2e%2e/docs/api");
    expect(diterima.length).toBe(sebelum);
  });
});

describe("halaman", () => {
  it("redirect lama memakai 307 seperti produksi", async () => {
    const res = await fetch("/atlas/golf", { redirect: "manual" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/gpci/lapangan-golf");
  });

  it("key section tak dikenal → halaman 404 bergaya Next.js", async () => {
    // Browser meminta HTML; tanpa Accept html Nitro menjawab JSON.
    const res = await fetch("/atlas/tidak-ada", { headers: { accept: "text/html" } });
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("404: This page could not be found.");
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain("next-error-h1");
  });

  it("head sama dengan platform-v2", async () => {
    // Halaman sungguhan pertama = galeri /_kerangka (beranda menyusul di plan 11).
    const html = await $fetch<string>("/_kerangka");
    expect(html).toMatch(/<html\s+lang="id"/);
    expect(html).toContain('<link rel="manifest" href="/site.webmanifest">');
  });
});
