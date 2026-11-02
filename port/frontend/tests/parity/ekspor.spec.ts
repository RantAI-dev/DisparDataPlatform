// Paritas ekspor (SPEC §7.3): isi berkas unduhan produksi vs portal — pola nama, BOM, header kolom,
// jumlah baris, dan isi tiap sel (bantu.ts `bandingkanEkspor`). Isi berkas tidak bergantung lebar
// layar, jadi hanya dijalankan di project desktop.
import { test, type Page } from "@playwright/test";
import { bandingkanEkspor, type OpsiParitas } from "./bantu";
import { PILLAR_LABEL } from "../../layers/shared/utils/palettes";

const S1 = "data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan";

/** Klik tombol ExportButton lalu pilih format di menunya. */
const menu = (tombol: string | RegExp, format: "CSV" | "XLS" | "XLSX") => async (p: Page) => {
  await p.getByRole("button", { name: tombol }).first().click();
  const [d] = await Promise.all([p.waitForEvent("download"), p.getByRole("menuitem", { name: new RegExp(`^${format}(?!X)`) }).click()]);
  return d;
};

const KASUS: [string, string, string, ReturnType<typeof menu>, OpsiParitas][] = [
  // AT-E02
  ["EK-P01", "/gci/pariwisata/restoran-gci", "CSV", menu(/^Ekspor Excel/, "CSV"), { tunggu: "text=Restoran" }],
  ["EK-P02", "/gci/pariwisata/restoran-gci", "XLSX", menu(/^Ekspor Excel/, "XLSX"), { tunggu: "text=Restoran" }],
  // AT-E03
  ["EK-P03", "/gci/pariwisata/direktori-restoran", "XLS", menu("Ekspor Excel", "XLS"), { tunggu: "#directory li" }],
  // AT-E04
  ["EK-P04", "/gpci/lapangan-golf", "CSV", menu("Ekspor Excel", "CSV"), { tunggu: ".leaflet-marker-icon" }],
  // AT-E05
  ["EK-P05", "/gpci/toko-suvenir", "XLSX", menu("Unduh", "XLSX"), { tunggu: "#directory li" }],
  ["EK-P06", "/gpci/hotel", "XLSX", menu("Unduh", "XLSX"), { tunggu: "canvas" }],
  ["EK-P07", "/gci/pariwisata/pertunjukan-budaya", "XLSX", menu(/^Ekspor Excel/, "XLSX"), { tunggu: "h1" }],
  // GM-E02: semua pilar + tiap pilar (ekspor mengambil semua hasil filter dari server).
  // ID ditulis literal supaya scripts/dokumen/bangun.py bisa mencocokkannya dengan docs/skenario.
  ...(["Semua", ...Object.values(PILLAR_LABEL)].map((pilar, i) => [
    ["EK-P08", "EK-P09", "EK-P10", "EK-P11", "EK-P12", "EK-P13"][i],
    "/gmti",
    `XLSX pilar ${pilar}`,
    menu("Unduh", "XLSX"),
    { tunggu: "#directory li", siapkan: (p: Page) => p.getByRole("button", { name: pilar, exact: true }).click() },
  ]) as [string, string, string, ReturnType<typeof menu>, OpsiParitas][]),
];

for (const [id, path, aksi, unduh, opsi] of KASUS) {
  test(`${id} ${path} — ekspor ${aksi}`, async ({ browser, page }, info) => {
    test.skip(info.project.name === "mobile", "isi berkas tidak bergantung lebar layar");
    await bandingkanEkspor(browser, page, path, info, unduh, opsi);
  });
}

// DS-E07: CSV terfilter (tautan unduh server, bukan ExportButton). Baris halaman pertama produksi
// disuntikkan seperti DS-P04 supaya keadaan tabel sama; isi CSV sendiri dibaca dari server masing-masing.
test(`EK-P14 /sdi/${S1} — CSV terfilter Kebangsaan JEPANG`, async ({ browser, page }, info) => {
  test.skip(info.project.name === "mobile", "isi berkas tidak bergantung lebar layar");
  await bandingkanEkspor(
    browser,
    page,
    `/sdi/${S1}`,
    info,
    async (p) => {
      const [d] = await Promise.all([p.waitForEvent("download"), p.getByRole("link", { name: /CSV \(terfilter\)/ }).click()]);
      return d;
    },
    {
      tunggu: "text=lihat di portal ↗",
      // Urutan baris CSV tidak ditentukan di kedua sisi (tanpa ORDER BY); diterima pemilik 3 Nov 2026.
      abaikanUrutanBaris: true,
      samakanBaris: {
        produksi: `/api/sdi/${S1}?offset=0`,
        portal: `/_api/dataset/${S1}/halaman`,
        ambil: (j) => j.rows,
        pasang: (j, baris) => ({ ...j, data: { ...j.data, baris: { items: baris } } }),
      },
      siapkan: async (p) => {
        await p.getByRole("button", { name: /^Filter/ }).click();
        await p.locator("label").filter({ hasText: /^JEPANG/ }).getByRole("checkbox").check();
        await p.getByText("Kebangsaan: JEPANG").waitFor();
      },
    },
  );
});
