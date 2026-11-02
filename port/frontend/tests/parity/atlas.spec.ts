// Paritas fitur atlas (docs/skenario/atlas.md AT-P*): portal vs dispar.rantai.dev.
import { test } from "@playwright/test";
import { bandingkanHalaman, type OpsiParitas } from "./bantu";

// Tile peta dan iframe Google Maps di-mask bantu.ts (SPEC §7.1); marker dan popup ikut dibandingkan
// (plan 17 menyempitkan mask `.leaflet-container`).

const KICKER_GOLF = "[data-section='golf'] section:first-of-type .atlas-mono";

const HALAMAN: [string, string, OpsiParitas][] = [
  ["AT-P01", "/gci/pariwisata/restoran-gci", { tunggu: "text=Restoran" }],
  [
    "AT-P02",
    "/gci/pariwisata/direktori-restoran",
    {
      tunggu: "#directory li",
      // [P2] tombol "Verifikasi sumber" (bilah atas) dan kolom tautan /api/restaurants + /api/refresh
      // di footer tidak di-port. 604 kartu: cukup layar pertama.
      mask: ["main > div:first-child", "#sources > div:first-child > div:nth-child(2)"],
      layar: "viewport",
      pengecualian: ["P2"],
    },
  ],
  // [P1] kicker golf: produksi menampilkan kunci literal `home.vol2_kicker` (angka "2"-nya ikut diabaikan).
  [
    "AT-P03",
    "/gpci/lapangan-golf",
    { tunggu: ".leaflet-marker-icon", mask: [KICKER_GOLF], abaikanAngka: [KICKER_GOLF], pengecualian: ["P1"] },
  ],
  ["AT-P04", "/gpci/toko-suvenir", { tunggu: "#directory li" }],
  ["AT-P05", "/gpci/hotel", { tunggu: "canvas" }],
  ["AT-P06", "/gci/pariwisata/pertunjukan-budaya", { tunggu: "h1" }],
];

for (const [id, path, opsi] of HALAMAN) {
  test(`${id} ${path}`, async ({ browser, page }, info) => {
    await bandingkanHalaman(browser, page, path, info, opsi);
  });
}
