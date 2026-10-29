// Paritas gmti/spasial (docs/skenario/gmti.md GM-P*): portal vs dispar.rantai.dev.
import { test, type Page } from "@playwright/test";
import { bandingkanHalaman } from "./bantu";

test("GM-P01 /gmti", async ({ browser, page }, info) => {
  await bandingkanHalaman(browser, page, "/gmti", info, { tunggu: "#directory li" });
});

// Tinggi peta v2 dihitung dengan dock AI produksi masih ada (ruang sisa di bawah main). Dock dibuang
// sebelum tangkapan, jadi tinggi dihitung ulang (event resize, sama dengan pendengar v2).
const hitungUlangTinggi = async (page: Page) => {
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.waitForTimeout(300);
};

test("GM-P02 /spatial (panel; tile, pin, dan choropleth di-mask)", async ({ browser, page }, info) => {
  await bandingkanHalaman(browser, page, "/spatial", info, {
    tunggu: "text=/4\\.920 titik/",
    mask: [".leaflet-container"],
    layar: "viewport",
    siapkan: hitungUlangTinggi,
  });
});

// /scraped-hotels: produksi membaca mart kosong, portal membaca Bronze (P5). Respons produksi
// (rows, stats, last_checkin) disuntikkan ke portal, jadi yang dibandingkan adalah render atas data
// yang sama (keadaan produksi saat ini).
test("GM-P03 /scraped-hotels", async ({ browser, page }, info) => {
  await bandingkanHalaman(browser, page, "/scraped-hotels", info, {
    tunggu: "text=/Hotels \\(\\d+\\)/",
    samakanBaris: {
      produksi: "/api/hotels/scraped",
      portal: "/_api/hotel-scraped",
      ambil: (j) => [j],
      pasang: (j, [p]: any[]) => ({ ...j, data: { ...j.data, rows: p.rows ?? [], stats: p.stats ?? null, last_checkin: p.last_checkin ?? null } }),
    },
  });
});
