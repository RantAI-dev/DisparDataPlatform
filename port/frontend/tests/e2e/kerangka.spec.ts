// E2E plan 10: galeri /_kerangka, satu redirect lama, halaman error, dan kesehatan backend.
import { expect, test, type Page } from "@playwright/test";

/** Kumpulkan error konsol + error halaman selama tes. */
function pantauError(page: Page) {
  const err: string[] = [];
  page.on("console", (m) => m.type() === "error" && err.push(m.text()));
  page.on("pageerror", (e) => err.push(String(e)));
  return err;
}

// Rute dataset Laravel baru ada di plan 11; galeri memakai jawaban berbentuk kontrak
// (docs/api/laravel-openapi.draft.yaml: dataset/{slug}/halaman dan /baris).
async function palsukanDataset(page: Page) {
  const baris = Array.from({ length: 3 }, (_, i) => ({ periode_data: 2011, nama_event: `Event ${i + 1}`, tempat: "PROVINSI" }));
  await page.route("**/_api/dataset/**", (route) => {
    const halaman = route.request().url().includes("/halaman");
    const data = halaman
      ? { dataset: { total_bronze: 1391 }, kolom: { items: [{ key: "nama_event", desc: "komponen", type: "varchar" }] }, baris: { items: baris } }
      : { items: baris };
    return route.fulfill({ json: { success: true, message: "OK", data, meta: { request_id: "e2e", total: 3 } } });
  });
}

test("galeri /_kerangka merender chart, peta, dan tabel tanpa error konsol", async ({ page }) => {
  const err = pantauError(page);
  await palsukanDataset(page);
  // Tile peta dari internet tidak ikut diuji (jaringan CI); peta tetap dibuat.
  await page.route(/arcgisonline|openstreetmap/, (r) => r.fulfill({ status: 204 }));
  await page.goto("/_kerangka");
  await expect(page.getByRole("heading", { name: "Kerangka komponen" })).toBeVisible();
  await expect(page.locator(".utility-card canvas")).toHaveCount(11, { timeout: 20_000 });
  await expect(page.locator(".leaflet-container")).toHaveCount(1);
  await page.getByText("Lihat data mentah").click();
  await expect(page.getByText("3 / 3 baris")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Event 2" })).toBeVisible();
  expect(err).toEqual([]);
});

test("halaman galeri lain dirender tanpa error konsol", async ({ page }) => {
  const err = pantauError(page);
  await page.route(/arcgisonline|openstreetmap/, (r) => r.fulfill({ status: 204 }));
  for (const [path, tunggu] of [
    ["/_kerangka/pariwisata", page.getByText("Jakarta International Stadium (JIS)").first()],
    ["/_kerangka/dashboard", page.getByRole("heading", { name: "Dashboard Statistik Pariwisata dan Ekonomi Kreatif" })],
    ["/_kerangka/spasial", page.getByText(/4\.217 \/ 4\.217 titik/)],
  ] as const) {
    await page.goto(path);
    await expect(tunggu).toBeAttached({ timeout: 30_000 });
  }
  expect(err).toEqual([]);
});

test("redirect lama 307 ke halaman baru", async ({ request }) => {
  const res = await request.get("/atlas/golf", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toBe("/gpci/lapangan-golf");
});

test("rute tak dikenal → halaman 404 bergaya Next.js", async ({ page }) => {
  const err = pantauError(page);
  const res = await page.goto("/tidak-ada");
  expect(res?.status()).toBe(404);
  await expect(page.locator("h1.next-error-h1")).toHaveText("404");
  await expect(page.locator("h2")).toHaveText("This page could not be found.");
  await expect(page).toHaveTitle("404: This page could not be found.");
  // Satu-satunya error konsol yang wajar: Chrome mencatat status 404 dokumen itu sendiri.
  expect(err.filter((e) => !e.includes("status of 404"))).toEqual([]);
});

test("backend sehat: Oracle dan Data API ok", async ({ request }) => {
  test.skip(!process.env.E2E_LARAVEL_URL, "E2E_LARAVEL_URL tidak diisi (hanya frontend)");
  const res = await request.get(`${process.env.E2E_LARAVEL_URL}/api/v1/sistem/kesehatan`);
  expect(res.status()).toBe(200);
  expect((await res.json()).data).toMatchObject({ status: "ok", komponen: { oracle: "ok", data_api: "ok" } });
});
