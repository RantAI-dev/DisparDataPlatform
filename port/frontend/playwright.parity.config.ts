// Uji paritas (SPEC §7, plan 17): 26 rute KONTRAK §1 (28 kode indikator, 3 slug SDI, semua tahun
// event) + 6 redirect + skenario interaksi, dibuka di produksi (dispar.rantai.dev) dan di portal pada
// waktu yang sama. Dijalankan lokal saja (butuh produksi + Data API sungguhan), bukan di CI, sesudah
// `php artisan portal:sinkron` hari itu.
//
//   PORTAL_URL=http://127.0.0.1:3000 npm run paritas
//
// Hasil: docs/paritas/laporan-<tanggal>.md (reporter tests/parity/laporan.ts) + HTML Playwright.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/parity",
  timeout: 180_000,
  workers: 2,
  // Hanya *.spec.ts; bantu.ts dan laporan.ts bukan tes.
  testMatch: /\.spec\.ts$/,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/parity", open: "never" }], ["./tests/parity/laporan.ts"]],
  // Tangkapan produksi ditulis di sini sebagai pembanding (bukan baseline yang di-commit).
  snapshotPathTemplate: "test-results/parity-produksi/{projectName}/{arg}{ext}",
  use: { baseURL: process.env.PORTAL_URL ?? "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
  ],
});
