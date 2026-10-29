// E2E fitur atlas (docs/skenario/atlas.md AT-E*), melawan Laravel + fixture-server.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import * as XLSX from "xlsx";

async function buka(page: Page, url: string) {
  await page.route(/arcgisonline|openstreetmap|google\.com\/maps/, (r) => r.abort());
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("status")).toHaveCount(0);
}

async function unduh(page: Page, tombol: string | RegExp, format: "CSV" | "XLS" | "XLSX") {
  await page.getByRole("button", { name: tombol }).click();
  const [berkas] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: new RegExp(`^${format}(?!X)`) }).click()]);
  return { nama: berkas.suggestedFilename(), isi: readFileSync((await berkas.path())!) };
}

const lembar = (isi: Buffer) => {
  const wb = XLSX.read(isi);
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1 });
};

test("AT-E01 restoran GCI: cari + filter tier mengurangi baris; paging Muat lagi", async ({ page }) => {
  await buka(page, "/gci/pariwisata/restoran-gci");
  const hitung = page.getByText(/^\d+\/\d+ entri$/);
  const [, total] = (await hitung.innerText()).match(/\/(\d+)/)!;
  expect(Number(total)).toBeGreaterThan(200);
  await expect(page.locator("tbody tr")).toHaveCount(200);
  await page.getByRole("button", { name: "Cafe", exact: true }).click();
  await expect(hitung).not.toHaveText(`${total}/${total} entri`);
  await page.getByRole("button", { name: "Semua", exact: true }).click();
  // Di layar sempit toolbar sticky (top 56 px) tertutup nav setelah halaman digulir — quirk v2; filter dulu, baru paging.
  await page.getByRole("button", { name: /^Muat \d+ lagi$/ }).click();
  expect(await page.locator("tbody tr").count()).toBeGreaterThan(200);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByPlaceholder("Cari nama / kuliner / area…").fill("zzzz-tidak-ada");
  await expect(page.getByText("Tidak ada entri yang cocok dengan filter.")).toBeVisible();
});

test("AT-E02 restoran GCI: ekspor CSV/XLSX — nama, header 13 kolom, jumlah baris = hanya ber-rating", async ({ page }) => {
  await buka(page, "/gci/pariwisata/restoran-gci");
  const tombol = page.getByRole("button", { name: /^Ekspor Excel \(\d+\)$/ });
  const n = Number((await tombol.innerText()).match(/\((\d+)\)/)![1]);
  const csv = await unduh(page, /^Ekspor Excel/, "CSV");
  expect(csv.nama).toMatch(/^data-restoran-GCI-\d{4}-\d{2}-\d{2}\.csv$/);
  const baris = csv.isi.toString("utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
  expect(baris[0]!.split(",")).toHaveLength(13);
  const xlsx = lembar((await unduh(page, /^Ekspor Excel/, "XLSX")).isi);
  expect(xlsx[0]).toEqual(["No.", "Nama", "Jenis Cuisine", "Alamat", "Rating", "Jumlah Ulasan", "Sumber Rating", "Area", "Tingkat Harga", "Tier", "Hotel", "Catatan", "Google Maps"]);
  expect(xlsx).toHaveLength(n + 1);
});

test("AT-E03 direktori restoran: bahasa EN bertahan setelah reload; mode daftar tersimpan", async ({ page }) => {
  test.setTimeout(90_000);
  await buka(page, "/gci/pariwisata/direktori-restoran");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kuliner Internasional.");
  await expect(page.getByRole("button", { name: /Verifikasi|Verify/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Switch language to EN/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("International Cuisine.");
  // Label "List" disembunyikan di layar sempit (hidden sm:inline); radio kedua = daftar.
  await page.getByRole("radio").nth(1).click();
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("International Cuisine.");
  await expect(page.getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "true");
  await page.getByPlaceholder("Search Jakarta restaurants…").fill("Toscana");
  await expect(page.locator("ol > li")).toHaveCount(1);
  const xls = await unduh(page, "Export", "XLS");
  expect(xls.nama).toMatch(/^jakarta-atlas-restoran-\d{4}-\d{2}-\d{2}\.xls$/);
  expect(lembar(xls.isi)).toHaveLength(2);
});

test("AT-E04 golf: filter jenis, klik kartu memilih, peta berpin, kicker [P1]", async ({ page }) => {
  await buka(page, "/gpci/lapangan-golf");
  await expect(page.getByText("LAPANGAN GOLF", { exact: true })).toBeVisible();
  await expect(page.getByText("home.vol2_kicker")).toHaveCount(0);
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(14);
  await page.getByRole("button", { name: "Driving Range", exact: true }).click();
  await expect(page.locator(".leaflet-marker-icon")).toHaveCount(4);
  await page.locator("aside li").first().click();
  await expect(page.getByText("TERPILIH", { exact: true })).toBeVisible();
  const csv = await unduh(page, /CSV|Excel|Unduh/, "CSV");
  expect(csv.nama).toMatch(/^jakarta-atlas-golf-/);
  expect(csv.isi.toString("utf8").trim().split(/\r?\n/)).toHaveLength(5);
});

test("AT-E05 suvenir: relevansi bawaan Toko suvenir, mode tabel, ekspor", async ({ page }) => {
  await buka(page, "/gpci/toko-suvenir");
  await expect(page.getByText(/^35\/67$/)).toBeVisible();
  await page.getByRole("button", { name: "Semua", exact: true }).click();
  await expect(page.getByText(/^67\/67$/)).toBeVisible();
  await page.getByRole("button", { name: "Tabel" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(67);
  const xlsx = await unduh(page, "Unduh", "XLSX");
  expect(xlsx.nama).toMatch(/^jakarta-atlas-suvenir-.*\.xlsx$/);
  expect(lembar(xlsx.isi)).toHaveLength(68);
});

test("AT-E06 hotel dan pertunjukan merender data", async ({ page }) => {
  await buka(page, "/gpci/hotel");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hotel");
  await buka(page, "/gci/pariwisata/pertunjukan-budaya");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pertunjukan");
});
