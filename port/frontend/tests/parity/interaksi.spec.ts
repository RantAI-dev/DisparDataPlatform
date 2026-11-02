// Paritas interaksi (SPEC §7 butir 3): langkah yang sama dari skenario e2e (docs/skenario/*.md, ID
// di komentar) dijalankan di produksi dan portal, lalu hasilnya dibandingkan seperti halaman biasa
// (piksel ≤ 2% + himpunan angka). Pilihan nilai memakai data sungguhan (bukan fixture e2e).
import { test, type Locator, type Page } from "@playwright/test";
import { bandingkanHalaman, type AturanBaris, type OpsiParitas } from "./bantu";

const S1 = "data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan";
const KICKER_GOLF = "[data-section='golf'] section:first-of-type .atlas-mono";

/** Detail S1 seperti DS-P04: baris halaman pertama produksi disuntikkan ke portal. */
const DETAIL_S1: OpsiParitas = {
  tunggu: "text=lihat di portal ↗",
  samakanBaris: {
    produksi: `/api/sdi/${S1}?offset=0`,
    portal: `/_api/dataset/${S1}/halaman`,
    ambil: (j) => j.rows,
    pasang: (j, baris) => ({ ...j, data: { ...j.data, baris: { items: baris } } }),
  },
};

/** Tunggu isi tabel tidak berubah selama 600 ms (jawaban sort/filter dari server sudah dirender). */
const tabelTenang = async (p: Page) => {
  let sebelum = "";
  for (let i = 0; i < 40; i++) {
    const kini = await p.locator("tbody").first().innerText();
    if (kini === sebelum) return;
    sebelum = kini;
    await p.waitForTimeout(600);
  }
};

