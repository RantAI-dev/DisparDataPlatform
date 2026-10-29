// Paritas fitur indikator (docs/skenario/indikator.md IN-P*): portal vs dispar.rantai.dev.
import { test } from "@playwright/test";
import { bandingkanHalaman } from "./bantu";

const KODE = {
  gci: ["CE1", "CE2", "CE3", "CE4", "BA-MICE", "CE5", "CE6", "HC-VISA"],
  gpci: ["CI-IC", "CI-CE", "CI-CX", "CI-AM", "CI-TA", "CI-WH", "CI-NL", "CI-TH", "CI-MU", "CI-ST", "CI-HR", "CI-LH", "CI-SH", "CI-DI", "CI-FR", "CI-FV", "AC-DF", "AC-AP", "AC-AR", "AC-TT"],
};
// Peta titik (tile dan posisi marker hasil cluster) bukan bagian paritas UI (SPEC §7).
const PETA = [".leaflet-container"];

// "Nilai terbaru" (defect D, ditiru K-12) diambil dari baris pertama dataset tanpa ORDER BY, jadi
// nilainya bergantung urutan baris ClickHouse (produksi membekukannya lewat ISR 24 jam). Angka
// kolom itu tidak dibandingkan; tata letaknya tetap ikut perbandingan visual.
const NILAI_TERBARU = ["tbody td:last-child"];

test("IN-P01 /gci", async ({ browser, page }, info) => {
  await bandingkanHalaman(browser, page, "/gci", info, { tunggu: "text=Kesiapan indikator", abaikanAngka: NILAI_TERBARU });
});

test("IN-P02 /gpci", async ({ browser, page }, info) => {
  // Di 390 px nilai terbaru yang berbeda (lihat atas) membungkus baris berbeda sehingga tinggi halaman
  // bergeser; di mobile cukup layar pertama yang dibandingkan.
  const layar = info.project.name === "mobile" ? "viewport" : "penuh";
  await bandingkanHalaman(browser, page, "/gpci", info, { tunggu: "text=Kesiapan indikator", abaikanAngka: NILAI_TERBARU, layar });
});

for (const [fw, kode] of Object.entries(KODE)) {
  for (const k of kode) {
    test(`IN-P03 /${fw}/${k}`, async ({ browser, page }, info) => {
      await bandingkanHalaman(browser, page, `/${fw}/${k}`, info, { mask: PETA });
    });
  }
}

// Peta venue (tile, marker canvas) dan iframe Google Maps di-mask (SPEC §7); panelnya tetap dibandingkan.
const PETA_VENUE = [".leaflet-container", "iframe"];

for (const [id, path, opsi] of [
  ["IN-P04", "/gci/pariwisata/wisatawan-internasional", {}],
  ["IN-P05", "/gci/pariwisata/kuliner-michelin", {}],
  ["IN-P06", "/gci/pariwisata/seni-pertunjukan", { mask: PETA_VENUE }],
  ["IN-P07", "/gci/pariwisata/seni-pertunjukan?tahun=2025", { mask: PETA_VENUE }],
] as const) {
  test(`${id} ${path}`, async ({ browser, page }, info) => {
    await bandingkanHalaman(browser, page, path, info, opsi);
  });
}
