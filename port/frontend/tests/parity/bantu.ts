/**
 * Pembantu uji paritas (SPEC §7): visual ≤ 2% dan himpunan angka DOM identik, portal vs produksi.
 * Pola dipakai semua fitur (docs/pola-fitur.md §Paritas).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { expect, type Browser, type Download, type Page, type TestInfo } from "@playwright/test";
import * as XLSX from "xlsx";
// Pembanding PNG bawaan Playwright (yang dipakai toMatchSnapshot). Diambil dari bundel internal
// supaya rasio piksel bisa dicatat di laporan; versi Playwright dipatok (1.64.1), jadi jalurnya stabil.
import { utils } from "playwright-core/lib/coreBundle";

/** Ambang SPEC §7: beda piksel ≤ 2% per halaman. */
export const AMBANG_PIKSEL = 0.02;

export const PRODUKSI = process.env.PRODUKSI_URL ?? "https://dispar.rantai.dev";

/**
 * Selalu di-mask (SPEC §7):
 * - header nav: item asisten AI v2 (kini "Jekate", 464fc15) sengaja tidak di-port (SPEC §5.4),
 *   sehingga posisi item nav lain bergeser; nav sendiri diuji plan 10. Dicatat sebagai "Nav AI".
 * - tile peta Leaflet dan iframe Google Maps: isi pihak ketiga, dimuat tak serempak.
 * Cap waktu "data per …": tidak ada elemen seperti itu di rute v2 maupun portal (diperiksa plan
 * 17); tanggal yang tampil (snapshot GMTI, check-in hotel) berasal dari data yang sama, jadi ikut
 * dibandingkan.
 */
const MASK_SELALU = ["header", ".leaflet-tile-pane", "iframe"];

/** Satu aturan injeksi baris: respons produksi pertama yang URL-nya memuat `produksi` → respons portal yang URL-nya memuat `portal`. */
export type AturanBaris = {
  produksi: string;
  portal: string;
  ambil: (json: any) => unknown[];
  pasang: (json: any, baris: unknown[]) => unknown;
};

export type OpsiParitas = {
  /** Selektor yang di-mask di kedua sisi (angka hidup P4, tile peta, iframe). */
  mask?: string[];
  /** Selektor yang angkanya tidak ikut dibandingkan (whitelist P4). */
  abaikanAngka?: string[];
  /** Tunggu sampai selektor ini ada (data klien selesai dimuat). */
  tunggu?: string;
  /**
   * Baris tanpa sort tidak deterministik (ClickHouse tanpa ORDER BY, inventaris E §4.4), jadi
   * baris yang dirender produksi disuntikkan ke respons portal: yang dibandingkan adalah render
   * atas data yang sama. `produksi`/`portal` = penggalan URL respons; `ambil`/`pasang` memetakan
   * bentuk JSON-nya.
   */
  samakanBaris?: AturanBaris | AturanBaris[];
  /**
   * Ekspor tanpa ORDER BY: isi dibandingkan setelah baris data diurutkan (header tetap di depan).
   * Hanya untuk kasus yang disetujui pemilik; berlabel "Urutan baris" di laporan.
   */
  abaikanUrutanBaris?: boolean;
  /** "viewport" = hanya layar pertama (halaman yang isinya sengaja berbeda, mis. /docs P3). */
  layar?: "penuh" | "viewport";
  /** Aksi sebelum tangkapan (mis. menggulir, membuka panel, atau skenario interaksi). */
  siapkan?: (page: Page) => Promise<void>;
  /**
   * Pengecualian paritas yang dipakai, dicatat di laporan (kode di `PENGECUALIAN`). "Nav AI",
   * "Peta", "Layar pertama", dan "Baris produksi" ditambahkan otomatis dari opsi di atas.
   */
  pengecualian?: (keyof typeof PENGECUALIAN)[];
};

/**
 * Daftar pengecualian/penyesuaian paritas beserta alasan dan rujukannya; dicetak sebagai legenda di
 * laporan. Pengecualian SPEC hanya P1–P5 + Nav AI; sisanya penyesuaian cara banding yang sudah
 * diputuskan di plan sebelumnya, dicantumkan supaya terlihat di tiap baris laporan.
 */
