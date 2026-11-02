// E2E fitur dashboard (docs/skenario/dashboard.md DB-E*), melawan Laravel + fixture-server.
import { expect, test, type Page } from "@playwright/test";

async function buka(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

test("DB-E01 /dashboard: KPI ringkasan dan kartu menu", async ({ page }) => {
  await buka(page, "/dashboard");
  await expect(page.getByText("Wisman 2025")).toBeVisible();
  await expect(page.getByText("Rp 411 T")).toBeVisible();
  await page.getByRole("link", { name: /PDRB Ekonomi Kreatif →/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/pdrb-ekraf$/);
  await expect(page.getByText("Rp 410,6 T")).toBeVisible();
});

test("DB-E02 wisman: tahun, bulan, pintu masuk bulanan vs semester belum dirilis", async ({ page }) => {
  await buka(page, "/dashboard/wisman");
  await expect(page.getByText("Semester ini belum dirilis.")).toBeVisible();
  await page.getByRole("button", { name: "2024", exact: true }).click();
  await expect(page.getByText("Persentase Wisman berdasarkan Kebangsaan · 2024", { exact: true })).toBeVisible();
  await expect(page.getByText("Persentase Wisman berdasarkan Pintu Masuk · 2024", { exact: true })).toBeVisible();
  await page.locator("select").first().selectOption("2024-05");
  await expect(page.getByText("Wisman Mei 2024")).toBeVisible();
  await expect(page.getByText("data bulanan BPS DKI Jakarta")).toBeVisible();
});

test("DB-E03 wisnus: filter kota tujuan", async ({ page }) => {
  await buka(page, "/dashboard/wisnus");
  await expect(page.getByText("Capaian tahunan · Semua kota")).toBeVisible();
  await page.locator("select").first().selectOption("Jakarta Pusat");
  await expect(page.getByText("Capaian tahunan · Jakarta Pusat")).toBeVisible();
  await expect(page.getByText("Tren bulanan · Jakarta Pusat")).toBeVisible();
});

test("DB-E04 tenaga kerja: pilih tahun subsektor", async ({ page }) => {
  await buka(page, "/dashboard/tenaga-kerja");
  await page.getByRole("button", { name: "2022", exact: true }).click();
  await expect(page.getByText("Tenaga Kerja Ekonomi Kreatif per Subsektor di Tingkat Nasional - Tahun 2022")).toBeVisible();
});

test("DB-E05 PDRB: sebaran dan pertumbuhan dengan periode berbeda", async ({ page }) => {
  await buka(page, "/dashboard/pdrb-ekraf");
  await page.getByRole("button", { name: "2022", exact: true }).first().click();
  await expect(page.getByText("Distribusi per subsektor · 2022")).toBeVisible();
  await page.getByRole("button", { name: "2025 (Sem I)" }).nth(1).click();
  await expect(page.getByText("Pertumbuhan per subsektor · 2025 (Sem I)")).toBeVisible();
  await expect(page.getByText("Distribusi per subsektor · 2022")).toBeVisible();
});

test("DB-E06 perbesar grafik: modal terbuka, Esc menutup", async ({ page }) => {
  await buka(page, "/dashboard/pdrb-ekraf");
  await page.getByRole("button", { name: "Perbesar grafik" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("canvas")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
