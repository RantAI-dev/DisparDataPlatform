// Tangkapan layar manual book (plan 18): satu gambar per rute KONTRAK §1, ditulis ke
// docs/manual-book/gambar/. Butuh Nuxt yang sudah jalan (dev atau build) dengan Laravel di belakangnya.
//
//   PORTAL_URL=http://127.0.0.1:3100 npm run tangkapan
//   TANGKAPAN_MOBILE=1 PORTAL_URL=… npm run tangkapan      # tambah versi ponsel (gambar/mobile/)
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/tangkapan",
  timeout: 120_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: process.env.PORTAL_URL ?? "http://127.0.0.1:3000" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    ...(process.env.TANGKAPAN_MOBILE
      ? [{ name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }]
      : []),
  ],
});
