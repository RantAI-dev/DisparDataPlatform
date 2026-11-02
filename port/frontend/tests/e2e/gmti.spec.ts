// E2E gmti, spasial, hotel-scraped (docs/skenario/gmti.md GM-E*), melawan Laravel + fixture-server.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";

async function buka(page: Page, url: string) {
  await page.route(/arcgisonline|openstreetmap|google\.com\/maps/, (r) => r.abort());
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

const hitung = (page: Page) => page.locator("#filters input + span");

test("GM-E01 /gmti: paging server, pilar, wilayah, cari", async ({ page }) => {
  await buka(page, "/gmti");
  await expect(hitung(page)).toHaveText("8.666");
  await expect(page.locator("#directory li")).toHaveCount(200);
  await page.getByRole("button", { name: /^Tampilkan 200 lagi/ }).click();
  await expect(page.locator("#directory li")).toHaveCount(400);
  await page.getByRole("button", { name: "Makan & minum", exact: true }).click();
  await expect(hitung(page)).toHaveText("174");
  await expect(page.getByText("Restoran, RPH, dan produk kuliner bersertifikat halal BPJPH/LPPOM MUI.")).toBeVisible();
  await page.locator("#filters select").first().selectOption("Jakarta Selatan");
  await expect(hitung(page)).not.toHaveText("174");
  await page.getByRole("button", { name: "Semua", exact: true }).click();
  await page.getByPlaceholder("Cari nama, alamat, kecamatan, atau nomor sertifikat…").fill("istiqlal");
  await expect(page.locator("#directory li").first()).toContainText(/istiqlal/i);
  await page.getByRole("button", { name: "Tabel" }).click();
  await expect(page.locator("#directory tbody tr").first()).toBeVisible();
});

test("GM-E02 /gmti: ekspor pilar mengambil semua hasil filter", async ({ page }) => {
  await buka(page, "/gmti");
  await page.getByRole("button", { name: "Program dan Event", exact: true }).click();
  await expect(hitung(page)).toHaveText("43");
  await page.getByRole("button", { name: "Unduh" }).click();
  const [berkas] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /^XLSX/ }).click()]);
  expect(berkas.suggestedFilename()).toMatch(/^jakarta-atlas-gmti-program-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const wb = XLSX.read(readFileSync((await berkas.path())!));
  const baris = XLSX.utils.sheet_to_json<string[]>(wb.Sheets.GMTI!, { header: 1 });
  expect(baris[0]).toEqual(["No", "Nama", "Pilar", "Jenis/Tipologi", "Sumber Dataset", "Alamat", "Kota Administrasi", "Kecamatan", "Lintang", "Bujur", "No Sertifikat Halal", "Catatan"]);
  expect(baris).toHaveLength(44);
});

async function stripFilter(page: Page) {
  const strip = page.locator("details").first();
  if (!(await strip.evaluate((d: HTMLDetailsElement) => d.open))) await strip.locator("summary").click();
  return strip;
}

test("GM-E03 /spatial: choropleth, chip, cari, wilayah, reset, popup", async ({ page }) => {
  await buka(page, "/spatial");
  const strip = await stripFilter(page);
  const jumlah = strip.getByRole("status");
  await expect(jumlah).toContainText(/^4\.920 \/ 4\.920 titik$/);
  const choro = strip.getByRole("button", { name: "Kepadatan kecamatan" });
  const awal = await choro.getAttribute("aria-pressed");
  await choro.click();
  await expect(choro).not.toHaveAttribute("aria-pressed", awal!);
  await strip.getByRole("button", { name: "Hotel", exact: true }).click();
  await expect(jumlah).not.toContainText(/^4\.920 \//);
  await strip.getByRole("button", { name: "Reset filter" }).click();
  await expect(jumlah).toContainText(/^4\.920 \//);
  await strip.getByRole("combobox", { name: "Wilayah" }).selectOption("Jakarta Selatan");
  await expect(jumlah).not.toContainText(/^4\.920 \//);
  await strip.getByRole("button", { name: "Reset filter" }).click();
  await strip.getByRole("textbox", { name: "Cari tempat" }).fill("Canary Coffee Shop");
  await expect(jumlah).toContainText(/^1 \//);
  const pin = page.locator(".leaflet-marker-icon").first();
  await expect(pin).toBeVisible();
  // Klik koordinat bisa mengenai poligon kecamatan (popup kepadatan) saat peta masih beranimasi;
  // event dikirim langsung ke elemen pin, diulang sampai popup titik terbuka.
  await expect(async () => {
    await pin.dispatchEvent("click");
    await expect(page.locator(".leaflet-popup")).toContainText("Canary Coffee Shop", { timeout: 2000 });
  }).toPass({ timeout: 15_000 });
});

test("GM-E04 /spatial: API gagal → peringatan, Coba lagi memuat ulang", async ({ page }) => {
  // Satu-satunya rute browser yang dipalsukan: kegagalan tidak bisa direkam fixture-server.
  let gagal = true;
  await page.route("**/_api/spasial", (r) => (gagal ? ((gagal = false), r.fulfill({ status: 503, body: "{}" })) : r.continue()));
  await buka(page, "/spatial");
  await expect(page.getByRole("alert").filter({ hasText: "Titik lakehouse belum dapat dimuat." })).toBeVisible();
  await page.getByRole("button", { name: "Coba lagi" }).first().click();
  await expect(page.getByRole("alert").filter({ hasText: "Titik lakehouse" })).toHaveCount(0);
  await expect((await stripFilter(page)).getByRole("status")).toContainText("4.920");
});

test("GM-E05 /scraped-hotels: data Bronze tampil, baris dibuka memperlihatkan tipe kamar", async ({ page }) => {
  // Tanpa networkidle: halaman memuat banyak berkas chart; cukup tunggu daftar hotel terisi.
  await page.goto("/scraped-hotels");
  await expect(page.getByRole("heading", { name: /Hotels \([1-9]\d*\)/ })).toBeVisible({ timeout: 20_000 });
  const n = Number((await page.getByRole("heading", { name: /Hotels \(\d+\)/ }).innerText()).match(/\d+/)![0]);
  expect(n).toBeGreaterThan(0);
  const kartu = page.locator("div.rounded-xl.border").filter({ has: page.locator("button") });
  for (let i = 0; i < n; i++) {
    const k = kartu.nth(i);
    await k.locator("button").first().click({ position: { x: 8, y: 8 } });
    if (await k.getByText(/\d+ room types/).count()) {
      await expect(k.locator("table th").first()).toHaveText("Room type");
      return;
    }
    await k.locator("button").first().click({ position: { x: 8, y: 8 } });
  }
  throw new Error("tidak ada hotel dengan tipe kamar");
});