export const PENGECUALIAN = {
  "Nav AI": "header di-mask: item asisten AI/Jekate tidak di-port, posisi item lain bergeser (SPEC §5.4; nav diuji plan 10)",
  P1: "kicker golf: produksi menampilkan kunci literal `home.vol2_kicker` (SPEC §5.5)",
  P2: "tombol Verifikasi sumber + tautan /api/restaurants dan /api/refresh tidak di-port (SPEC §5.5)",
  P3: "isi /docs dari OpenAPI Laravel; hanya kerangka hero dibandingkan, 390 dilewati (SPEC §5.5)",
  P4: "angka beranda hidup vs beku di produksi (SPEC §5.5)",
  P5: "/scraped-hotels membaca Bronze; respons produksi disuntikkan (SPEC §5.5)",
  D: "kolom \"Nilai terbaru\" tidak dibandingkan angkanya: diambil dari baris pertama tanpa ORDER BY (defect D, K-12; ADR 0001 plan 13)",
  Peta: "peta Leaflet di-mask utuh (marker cluster/canvas dan popup); tile + iframe Google Maps selalu di-mask (SPEC §7.1)",
  "Layar pertama": "hanya layar pertama yang dibandingkan (daftar sangat panjang atau tinggi berubah oleh data tak deterministik; plan 13–15)",
  "Baris produksi": "baris tanpa ORDER BY tak deterministik; baris yang dirender produksi disuntikkan ke respons portal (samakanBaris, plan 11/15)",
  "Urutan baris": "ekspor tanpa ORDER BY di Next.js maupun Data API: isi berkas dibandingkan setelah baris diurutkan (EK-P14, diterima pemilik 3 Nov 2026)",
} as const;

/** Label pengecualian yang berlaku untuk opsi ini (otomatis + eksplisit). */
function labelPengecualian(o: OpsiParitas): string[] {
  const l: string[] = ["Nav AI"];
  if (o.mask?.some((m) => /\.leaflet-(container|overlay-pane|marker-pane|shadow-pane)/.test(m))) l.push("Peta");
  if (o.layar === "viewport") l.push("Layar pertama");
  if (o.samakanBaris) l.push("Baris produksi");
  if (o.abaikanUrutanBaris) l.push("Urutan baris");
  return [...new Set([...l, ...(o.pengecualian ?? [])])];
}

/** Hasil satu perbandingan; dilampirkan ke tes sebagai JSON lalu dibaca reporter `laporan.ts`. */
export type HasilParitas = {
  path: string;
  rasioPiksel: number;
  angkaSama: boolean;
  /** Token angka yang hanya ada di salah satu sisi (maks. 10 per sisi). */
  angkaHanyaProduksi: string[];
  angkaHanyaPortal: string[];
  pengecualian: string[];
  perf: { produksi: Perf; portal: Perf };
};
export type Perf = { lcpMs: number; transferByte: number };

/** Mulai mengukur LCP (PerformanceObserver) dan total transfer (header + body ter-encode). */
async function mulaiUkur(page: Page): Promise<() => Promise<Perf>> {
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: number };
    w.__lcp = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  const ukuran: Promise<number>[] = [];
  page.on("requestfinished", (r) =>
    ukuran.push(r.sizes().then((s) => s.responseBodySize + s.responseHeadersSize, () => 0)),
  );
  return async () => ({
    lcpMs: Math.round(await page.evaluate(() => (window as unknown as { __lcp: number }).__lcp)),
    transferByte: (await Promise.all(ukuran)).reduce((a, b) => a + b, 0),
  });
}

/** Rasio piksel berbeda (0–1); ukuran gambar berbeda = 1. */
function rasioBeda(a: Buffer, b: Buffer): { rasio: number; diff?: Buffer } {
  const hasil = utils.getComparator("image/png")(a, b, { maxDiffPixelRatio: 0 });
  if (!hasil) return { rasio: 0 };
  const m = hasil.errorMessage?.match(/^(\d+) pixels/);
  if (!m) return { rasio: 1, diff: hasil.diff };
  const { width, height } = { width: a.readUInt32BE(16), height: a.readUInt32BE(20) };
  return { rasio: Number(m[1]) / (width * height), diff: hasil.diff };
}

