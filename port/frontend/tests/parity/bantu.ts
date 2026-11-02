/**
 * Pembantu uji paritas (SPEC §7): visual ≤ 2% dan himpunan angka DOM identik, portal vs produksi.
 * Pola dipakai semua fitur (docs/pola-fitur.md §Paritas).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { expect, type Browser, type Page, type TestInfo } from "@playwright/test";
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
  samakanBaris?: {
    produksi: string;
    portal: string;
    ambil: (json: any) => unknown[];
    pasang: (json: any, baris: unknown[]) => unknown;
  };
  /** "viewport" = hanya layar pertama (halaman yang isinya sengaja berbeda, mis. /docs P3). */
  layar?: "penuh" | "viewport";
  /** Aksi sebelum tangkapan (mis. menggulir, membuka panel, atau skenario interaksi). */
  siapkan?: (page: Page) => Promise<void>;
  /** Pengecualian paritas yang dipakai (P1–P5, "Nav AI"), dicatat di laporan. */
  pengecualian?: string[];
};

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

/** Buka halaman dan tunggu font, data, chart, dan peta tenang. */
async function buka(page: Page, url: string, o: OpsiParitas, produksi: boolean) {
  await page.goto(url, { waitUntil: "networkidle" });
  if (produksi) await buangDockAi(page);
  if (o.tunggu) await page.locator(o.tunggu).first().waitFor({ timeout: 60_000 });
  await o.siapkan?.(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  // Animasi ECharts (±1 s) dan transisi CSS selesai.
  await page.waitForTimeout(1500);
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
  await page.waitForTimeout(800);
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

export async function bandingkanHalaman(browser: Browser, page: Page, path: string, info: TestInfo, o: OpsiParitas = {}) {
  const prod = await browser.newPage({
    viewport: page.viewportSize()!,
    isMobile: info.project.use.isMobile,
    hasTouch: info.project.use.hasTouch,
    deviceScaleFactor: info.project.use.deviceScaleFactor,
  });
  const [ukurProd, ukurPortal] = await Promise.all([mulaiUkur(prod), mulaiUkur(page)]);
  if (o.samakanBaris) {
    const sb = o.samakanBaris;
    const respons = prod.waitForResponse((r) => r.url().includes(sb.produksi) && r.ok());
    await buka(prod, PRODUKSI + path, o, true);
    const baris = sb.ambil(await (await respons).json());
    await page.route(`**/*${sb.portal}*`, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: sb.pasang(await res.json(), baris) });
    });
    await buka(page, path, o, false);
  } else {
    await Promise.all([buka(prod, PRODUKSI + path, o, true), buka(page, path, o, false)]);
  }

  const perf = { produksi: await ukurProd(), portal: await ukurPortal() };
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
    pengecualian: ["Nav AI", ...(o.pengecualian ?? [])],
    perf,
  };
  await info.attach("paritas-hasil", { body: JSON.stringify(hasil), contentType: "application/json" });
  expect.soft(rasio, `beda piksel ${path} (ambang ${AMBANG_PIKSEL * 100}%)`).toBeLessThanOrEqual(AMBANG_PIKSEL);
  await prod.close();
}
