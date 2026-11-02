// E2E sistem (docs/skenario/sistem.md SI-E01): perilaku tiap halaman saat Data API mati. Snapshot
// kelas T diisi sinkron manual, cache P dikosongkan, lalu pemutar fixture diputus lewat sakelarnya.
// Berjalan di project `sistem` sesudah project lain, karena Data API dimatikan untuk semua.
import { expect, test, type Page } from "@playwright/test";

const LARAVEL = process.env.E2E_LARAVEL_URL ?? "http://127.0.0.1:18000";
const FIXTURE = process.env.E2E_FIXTURE_URL ?? "http://127.0.0.1:18090";
const ADMIN = process.env.E2E_ADMIN_TOKEN ?? "";

const TIDAK_ADA = "Tidak ada data.";
const LOS = "Data lama menginap belum tersedia.";
const SDI = "Sumber data sedang tidak tersedia. Coba buka di portal SDI ↗.";
const GMTI = "Gagal memuat daftar fasilitas ibadah (ApiError: Sumber data sedang tidak tersedia.). Muat ulang halaman untuk mencoba lagi.";
const SEMUA_GAGAL = [TIDAK_ADA, LOS, SDI, "Gagal memuat"];

type Baris = { rute: string; perilaku: "utuh" | "sebagian" | "tidak tersedia"; teks?: Record<string, number> };

// Satu baris per rute docs/skenario/sistem.md; `teks` = teks gagal → jumlah kemunculan.
const TABEL: Baris[] = [
  { rute: "/", perilaku: "utuh" },
  { rute: "/katalog", perilaku: "utuh" },
  { rute: "/sdi", perilaku: "utuh" },
  { rute: "/sdi/data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan", perilaku: "tidak tersedia", teks: { [SDI]: 1 } },
  { rute: "/docs", perilaku: "utuh" },
  { rute: "/dashboard", perilaku: "utuh" },
  { rute: "/dashboard/wisman", perilaku: "sebagian", teks: { [TIDAK_ADA]: 5, [LOS]: 1 } },
  { rute: "/dashboard/wisnus", perilaku: "sebagian", teks: { [TIDAK_ADA]: 8, [LOS]: 1 } },
  { rute: "/dashboard/tenaga-kerja", perilaku: "sebagian", teks: { [TIDAK_ADA]: 1 } },
  { rute: "/dashboard/pdrb-ekraf", perilaku: "sebagian", teks: { [TIDAK_ADA]: 3 } },
  { rute: "/gci", perilaku: "utuh" },
  { rute: "/gpci", perilaku: "utuh" },
  { rute: "/gci/CI-FV", perilaku: "utuh" },
  { rute: "/gpci/CE1", perilaku: "utuh" },
  { rute: "/gci/pariwisata/wisatawan-internasional", perilaku: "sebagian", teks: { [SDI]: 3 } },
  { rute: "/gci/pariwisata/kuliner-michelin", perilaku: "sebagian", teks: { [SDI]: 3 } },
  { rute: "/gci/pariwisata/seni-pertunjukan", perilaku: "tidak tersedia" },
  { rute: "/gci/pariwisata/restoran-gci", perilaku: "utuh" },
  { rute: "/gci/pariwisata/direktori-restoran", perilaku: "utuh" },
  { rute: "/gci/pariwisata/pertunjukan-budaya", perilaku: "utuh" },
  { rute: "/gpci/hotel", perilaku: "utuh" },
  { rute: "/gpci/lapangan-golf", perilaku: "utuh" },
  { rute: "/gpci/toko-suvenir", perilaku: "utuh" },
  { rute: "/gmti", perilaku: "sebagian", teks: { [GMTI]: 1 } },
  { rute: "/spatial", perilaku: "sebagian" },
  { rute: "/scraped-hotels", perilaku: "utuh" },
];

async function post(url: string, token?: string) {
  const res = await fetch(url, { method: "POST", headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  return { status: res.status, body: await res.json() };
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.setTimeout(300_000);
  expect(ADMIN, "E2E_ADMIN_TOKEN wajib (token ability admin)").not.toBe("");
  await post(`${FIXTURE}/__uji/hidup`);
  expect((await post(`${LARAVEL}/api/v1/sistem/job/sinkron`, ADMIN)).status).toBe(202);
  // Sinkron berjalan sebagai proses terpisah; tunggu baris JOB_RUNS-nya selesai.
  await expect
    .poll(async () => {
      const r = await fetch(`${LARAVEL}/api/v1/sistem/job`, { headers: { Authorization: `Bearer ${ADMIN}`, Accept: "application/json" } });
      return (await r.json()).data[0]?.status;
    }, { timeout: 240_000, intervals: [2_000] })
    .toBe("sukses");
  expect((await post(`${LARAVEL}/api/v1/sistem/cache/kosongkan`, ADMIN)).status).toBe(200);
  expect((await post(`${FIXTURE}/__uji/mati`)).body).toEqual({ mati: true });
});

test.afterAll(async () => {
  await post(`${FIXTURE}/__uji/hidup`);
});

async function buka(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

for (const b of TABEL) {
  test(`SI-E01 ${b.rute}: ${b.perilaku}`, async ({ page }) => {
    await buka(page, b.rute);
    const isi = page.locator("main, body").first();
    if (b.rute === "/gci/pariwisata/seni-pertunjukan") {
      // Isi halaman hanya dirender bila data ada (v-if), jadi tidak ada judul di bawah navigasi.
      await expect(page.locator("h1")).toHaveCount(0);
      return;
    }
    if (b.rute === "/spatial") {
      // Peta + panel dari snapshot. Yang gagal hanya detail titik (P, `spasial/titik/{id}`): popup
      // tetap terbuka dengan data ringkas, tanpa pesan error (sertifikat tidak menyusul), seperti v2.
      await expect(page.getByText(/Filter peta · [\d.]+ titik/)).toBeVisible();
      // Strip filter berupa <details> (lihat gmti.spec.ts); buka dulu.
      const strip = page.locator("details").first();
      if (!(await strip.evaluate((d: HTMLDetailsElement) => d.open))) await strip.locator("summary").click();
      await strip.getByRole("textbox", { name: "Cari tempat" }).fill("Canary Coffee Shop");
      const pin = page.locator(".leaflet-marker-icon").first();
      await expect(pin).toBeVisible();
      const detail = page.waitForResponse((r) => r.url().includes("/_api/spasial/titik/"));
      await expect(async () => {
        await pin.dispatchEvent("click");
        await expect(page.locator(".leaflet-popup")).toContainText("Canary Coffee Shop", { timeout: 2000 });
      }).toPass({ timeout: 15_000 });
      expect((await detail).status()).toBe(503);
      await expect(page.locator(".leaflet-popup")).not.toContainText(/gagal|error/i);
      return;
    }
    await expect(page.locator("h1").first()).toBeVisible();
    for (const [teks, n] of Object.entries(b.teks ?? {})) {
      await expect(isi.getByText(teks, { exact: true })).toHaveCount(n);
    }
    if (b.perilaku === "utuh") {
      for (const teks of SEMUA_GAGAL) {
        await expect(isi.getByText(teks)).toHaveCount(0);
      }
    }
  });
}