/**
 * Dock asisten AI v2 ("Jekate", tombol `.ai-dock-btn` + panelnya) tidak di-port (SPEC §1), jadi
 * dibuang dari halaman produksi sebelum dibandingkan. Portal tidak punya elemen seperti itu.
 */
async function buangDockAi(page: Page) {
  await page.evaluate(() => document.querySelectorAll("[class*='ai-dock']").forEach((e) => e.remove()));
}

/**
 * Tunggu render selesai (SPEC §7.1):
 * - tile Leaflet `load`: semua `img.leaflet-tile` sudah `complete` (dimuat atau gagal);
 * - ECharts `finished`: instance ECharts tidak terjangkau dari luar bundel produksi (Next.js), jadi
 *   padanannya dipakai di kedua sisi: isi semua canvas tidak berubah di dua cuplikan berturut-turut
 *   (animasi selesai).
 */
export async function tungguRender(page: Page) {
  await page
    .waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>("img.leaflet-tile")].every((i) => i.complete), null, { timeout: 20_000 })
    .catch(() => undefined); // tile pihak ketiga yang macet tetap di-mask; jangan gagalkan tes karenanya
  let sebelum = "";
  for (let i = 0; i < 30; i++) {
    const sekarang = await page.evaluate(() =>
      [...document.querySelectorAll("canvas")]
        .map((c) => {
          try {
            const d = c.toDataURL();
            let h = 0;
            for (let j = 0; j < d.length; j += 7) h = (h * 31 + d.charCodeAt(j)) | 0;
            return `${c.width}x${c.height}:${h}`;
          } catch {
            return "x";
          }
        })
        .join("|"),
    );
    if (i > 0 && sekarang === sebelum) break;
    sebelum = sekarang;
    await page.waitForTimeout(300);
  }
  // Transisi CSS (≤ 300 ms).
  await page.waitForTimeout(300);
}

/** Buka halaman dan tunggu font, data, chart, dan peta tenang. */
async function buka(page: Page, url: string, o: OpsiParitas, produksi: boolean) {
  await page.goto(url, { waitUntil: "networkidle" });
  if (produksi) await buangDockAi(page);
  if (o.tunggu) await page.locator(o.tunggu).first().waitFor({ timeout: 60_000 });
  await o.siapkan?.(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  await tungguRender(page);
}

/**
 * Tangkapan halaman penuh. Halaman ber-canvas: viewport diperbesar setinggi dokumen, karena
 * `fullPage` Playwright menggambar canvas ECharts dalam keadaan sempit selama capture (catatan
 * plan 10). Halaman tanpa canvas memakai `fullPage` biasa (tanpa batas tinggi).
 */
async function tangkap(page: Page, o: OpsiParitas): Promise<Buffer> {
  const mask = [...MASK_SELALU, ...(o.mask ?? [])].map((m) => page.locator(m));
  const opsi = { mask, animations: "disabled" as const, caret: "hide" as const };
  if (o.layar === "viewport") return page.screenshot(opsi);
  if ((await page.locator("canvas").count()) === 0) return page.screenshot({ ...opsi, fullPage: true });
  const lebar = page.viewportSize()!.width;
  const tinggi = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: lebar, height: Math.min(tinggi, 16_000) });
  await tungguRender(page);
  return page.screenshot(opsi);
}

/** Semua token angka di teks `main` (KPI, tabel, judul), tanpa teks elemen yang di-whitelist. */
async function angka(page: Page, abaikan: string[]): Promise<string[]> {
  const teks = await page.evaluate((abaikan) => {
    const main = (document.querySelector("main") ?? document.body) as HTMLElement;
    let t = main.innerText;
    for (const s of abaikan) main.querySelectorAll<HTMLElement>(s).forEach((e) => (t = t.split(e.innerText).join(" ")));
    return t;
  }, abaikan);
  return [...new Set(teks.match(/\d[\d.,]*/g) ?? [])].sort();
}

/**
 * Buka `path` di produksi (tab baru, viewport sama) dan di portal (`page`) dalam keadaan yang sama,
 * termasuk `samakanBaris` dan `siapkan`. Mengembalikan tab produksi + pengukur performa.
 */
