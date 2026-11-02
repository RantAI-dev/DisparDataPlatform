// E2E fitur dataset + beranda + docs (docs/skenario/dataset.md DS-E*, BR-E01, DC-E01). Nuxt hasil
// build melawan Laravel + fixture-server (rekaman fixtures/data-api); tidak ada rute yang dipalsukan.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const S1 = "data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan";

/** Buka halaman lalu tunggu hidrasi (klik sebelum hidrasi tidak berefek). */
async function buka(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** Penghitung baris di toolbar katalog (bukan kolom Ukuran yang juga berbunyi "N baris"). */
const penghitung = (page: Page) => page.locator("span.text-\\[13px\\].tabular-nums");

function pantauError(page: Page) {
  const err: string[] = [];
  page.on("console", (m) => m.type() === "error" && err.push(m.text()));
  page.on("pageerror", (e) => err.push(String(e)));
  return err;
}

test("DS-E01 /katalog: cari mengurangi baris; tak ada yang cocok → pesan kosong", async ({ page }) => {
  await buka(page, "/katalog");
  await expect(penghitung(page)).toHaveText("228 baris");
  await page.getByLabel("Cari dataset").fill("wisatawan mancanegara");
  await expect(penghitung(page)).not.toHaveText("228 baris");
  await page.getByLabel("Cari dataset").fill("zzz-tidak-ada");
  await expect(page.getByText("Tidak ada dataset yang cocok.")).toBeVisible();
});

test("DS-E02 /katalog: filter tier dan lapisan", async ({ page }) => {
  await buka(page, "/katalog");
  await page.getByRole("button", { name: "Sekunder", exact: true }).click();
  await expect(penghitung(page)).toHaveText("45 baris");
  await page.getByRole("button", { name: /^Gold/ }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.locator("tbody").getByText("◆ Gold")).toHaveCount(2);
});

test("DS-E03 /sdi → Lihat data → detail S1 dengan hero, meta, dan tabel", async ({ page }) => {
  const err = pantauError(page);
  await buka(page, "/sdi");
  await expect(penghitung(page)).toHaveText("183 baris");
  await page.locator(`a[href="/sdi/${S1}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/sdi/${S1}$`));
  await expect(page.getByRole("heading", { name: "Data Jumlah Wisatawan Mancanegara Berdasarkan Kebangsaan" })).toBeVisible();
  await expect(page.getByText("Jan 2024 – Jul 2026")).toBeVisible();
  await expect(page.getByText("50 / 664 baris")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(50);
  expect(err).toEqual([]);
});

test.describe("detail S1", () => {
  test.beforeEach(async ({ page }) => {
    await buka(page, `/sdi/${S1}`);
    await expect(page.getByText("50 / 664 baris")).toBeVisible();
  });

  test("DS-E04 tambah lalu hapus chip filter", async ({ page }) => {
    await page.getByRole("button", { name: /^Filter/ }).click();
    await page.locator("label").filter({ hasText: /^JEPANG/ }).getByRole("checkbox").check();
    await expect(page.getByText("Kebangsaan: JEPANG")).toBeVisible();
    await expect(page.getByText("31 / 31 baris (terfilter dari 664)")).toBeVisible();
    await expect(page.getByRole("link", { name: /CSV \(terfilter\)/ })).toBeVisible();
    await page.getByRole("button", { name: "Hapus filter Kebangsaan" }).click();
    await expect(page.getByText("50 / 664 baris")).toBeVisible();
  });

  test("DS-E05 sort kolom: ▲ → ▼ → ↕", async ({ page }) => {
    const tombol = page.getByRole("button", { name: "Urutkan menurut Jumlah Kunjungan" });
    const th = page.locator("th", { has: tombol });
    await tombol.click();
    await expect(th).toHaveAttribute("aria-sort", "ascending");
    await expect(page.locator("tbody tr").first()).toContainText("BAHRAIN");
    await tombol.click();
    await expect(th).toHaveAttribute("aria-sort", "descending");
    await expect(page.locator("tbody tr").first()).toContainText("74.529");
    await tombol.click();
    await expect(th).toHaveAttribute("aria-sort", "none");
  });

  test("DS-E06 gulir memuat 50 baris berikutnya", async ({ page }) => {
    await page.getByText("Gulir untuk memuat lebih banyak").scrollIntoViewIfNeeded();
    await expect(page.getByText("100 / 664 baris")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(100);
  });

  test("DS-E07 unduh CSV terfilter: nama -terfilter.csv dan BOM", async ({ page }) => {
    await page.getByRole("button", { name: /^Filter/ }).click();
    await page.locator("label").filter({ hasText: /^JEPANG/ }).getByRole("checkbox").check();
    await expect(page.getByText("Kebangsaan: JEPANG")).toBeVisible();
    const [unduh] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /CSV \(terfilter\)/ }).click()]);
    expect(unduh.suggestedFilename()).toBe(`${S1}-terfilter.csv`);
    const isi = readFileSync((await unduh.path())!);
    expect([...isi.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(isi.toString("utf8").split("\r\n").filter(Boolean)).toHaveLength(32);
  });

  test("DS-E08 chart builder: + Tambah grafik → canvas, bertahan setelah reload", async ({ page }) => {
    await expect(page.getByText("Belum ada grafik.")).toBeVisible();
    await page.getByRole("button", { name: "+ Tambah grafik" }).click();
    await expect(page.getByText("Total (sum) Jumlah Kunjungan per Kebangsaan")).toBeVisible();
    await expect(page.locator(".grid canvas").first()).toBeVisible();
    await page.reload();
    await expect(page.getByText("Total (sum) Jumlah Kunjungan per Kebangsaan")).toBeVisible();
    await page.getByRole("button", { name: "Hapus grafik" }).click();
    await expect(page.getByText("Belum ada grafik.")).toBeVisible();
  });
});

test("DS-E09 /sdi/tidak-ada → pesan 404 v2", async ({ page }) => {
  await page.goto("/sdi/tidak-ada");
  await expect(page.getByText("Dataset belum tersedia di lakehouse. Coba buka di portal SDI ↗.")).toBeVisible();
});

test("BR-E01 beranda: angka dari API dan tautan kartu", async ({ page }) => {
  await buka(page, "/");
  await expect(page.getByText("Dataset primer SDI")).toBeVisible();
  await expect(page.getByText("183 + 45 dataset")).toBeVisible();
  await expect(page.getByText("28", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Katalog Data.*dataset/ }).click();
  await expect(page).toHaveURL(/\/katalog$/);
});

test("DC-E01 /docs: endpoint dari OpenAPI, tanpa sistem/*", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("heading", { name: "Baris data" })).toBeVisible();
  await expect(page.getByText("/api/v1/dataset/{slug}/ekspor", { exact: true })).toBeVisible();
  await expect(page.getByText("/api/v1/sistem/kesehatan")).toHaveCount(0);
});
