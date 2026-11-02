// Paritas interaksi (SPEC §7 butir 3): langkah yang sama dari skenario e2e (docs/skenario/*.md, ID
// di komentar) dijalankan di produksi dan portal, lalu hasilnya dibandingkan seperti halaman biasa
// (piksel ≤ 2% + himpunan angka). Pilihan nilai memakai data sungguhan (bukan fixture e2e).
import { test, type Page } from "@playwright/test";
import { bandingkanHalaman, type OpsiParitas } from "./bantu";

const PETA = [".leaflet-container", "iframe"];

const klik = (nama: string, n = 0) => async (page: Page) => {
  await page.getByRole("button", { name: nama, exact: true }).nth(n).click();
};

const SKENARIO: [string, string, string, OpsiParitas][] = [
  // DS-E01
  ["IX-P01", "/katalog", "cari dataset", {
    tunggu: "tbody tr:nth-child(100)",
    siapkan: (p) => p.getByLabel("Cari dataset").fill("wisatawan mancanegara"),
  }],
  // DB-E02
  ["IX-P02", "/dashboard/wisman", "pilih tahun 2024 lalu bulan Mei", {
    tunggu: "canvas",
    siapkan: async (p) => {
      await klik("2024")(p);
      await p.locator("select").first().selectOption("2024-05");
    },
  }],
  // DB-E03
  ["IX-P03", "/dashboard/wisnus", "filter kota tujuan", {
    tunggu: "canvas",
    siapkan: (p) => p.locator("select").first().selectOption("Jakarta Pusat").then(() => undefined),
  }],
  // DB-E04
  ["IX-P04", "/dashboard/tenaga-kerja", "pilih tahun subsektor 2022", { tunggu: "canvas", siapkan: klik("2022") }],
  // DB-E06: modal "Perbesar grafik" (layar pertama: modal menutupi halaman).
  ["IX-P05", "/dashboard/pdrb-ekraf", "perbesar grafik", {
    tunggu: "canvas",
    layar: "viewport",
    siapkan: klik("Perbesar grafik"),
  }],
  // AT-E01
  ["IX-P06", "/gci/pariwisata/restoran-gci", "filter tier Cafe", { tunggu: "text=Restoran", mask: PETA, siapkan: klik("Cafe") }],
  // AT-E03: toggle bahasa EN; P2 sama dengan AT-P02.
  ["IX-P07", "/gci/pariwisata/direktori-restoran", "bahasa EN", {
    tunggu: "#directory li",
    mask: [...PETA, "main > div:first-child", "#sources > div:first-child > div:nth-child(2)"],
    layar: "viewport",
    pengecualian: ["P2"],
    siapkan: (p) => p.getByRole("button", { name: /Switch language to EN/ }).click(),
  }],
  // GM-E01
  ["IX-P08", "/gmti", "pilar Makan & minum + wilayah Jakarta Selatan", {
    tunggu: "#directory li",
    siapkan: async (p) => {
      await klik("Makan & minum")(p);
      await p.locator("#filters select").first().selectOption("Jakarta Selatan");
    },
  }],
  // IN-E06: pilih tahun lewat combobox (bukan URL).
  ["IX-P09", "/gci/pariwisata/seni-pertunjukan", "pilih tahun 2024", {
    mask: PETA,
    siapkan: async (p) => {
      await p.getByRole("combobox").first().selectOption("2024");
      await p.getByText("semua event pariwisata & budaya · 2024").waitFor({ timeout: 30_000 });
    },
  }],
];

for (const [id, path, aksi, opsi] of SKENARIO) {
  test(`${id} ${path} — ${aksi}`, async ({ browser, page }, info) => {
    await bandingkanHalaman(browser, page, path, info, opsi);
  });
}
