// Paritas fitur dataset (docs/skenario/dataset.md DS-P*, DC-P01): portal vs dispar.rantai.dev.
import { test } from "@playwright/test";
import { bandingkanHalaman } from "./bantu";

const S1 = "data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan";
const S2 = "penerbangan-langsung-internasional-jakarta";
const S3 = "data-pendapatan-asli-daerah-pad-sektor-pariwisata";

// P4: angka hero dan statistik kartu beranda hidup di portal, beku (in-code) di Next.js.
const ANGKA_BERANDA = [".rounded-2xl.grid > div > div:first-child", ".apple-caption-strong"];

test("DS-P01 /", async ({ browser, page }, info) => {
  await bandingkanHalaman(browser, page, "/", info, { mask: ANGKA_BERANDA, abaikanAngka: ANGKA_BERANDA });
});

test("DS-P02 /katalog", async ({ browser, page }, info) => {
  await bandingkanHalaman(browser, page, "/katalog", info, { tunggu: "tbody tr:nth-child(100)" });
});

test("DS-P03 /sdi", async ({ browser, page }, info) => {
  await bandingkanHalaman(browser, page, "/sdi", info, { tunggu: "tbody tr:nth-child(100)" });
});

for (const [id, slug] of [["S1", S1], ["S2", S2], ["S3", S3]] as const) {
  test(`DS-P04 /sdi/${id}`, async ({ browser, page }, info) => {
    await bandingkanHalaman(browser, page, `/sdi/${slug}`, info, {
      tunggu: "text=lihat di portal ↗",
      samakanBaris: {
        produksi: `/api/sdi/${slug}?offset=0`,
        portal: `/_api/dataset/${slug}/halaman`,
        ambil: (j) => j.rows,
        pasang: (j, baris) => ({ ...j, data: { ...j.data, baris: { items: baris } } }),
      },
    });
  });
}

// P3: isi /docs dihasilkan dari OpenAPI portal (berbeda dengan teks tulisan tangan Next.js). Yang
// dibandingkan hero layar pertama; isi (sidebar + endpoint), Base URL, dan pill jumlah di-mask.
test("DC-P01 /docs", async ({ browser, page }, info) => {
  // Di 390 px pill ketiga (teks autentikasi P3 baru) membungkus berbeda sehingga tinggi hero
  // berubah; perbedaan isi itu diizinkan P3, jadi kerangka dibandingkan di desktop saja.
  test.skip(info.project.name === "mobile", "P3: isi pill hero berbeda");
  const isi = ["main > div", "code.text-\\[13\\.5px\\]", ".rounded-full.px-3\\.5"];
  await bandingkanHalaman(browser, page, "/docs", info, { layar: "viewport", mask: isi, abaikanAngka: isi });
});