export async function bukaKedua(browser: Browser, page: Page, path: string, info: TestInfo, o: OpsiParitas = {}) {
  const prod = await browser.newPage({
    viewport: page.viewportSize()!,
    isMobile: info.project.use.isMobile,
    hasTouch: info.project.use.hasTouch,
    deviceScaleFactor: info.project.use.deviceScaleFactor,
  });
  const [ukurProd, ukurPortal] = await Promise.all([mulaiUkur(prod), mulaiUkur(page)]);
  const aturan = o.samakanBaris ? [o.samakanBaris].flat() : [];
  if (aturan.length) {
    // Produksi dibuka dulu (termasuk `siapkan`), respons yang cocok ditangkap, lalu disuntikkan ke portal.
    const tangkapan = new Map<AturanBaris, Promise<unknown>>();
    prod.on("response", (r) => {
      for (const a of aturan) if (!tangkapan.has(a) && r.url().includes(a.produksi) && r.ok()) tangkapan.set(a, r.json());
    });
    await buka(prod, PRODUKSI + path, o, true);
    for (const a of aturan) {
      const json = tangkapan.get(a);
      if (!json) throw new Error(`respons produksi ${a.produksi} tidak tertangkap`);
      const baris = a.ambil(await json);
      await page.route((u) => u.href.includes(a.portal), async (route) => {
        const res = await route.fetch();
        await route.fulfill({ response: res, json: a.pasang(await res.json(), baris) });
      });
    }
    await buka(page, path, o, false);
  } else {
    await Promise.all([buka(prod, PRODUKSI + path, o, true), buka(page, path, o, false)]);
  }
  return { prod, ukur: async () => ({ produksi: await ukurProd(), portal: await ukurPortal() }) };
}

export async function bandingkanHalaman(browser: Browser, page: Page, path: string, info: TestInfo, o: OpsiParitas = {}) {
  const { prod, ukur } = await bukaKedua(browser, page, path, info, o);
  const perf = await ukur();
  const angkaProd = await angka(prod, o.abaikanAngka ?? []);
  const angkaPortal = await angka(page, o.abaikanAngka ?? []);
  expect.soft(angkaPortal, `himpunan angka ${path}`).toEqual(angkaProd);

  const nama = `${info.title.split(" ")[0]}-${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "beranda"}.png`;
  const berkas = info.snapshotPath(nama);
  mkdirSync(dirname(berkas), { recursive: true });
  const produksi = await tangkap(prod, o);
  writeFileSync(berkas, produksi);
  const portal = await tangkap(page, o);
  const { rasio, diff } = rasioBeda(produksi, portal);
  await info.attach(`produksi-${nama}`, { body: produksi, contentType: "image/png" });
  await info.attach(`portal-${nama}`, { body: portal, contentType: "image/png" });
  if (diff) await info.attach(`beda-${nama}`, { body: diff, contentType: "image/png" });

  const hanya = (a: string[], b: string[]) => a.filter((x) => !b.includes(x)).slice(0, 10);
  const hasil: HasilParitas = {
    path,
    rasioPiksel: rasio,
    angkaSama: JSON.stringify(angkaProd) === JSON.stringify(angkaPortal),
    angkaHanyaProduksi: hanya(angkaProd, angkaPortal),
    angkaHanyaPortal: hanya(angkaPortal, angkaProd),
    pengecualian: labelPengecualian(o),
    perf,
  };
  await info.attach("paritas-hasil", { body: JSON.stringify(hasil), contentType: "application/json" });
  expect.soft(rasio, `beda piksel ${path} (ambang ${AMBANG_PIKSEL * 100}%)`).toBeLessThanOrEqual(AMBANG_PIKSEL);
  await prod.close();
}

/** Hasil banding isi berkas ekspor; dilampirkan sebagai `paritas-hasil` (reporter: bagian Ekspor). */
export type HasilEkspor = {
  path: string;
  ekspor: {
    namaProduksi: string;
    namaPortal: string;
    namaSama: boolean;
    bomSama: boolean;
    headerSama: boolean;
    barisProduksi: number;
    barisPortal: number;
    /** Sel berbeda pada posisi yang sama (baris × kolom). */
    selBeda: number;
    /** Sel berbeda setelah baris diurutkan (0 = isi sama, hanya urutan yang berbeda). */
    selBedaTanpaUrutan: number;
    contoh: string[];
  };
  pengecualian: string[];
};

