/**
 * Tangkapan layar untuk docs/manual-book (plan 18). Bukan uji: tidak ada assertion selain halaman
 * terbuka dengan status < 400. Daftar = 26 rute KONTRAK §1; rute dinamis memakai contoh tetap
 * (slug S1 docs/skenario/dataset.md, kode CE1 dan CI-IC).
 */
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const RUTE: { nama: string; path: string }[] = [
  { nama: "beranda", path: "/" },
  { nama: "katalog", path: "/katalog" },
  { nama: "sdi", path: "/sdi" },
  { nama: "sdi-detail", path: "/sdi/data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan" },
  { nama: "docs", path: "/docs" },
  { nama: "dashboard", path: "/dashboard" },
  { nama: "dashboard-wisman", path: "/dashboard/wisman" },
  { nama: "dashboard-wisnus", path: "/dashboard/wisnus" },
  { nama: "dashboard-tenaga-kerja", path: "/dashboard/tenaga-kerja" },
  { nama: "dashboard-pdrb-ekraf", path: "/dashboard/pdrb-ekraf" },
  { nama: "gci", path: "/gci" },
  { nama: "gpci", path: "/gpci" },
  { nama: "gci-indikator", path: "/gci/CE1" },
  { nama: "gpci-indikator", path: "/gpci/CI-IC" },
  { nama: "wisatawan-internasional", path: "/gci/pariwisata/wisatawan-internasional" },
  { nama: "kuliner-michelin", path: "/gci/pariwisata/kuliner-michelin" },
  { nama: "seni-pertunjukan", path: "/gci/pariwisata/seni-pertunjukan" },
  { nama: "restoran-gci", path: "/gci/pariwisata/restoran-gci" },
  { nama: "direktori-restoran", path: "/gci/pariwisata/direktori-restoran" },
  { nama: "pertunjukan-budaya", path: "/gci/pariwisata/pertunjukan-budaya" },
  { nama: "hotel", path: "/gpci/hotel" },
  { nama: "lapangan-golf", path: "/gpci/lapangan-golf" },
  { nama: "toko-suvenir", path: "/gpci/toko-suvenir" },
  { nama: "gmti", path: "/gmti" },
  { nama: "spatial", path: "/spatial" },
  { nama: "scraped-hotels", path: "/scraped-hotels" },
];

const KELUAR = fileURLToPath(new URL("../../../docs/manual-book/gambar/", import.meta.url));

for (const { nama, path } of RUTE) {
  test(`${nama} ${path}`, async ({ page }, info) => {
    const folder = info.project.name === "desktop" ? KELUAR : `${KELUAR}${info.project.name}/`;
    mkdirSync(folder, { recursive: true });
    const res = await page.goto(path, { waitUntil: "load" });
    expect(res?.status()).toBeLessThan(400);
    // Halaman yang dirender di klien (mis. seni-pertunjukan) baru punya judul setelah data datang.
    await page.locator("main h1").first().waitFor({ timeout: 45_000 }).catch(() => {});
    // Data klien dan tile peta: tunggu jaringan tenang, tetapi jangan gagal bila tile terus dimuat.
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    // Animasi ECharts (canvas) tidak ikut `animations: "disabled"`.
    await page.waitForTimeout(1_500);
    await page.screenshot({ path: `${folder}${nama}.png`, animations: "disabled" });
  });
}
