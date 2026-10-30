// Uji paritas (SPEC §7): setiap rute dibuka di produksi (dispar.rantai.dev) dan di portal pada waktu
// yang sama. Dijalankan lokal saja (butuh produksi + Data API sungguhan), bukan di CI.
//
//   PORTAL_URL=http://127.0.0.1:3000 npx playwright test -c playwright.parity.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/parity",
  timeout: 180_000,
  workers: 2,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/parity", open: "never" }]],
  // Tangkapan produksi ditulis di sini sebagai pembanding (bukan baseline yang di-commit).
  snapshotPathTemplate: "test-results/parity-produksi/{projectName}/{arg}{ext}",
  use: { baseURL: process.env.PORTAL_URL ?? "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
  ],
});