const filterJepang = async (p: Page) => {
  await p.getByRole("button", { name: /^Filter/ }).click();
  await p.locator("label").filter({ hasText: /^JEPANG/ }).getByRole("checkbox").check();
  await p.getByText("Kebangsaan: JEPANG").waitFor();
  // Tunggu sampai tabel benar-benar berisi baris terfilter ("31 / 31 baris (terfilter dari 664)").
  await p.waitForFunction(() => {
    const m = document.body.innerText.match(/(\d+) \/ (\d+) baris \(terfilter dari/);
    return !!m && m[1] === m[2] && document.querySelectorAll("tbody tr").length === Number(m[1]);
  });
};

/** Direktori seperti AT-P02 (P2, layar pertama). */
const DIREKTORI: OpsiParitas = {
  tunggu: "#directory li",
  mask: ["main > div:first-child", "#sources > div:first-child > div:nth-child(2)"],
  layar: "viewport",
  pengecualian: ["P2"],
};

/** /spatial seperti GM-P02: panel saja, tinggi peta dihitung ulang setelah dock AI dibuang. */
const SPATIAL: OpsiParitas = { tunggu: "text=/[1-9][\\d.]* titik/", mask: [".leaflet-container"], layar: "viewport" };
const spatial = (aksi: (strip: Locator, p: Page) => Promise<unknown>) => async (p: Page) => {
  await p.evaluate(() => window.dispatchEvent(new Event("resize")));
  const strip = p.locator("details").first();
  if (!(await strip.evaluate((d: HTMLDetailsElement) => d.open))) await strip.locator("summary").click();
  await aksi(strip, p);
};

/**
 * IN-E06: venue digambar di canvas peta; cari piksel oranye (#ed6b23) lalu klik di sana sampai panel
 * venue berganti. Peta kedua sisi identik (tile di-mask), jadi titik yang sama terpilih.
 */
const pilihVenue = async (p: Page) => {
  const panel = p.locator("aside");
  const awal = await panel.locator(".text-\\[17px\\]").innerText();
  const kanvas = p.locator(".leaflet-container canvas").first();
  await p.waitForFunction(() => (document.querySelector(".leaflet-container canvas") as HTMLCanvasElement | null)?.height);
  const kandidat = await kanvas.evaluate((c: HTMLCanvasElement) => {
    const { data, width, height } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    const skala = c.width / c.getBoundingClientRect().width;
    const oranye = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      return Math.abs(data[i]! - 237) < 8 && Math.abs(data[i + 1]! - 107) < 8 && Math.abs(data[i + 2]! - 35) < 8;
    };
    const hasil: { x: number; y: number }[] = [];
    for (let y = 2; y < height - 2 && hasil.length < 8; y += 3)
      for (let x = 2; x < width - 2 && hasil.length < 8; x += 3)
        if (oranye(x, y) && oranye(x - 2, y) && oranye(x + 2, y) && oranye(x, y - 2) && oranye(x, y + 2)) hasil.push({ x: x / skala, y: y / skala });
    return hasil;
  });
  for (const titik of kandidat) {
    await kanvas.click({ position: titik });
    if ((await panel.locator(".text-\\[17px\\]").innerText()) !== awal) return;
  }
  throw new Error("tidak ada venue yang bisa dipilih");
};

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
  ["IX-P06", "/gci/pariwisata/restoran-gci", "filter tier Cafe", { tunggu: "text=Restoran", siapkan: klik("Cafe") }],
  // AT-E03: toggle bahasa EN; P2 sama dengan AT-P02.
  ["IX-P07", "/gci/pariwisata/direktori-restoran", "bahasa EN", {
    tunggu: "#directory li",
    mask: ["main > div:first-child", "#sources > div:first-child > div:nth-child(2)"],
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
    siapkan: async (p) => {
      await p.getByRole("combobox").first().selectOption("2024");
      await p.getByText("semua event pariwisata & budaya · 2024").waitFor({ timeout: 30_000 });
    },
  }],

  // ── Dataset (DS-E02, E04, E05, E06, E08) ──
  // DS-E02
  ["IX-P10", "/katalog", "tier Sekunder + lapisan Gold", {
    tunggu: "tbody tr:nth-child(100)",
    siapkan: async (p) => {
      await klik("Sekunder")(p);
      await p.getByRole("button", { name: /^Gold/ }).click();
    },
  }],
  // DS-E04
  ["IX-P11", `/sdi/${S1}`, "chip filter Kebangsaan JEPANG", { ...DETAIL_S1, siapkan: filterJepang }],
  // DS-E05
  ["IX-P12", `/sdi/${S1}`, "sort Jumlah Kunjungan ▲", {
    ...DETAIL_S1,
    siapkan: async (p) => {
      await p.getByRole("button", { name: "Urutkan menurut Jumlah Kunjungan" }).click();
      await p.locator("th[aria-sort='ascending']").waitFor();
      await tabelTenang(p);
    },
  }],
  // DS-E06
  // Halaman kedua juga tanpa ORDER BY: baris offset 50 produksi ikut disuntikkan ke `baris?page=2` portal.
  ["IX-P13", `/sdi/${S1}`, "gulir memuat 50 baris berikutnya", {
    ...DETAIL_S1,
    samakanBaris: [
      DETAIL_S1.samakanBaris as AturanBaris,
      { produksi: `/api/sdi/${S1}?offset=50`, portal: `/_api/dataset/${S1}/baris?page=2`, ambil: (j) => j.rows, pasang: (j, baris) => ({ ...j, data: { ...j.data, items: baris } }) },
    ],
    siapkan: async (p) => {
      await p.getByText("Gulir untuk memuat lebih banyak").scrollIntoViewIfNeeded();
      await p.getByText(/^100 \/ \d/).waitFor();
    },
  }],
  // DS-E08
  ["IX-P14", `/sdi/${S1}`, "chart builder + Tambah grafik", {
    ...DETAIL_S1,
    siapkan: async (p) => {
      await p.getByRole("button", { name: "+ Tambah grafik" }).click();
      await p.locator(".grid canvas").first().waitFor();
    },
  }],

  // ── Dashboard (DB-E05, semester DB-E02) ──
  // DB-E05
  ["IX-P15", "/dashboard/pdrb-ekraf", "sebaran subsektor 2022", { tunggu: "canvas", siapkan: klik("2022") }],
  // DB-E02 cabang semester: bulan tanpa data bulanan BPS → donut pintu masuk semesteran SDI.
  ["IX-P16", "/dashboard/wisman", "bulan 2025-03 (pintu masuk semesteran)", {
    tunggu: "canvas",
    siapkan: async (p) => {
      await p.locator("select").first().selectOption("2025-03");
      await p.getByText("ditampilkan data semesteran SDI").waitFor();
    },
  }],

  // ── Atlas (AT-E01, E03, E04, E05) ──
  // AT-E01 paging
  ["IX-P17", "/gci/pariwisata/restoran-gci", "paging Muat lagi", {
    tunggu: "text=Restoran",
    siapkan: (p) => p.getByRole("button", { name: /^Muat \d+ lagi$/ }).click(),
  }],
  // AT-E01 cari kosong
  ["IX-P18", "/gci/pariwisata/restoran-gci", "cari tanpa hasil", {
    tunggu: "text=Restoran",
    siapkan: async (p) => {
      await p.getByPlaceholder("Cari nama / kuliner / area…").fill("zzzz-tidak-ada");
      await p.getByText("Tidak ada entri yang cocok dengan filter.").waitFor();
    },
  }],
  // AT-E03 mode daftar (radio kedua; label disembunyikan di layar sempit).
  ["IX-P19", "/gci/pariwisata/direktori-restoran", "mode daftar", { ...DIREKTORI, siapkan: (p) => p.getByRole("radio").nth(1).click() }],
  // AT-E03 cari
  ["IX-P20", "/gci/pariwisata/direktori-restoran", "cari Toscana", {
    ...DIREKTORI,
    siapkan: (p) => p.getByPlaceholder("Cari restoran di Jakarta…").fill("Toscana"),
  }],
  // AT-E04: jenis Driving Range lalu pilih kartu pertama. P1 sama dengan AT-P03.
  ["IX-P21", "/gpci/lapangan-golf", "Driving Range + pilih kartu", {
    tunggu: ".leaflet-marker-icon",
    mask: [KICKER_GOLF],
    abaikanAngka: [KICKER_GOLF],
    pengecualian: ["P1"],
    siapkan: async (p) => {
      await klik("Driving Range")(p);
      await p.locator("aside li").first().click();
      await p.getByText("TERPILIH", { exact: true }).waitFor();
    },
  }],
  // AT-E05: relevansi bawaan → Semua, lalu mode tabel.
  ["IX-P22", "/gpci/toko-suvenir", "Semua + mode tabel", {
    tunggu: "#directory li",
    siapkan: async (p) => {
      await klik("Semua")(p);
      await p.getByRole("button", { name: "Tabel" }).click();
      await p.locator("tbody tr").first().waitFor();
    },
  }],
  // Tahun event pertunjukan-budaya: pilihan UI tetap Semua/2025/2026 (YEAR_FILTERS, sama dengan v2);
  // "Semua tahun" = keadaan bawaan AT-P06.
  ...(["2025", "2026"].map((y, i) => [["IX-P23", "IX-P24"][i], "/gci/pariwisata/pertunjukan-budaya", `tahun ${y}`, {
    tunggu: "h1",
    siapkan: klik(y),
  }]) as [string, string, string, OpsiParitas][]),

  // ── GMTI + Spatial (GM-E01, GM-E03) ──
  // GM-E01
  ["IX-P25", "/gmti", "Tampilkan 200 lagi", {
    tunggu: "#directory li",
    siapkan: async (p) => {
      await p.getByRole("button", { name: /^Tampilkan 200 lagi/ }).click();
      await p.locator("#directory li:nth-child(201)").waitFor();
    },
  }],
  ["IX-P26", "/gmti", "cari istiqlal", {
    tunggu: "#directory li",
    siapkan: (p) => p.getByPlaceholder("Cari nama, alamat, kecamatan, atau nomor sertifikat…").fill("istiqlal"),
  }],
  ["IX-P27", "/gmti", "mode tabel", {
    tunggu: "#directory li",
    siapkan: async (p) => {
      await p.getByRole("button", { name: "Tabel" }).click();
      await p.locator("#directory tbody tr").first().waitFor();
    },
  }],
  // GM-E03 (panel saja seperti GM-P02; pin dan choropleth di dalam peta di-mask).
  ["IX-P28", "/spatial", "toggle Kepadatan kecamatan", { ...SPATIAL, siapkan: spatial((s) => s.getByRole("button", { name: "Kepadatan kecamatan" }).click()) }],
  ["IX-P29", "/spatial", "chip Hotel", { ...SPATIAL, siapkan: spatial((s) => s.getByRole("button", { name: "Hotel", exact: true }).click()) }],
  ["IX-P30", "/spatial", "chip Hotel lalu Reset filter", {
    ...SPATIAL,
    siapkan: spatial(async (s) => {
      await s.getByRole("button", { name: "Hotel", exact: true }).click();
      await s.getByRole("button", { name: "Reset filter" }).click();
    }),
  }],
  ["IX-P31", "/spatial", "wilayah Jakarta Selatan", {
    ...SPATIAL,
    siapkan: spatial((s) => s.getByRole("combobox", { name: "Wilayah" }).selectOption("Jakarta Selatan").then(() => undefined)),
  }],
  // Popup titik: pane peta di-mask kecuali popup (tile, choropleth, pin), jadi isi popup ikut dibandingkan.
  ["IX-P32", "/spatial", "cari Canary Coffee Shop + popup", {
    ...SPATIAL,
    mask: [".leaflet-overlay-pane", ".leaflet-marker-pane", ".leaflet-shadow-pane"],
    siapkan: spatial(async (s, p) => {
      await s.getByRole("textbox", { name: "Cari tempat" }).fill("Canary Coffee Shop");
      await s.getByRole("status").filter({ hasText: /^1 \// }).waitFor();
      const pin = p.locator(".leaflet-marker-icon").first();
      await pin.waitFor();
      for (let i = 0; i < 10 && !(await p.locator(".leaflet-popup").filter({ hasText: "Canary Coffee Shop" }).count()); i++) {
        await pin.dispatchEvent("click");
        await p.waitForTimeout(500);
      }
    }),
  }],

  // ── Indikator (IN-E06 pilih venue) ──
  ["IX-P33", "/gci/pariwisata/seni-pertunjukan", "pilih venue di peta", { siapkan: pilihVenue }],
];

// ── Modal "Perbesar grafik" (DB-E06) per halaman ber-ChartCard. IX-P05 (pdrb-ekraf) di atas. ──
// Satu chart per halaman cukup: modal dan isinya dirender ChartCard yang sama; kartu komponen
// khusus (LosByClass, DestinasiStat) dibuka sekali di /dashboard/wisman karena /dashboard/wisnus
// memakai komponen yang sama dengan `guest`/`jenis` berbeda.
const MODAL: [string, string, string | null][] = [
  ["IX-P34", "/dashboard/wisman", null],
  ["IX-P35", "/dashboard/wisman", "Per kelas hotel"],
  ["IX-P36", "/dashboard/wisman", "per destinasi"],
  ["IX-P37", "/dashboard/wisnus", null],
  ["IX-P38", "/dashboard/tenaga-kerja", null],
  ["IX-P39", "/gci/pariwisata/kuliner-michelin", null],
  ["IX-P40", "/gci/pariwisata/seni-pertunjukan", null],
  ["IX-P41", "/gci/pariwisata/wisatawan-internasional", null],
];
for (const [id, path, judul] of MODAL)
  SKENARIO.push([id, path, `perbesar grafik${judul ? ` "${judul}"` : ""}`, {
    tunggu: "canvas",
    layar: "viewport",
    siapkan: async (p) => {
      const kartu = judul ? p.locator(".utility-card", { hasText: judul }) : p.locator(".utility-card", { has: p.locator("canvas") });
      await kartu.first().getByRole("button", { name: "Perbesar grafik" }).click();
      await p.getByRole("dialog").locator("canvas").first().waitFor();
    },
  }]);

for (const [id, path, aksi, opsi] of SKENARIO) {
  test(`${id} ${path} — ${aksi}`, async ({ browser, page }, info) => {
    // Di layar sempit peta venue v2 setinggi 0 px (quirk ditiru, K-10): memilih venue hanya di desktop.
    test.skip(id === "IX-P33" && info.project.name === "mobile", "peta venue 0 px di layar sempit (K-10)");
    await bandingkanHalaman(browser, page, path, info, opsi);
  });
}

// GM-E05 (buka baris hotel → tipe kamar) tidak bisa dibandingkan: /scraped-hotels produksi kosong
// (mart 0 baris, P5), jadi tidak ada baris untuk dibuka di sisi produksi. Struktur diuji e2e GM-E05.
test("IX-P42 /scraped-hotels — buka baris hotel", () => {
  test.skip(true, "P5: produksi kosong, tidak ada baris untuk dibuka");
});
