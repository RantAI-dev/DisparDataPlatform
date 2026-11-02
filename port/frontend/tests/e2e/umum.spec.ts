// E2E lintas fitur (dipindah dari galeri /_kerangka plan 10, dihapus plan 17): redirect lama,
// halaman 404, dan kesehatan backend.
import { expect, test, type Page } from "@playwright/test";

/** Kumpulkan error konsol + error halaman selama tes. */
function pantauError(page: Page) {
  const err: string[] = [];
  page.on("console", (m) => m.type() === "error" && err.push(m.text()));
  page.on("pageerror", (e) => err.push(String(e)));
  return err;
}

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