/** Lembar pertama sebagai array baris sel teks (CSV, XLS/HTML, dan XLSX dibaca pustaka `xlsx`). */
function lembar(isi: Buffer): string[][] {
  const wb = XLSX.read(isi, { type: "buffer", raw: true });
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, raw: false, defval: "" });
}

/** Tanggal di nama berkas (cap hari unduh) disamakan supaya polanya yang dibandingkan. */
const polaNama = (n: string) => n.replace(/\d{4}-\d{2}-\d{2}/g, "YYYY-MM-DD");

function selBerbeda(a: string[][], b: string[][], contoh: string[] = []): number {
  let n = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    for (let j = 0; j < Math.max(a[i]?.length ?? 0, b[i]?.length ?? 0); j++)
      if (String(a[i]?.[j] ?? "") !== String(b[i]?.[j] ?? "")) {
        n++;
        if (contoh.length < 5) contoh.push(`baris ${i + 1} kolom ${j + 1}: produksi "${a[i]?.[j] ?? ""}" vs portal "${b[i]?.[j] ?? ""}"`);
      }
  return n;
}

/**
 * Paritas ekspor (SPEC §7.3): buka halaman di kedua sisi dalam keadaan yang sama, unduh berkas lewat
 * `unduh`, lalu bandingkan pola nama, BOM, header, jumlah baris, dan isi tiap sel. Tidak dilonggarkan:
 * beda karena data hidup dicatat sebagai beda.
 */
export async function bandingkanEkspor(
  browser: Browser,
  page: Page,
  path: string,
  info: TestInfo,
  unduh: (p: Page) => Promise<Download>,
  o: OpsiParitas = {},
) {
  const { prod } = await bukaKedua(browser, page, path, info, o);
  const ambil = async (p: Page) => {
    const d = await unduh(p);
    const isi = readFileSync((await d.path())!);
    return { nama: d.suggestedFilename(), isi, baris: lembar(isi) };
  };
  const a = await ambil(prod);
  const b = await ambil(page);
  await info.attach(`produksi-${a.nama}`, { body: a.isi });
  await info.attach(`portal-${b.nama}`, { body: b.isi });
  const urut = (x: string[][]) => [x[0] ?? [], ...x.slice(1).map((r) => r.map(String)).sort((p, q) => JSON.stringify(p).localeCompare(JSON.stringify(q)))];
  const contoh: string[] = [];
  const bom = (x: Buffer) => x.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
  const hasil: HasilEkspor = {
    path,
    ekspor: {
      namaProduksi: a.nama,
      namaPortal: b.nama,
      namaSama: polaNama(a.nama) === polaNama(b.nama),
      bomSama: bom(a.isi) === bom(b.isi),
      headerSama: JSON.stringify(a.baris[0]) === JSON.stringify(b.baris[0]),
      barisProduksi: a.baris.length,
      barisPortal: b.baris.length,
      selBeda: selBerbeda(a.baris, b.baris, contoh),
      selBedaTanpaUrutan: selBerbeda(urut(a.baris), urut(b.baris)),
      contoh,
    },
    pengecualian: labelPengecualian(o),
  };
  await info.attach("paritas-hasil", { body: JSON.stringify(hasil), contentType: "application/json" });
  await prod.close();
  const e = hasil.ekspor;
  expect.soft(polaNama(e.namaPortal), "pola nama berkas").toBe(polaNama(e.namaProduksi));
  expect.soft(e.bomSama, "BOM sama").toBe(true);
  expect.soft(b.baris[0], "header kolom").toEqual(a.baris[0]);
  expect.soft(e.barisPortal, "jumlah baris").toBe(e.barisProduksi);
  if (o.abaikanUrutanBaris) expect.soft(e.selBedaTanpaUrutan, "sel berbeda setelah baris diurutkan").toBe(0);
  else expect.soft(e.selBeda, `sel berbeda (${contoh.join("; ")})`).toBe(0);
}
