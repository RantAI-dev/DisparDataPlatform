// E2E fitur indikator (docs/skenario/indikator.md IN-E*), melawan Laravel + fixture-server.
import { expect, test, type Page } from "@playwright/test";

const KODE = ["CE1", "CE2", "CE3", "CE4", "BA-MICE", "CE5", "CE6", "HC-VISA", "CI-IC", "CI-CE", "CI-CX", "CI-AM", "CI-TA", "CI-WH", "CI-NL", "CI-TH", "CI-MU", "CI-ST", "CI-HR", "CI-LH", "CI-SH", "CI-DI", "CI-FR", "CI-FV", "AC-DF", "AC-AP", "AC-AR", "AC-TT"];
const GPCI = new Set(KODE.slice(8));

async function buka(page: Page, url: string) {
  await page.route(/arcgisonline|openstreetmap|google\.com\/maps/, (r) => r.fulfill({ status: 204 }));
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

test("IN-E01 /gci: peringkat resmi, kartu pariwisata, dan pindah ke GPCI", async ({ page }) => {
  await buka(page, "/gci");
  await expect(page.getByText("Peringkat Pengalaman Budaya")).toBeVisible();
  await expect(page.getByText("2.767.622")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dataset GCI" })).toBeVisible();
  await page.goto("/gpci");
  await expect(page.getByRole("heading", { name: "Mori — Global Power City Index (GPCI)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dataset GPCI" })).toBeVisible();
});

test("IN-E02 tabel kesiapan → detail indikator → kembali ke framework", async ({ page }) => {
  await buka(page, "/gci");
  await expect(page.getByRole("heading", { name: "Kesiapan indikator" })).toBeVisible();
  await page.getByRole("link", { name: "Wisatawan internasional", exact: true }).click();
  await expect(page).toHaveURL(/\/gci\/CE1$/);
  await expect(page.getByRole("heading", { level: 1, name: "Wisatawan internasional" })).toBeVisible();
  await expect(page.getByText("Cara indeks mengukur")).toBeVisible();
  await page.getByRole("link", { name: /← GCI · Cultural Experience/ }).click();
  await expect(page).toHaveURL(/\/gci$/);
});

test("IN-E03 ke-28 indikator dirender tanpa error; 9 gap memakai kartu Data belum tersedia", async ({ page }) => {
  test.setTimeout(180_000);
  const err: string[] = [];
  page.on("pageerror", (e) => err.push(String(e)));
  let gap = 0;
  for (const k of KODE) {
    const res = await page.goto(`/${GPCI.has(k) ? "gpci" : "gci"}/${k}`);
    expect(res?.status(), k).toBe(200);
    await expect(page.locator("h1"), k).toBeVisible();
    if (await page.getByText("Data belum tersedia", { exact: true }).count()) gap++;
  }
  expect(gap).toBe(9);
  expect(err).toEqual([]);
  const res = await page.goto("/gci/ZZZ");
  expect(res?.status()).toBe(404);
});

test("IN-E04 prefiks silang diterima: /gpci/CE1 dan /gci/CI-FV", async ({ page }) => {
  for (const url of ["/gpci/CE1", "/gci/CI-FV"]) {
    const res = await page.goto(url);
    expect(res?.status()).toBe(200);
  }
  await expect(page.getByText("Catatan kriteria")).toBeVisible();
});

test("IN-E05 peta indikator arketipe A (CI-MU) dirender", async ({ page }) => {
  await buka(page, "/gpci/CI-MU");
  await expect(page.getByRole("heading", { name: "Sebaran titik museum" })).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".leaflet-overlay-pane path, .leaflet-marker-icon, .leaflet-overlay-pane canvas").first()).toBeAttached();
});

test("IN-E06 seni pertunjukan: pilih tahun lalu pilih venue di peta", async ({ page }) => {
  await buka(page, "/gci/pariwisata/seni-pertunjukan");
  await page.getByRole("combobox").first().selectOption("2025");
  await expect(page).toHaveURL(/\?tahun=2025$/);
  await expect(page.getByText("semua event pariwisata & budaya · 2025")).toBeVisible();
  // Di layar sempit peta venue v2 setinggi 0 px (flex-1 di flex-col tanpa tinggi tetap) — quirk
  // produksi yang ditiru (K-10); memilih venue hanya bisa di desktop.
  if (test.info().project.name === "mobile") return;
  const panel = page.locator("aside");
  await expect(panel.locator("iframe")).toBeAttached();
  const awal = await panel.locator(".text-\\[17px\\]").innerText();
  // Marker venue digambar di canvas: cari piksel oranye (#ed6b23) lalu klik di sana.
  const kanvas = page.locator(".leaflet-container canvas").first();
  await expect.poll(() => kanvas.evaluate((c: HTMLCanvasElement) => c.height)).toBeGreaterThan(0);
  const kandidat = await kanvas.evaluate((c: HTMLCanvasElement) => {
    const { data, width, height } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    const skala = c.width / c.getBoundingClientRect().width;
    const oranye = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      return Math.abs(data[i]! - 237) < 8 && Math.abs(data[i + 1]! - 107) < 8 && Math.abs(data[i + 2]! - 35) < 8;
    };
    const hasil: { x: number; y: number }[] = [];
    for (let y = 2; y < height - 2 && hasil.length < 8; y += 3)
      for (let x = 2; x < width - 2 && hasil.length < 8; x += 3)
        if (oranye(x, y) && oranye(x - 2, y) && oranye(x + 2, y) && oranye(x, y - 2) && oranye(x, y + 2)) hasil.push({ x: x / skala, y: y / skala });
    return hasil;
  });
  expect(kandidat.length).toBeGreaterThan(0);
  for (const titik of kandidat) {
    await kanvas.click({ position: titik });
    if ((await panel.locator(".text-\\[17px\\]").innerText()) !== awal) break;
  }
  await expect(panel.locator(".text-\\[17px\\]")).not.toHaveText(awal);
});
