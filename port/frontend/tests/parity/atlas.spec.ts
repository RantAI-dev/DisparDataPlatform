// Paritas fitur atlas (docs/skenario/atlas.md AT-P*): portal vs dispar.rantai.dev.
import { test } from "@playwright/test";
import { bandingkanHalaman, type OpsiParitas } from "./bantu";

// Tile peta dan pratinjau iframe Google Maps bukan bagian paritas UI (SPEC §7).
const PETA = [".leaflet-container", "iframe"];

const KICKER_GOLF = "[data-section='golf'] section:first-of-type .atlas-mono";

const HALAMAN: [string, string, OpsiParitas][] = [
  ["AT-P01", "/gci/pariwisata/restoran-gci", { tunggu: "text=Restoran", mask: PETA }],
  [
    "AT-P02",
    "/gci/pariwisata/direktori-restoran",
    {
      tunggu: "#directory li",
      // [P2] tombol "Verifikasi sumber" (bilah atas) dan kolom tautan /api/restaurants + /api/refresh
      // di footer tidak di-port. 604 kartu: cukup layar pertama.
      mask: [...PETA, "main > div:first-child", "#sources > div:first-child > div:nth-child(2)"],
      layar: "viewport",
    },
  ],
  // [P1] kicker golf: produksi menampilkan kunci literal `home.vol2_kicker` (angka "2"-nya ikut diabaikan).
  [
    "AT-P03",
    "/gpci/lapangan-golf",
    { tunggu: ".leaflet-marker-icon", mask: [...PETA, KICKER_GOLF], abaikanAngka: [KICKER_GOLF] },
  ],
  ["AT-P04", "/gpci/toko-suvenir", { tunggu: "#directory li", mask: PETA }],
  ["AT-P05", "/gpci/hotel", { tunggu: "canvas", mask: PETA }],
  ["AT-P06", "/gci/pariwisata/pertunjukan-budaya", { tunggu: "h1", mask: PETA }],
];

for (const [id, path, opsi] of HALAMAN) {
  test(`${id} ${path}`, async ({ browser, page }, info) => {
    await bandingkanHalaman(browser, page, path, info, opsi);
  });
}
