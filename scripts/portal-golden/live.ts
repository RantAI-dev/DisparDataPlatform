/**
 * Golden LIVE: endpoint Data API yang sumbernya Silver/serving di ClickHouse. Ditulis ke
 * `tests/golden/live/` (gitignore) dan dibandingkan oleh uji `panggung/` plan 02–05 dengan
 * Data API yang dipanggil pada menit yang sama.
 *
 * Oracle-nya halaman/komponen/route asli platform-v2 yang tayang:
 *   - route handler `app/api/**` dipanggil langsung (Request buatan);
 *   - halaman server dan komponen client dirender; props yang mereka kirim ke `Kpi`,
 *     `ChartCard`/`Block` + chart, `IndicatorShell`, dsb. direkam (lihat alias.ts);
 *   - keadaan non-default (tahun, kota, periode, tab) dirender dengan mengganti nilai awal
 *     `useState` komponen asli.
 * Setiap fungsi `peta*` hanya memindah nilai ke bentuk respons; tidak menghitung.
 * Bagian `kpi` menyimpan props KPI persis seperti dikirim ke komponen tampilan (label dari
 * data, nilai mentah atau teks siap tampil); kontrak meneruskannya apa adanya.
 */
import { createElement as h, type ReactElement } from "react";
import fs from "node:fs";
import path from "node:path";
import { memoDengan, memoKe, propsElemen } from "./alias";
import { renderAsync, renderSinkron, simpulTeks, tautan } from "./render";
import type { Golden } from "./tulis";

type Obj = Record<string, unknown>;
type El = { type: unknown; props: Obj };
const nul = <T>(v: T | undefined): T | null => (v === undefined ? null : v);
const slugAman = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-|-$/g, "");

/** Anak elemen pertama yang berupa komponen (chart di dalam ChartCard/Block), bukan tag HTML. */
function anakKomponen(children: unknown): El | null {
  const daftar = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const c of daftar) {
    const e = c as El | null;
    // Komponen fungsi biasa, atau pembungkus objek (next/dynamic, memo) — keduanya bukan string tag.
    if (e && typeof e === "object" && e.type && typeof e.type !== "string" && "props" in e) return e;
  }
  return null;
}

/** Nama komponen anak; pembungkus next/dynamic tanpa nama dikenali dari props-nya (peta titik). */
function namaKomponen(e: El): string {
  const t = e.type as { name?: string; displayName?: string };
  return t.name || t.displayName || ("points" in e.props ? "PointMap" : "Komponen");
}

const KUNCI_DATA = ["data", "series", "categories", "bar", "line", "points", "venues"];
/** Props data mentah sebuah chart (fungsi formatter, warna, dan unit tampilan dibuang). */
function propsData(e: El): Obj {
  return Object.fromEntries(Object.entries(e.props).filter(([k]) => KUNCI_DATA.includes(k)));
}

/** Kartu chart terekam: judul, subjudul, nama komponen chart, dan props datanya. */
function kartu(namaKartu = "ChartCard"): { judul: string; sub: string | null; komponen: string | null; data: Obj }[] {
  return propsElemen<Obj>(namaKartu).map((p) => {
    const anak = anakKomponen(p.children);
    return {
      judul: String(p.title ?? ""),
      sub: p.sub == null ? null : String(p.sub),
      komponen: anak ? namaKomponen(anak) : null,
      data: anak ? propsData(anak) : {},
    };
  });
}
const kartuBerjudul = (daftar: ReturnType<typeof kartu>, awalan: string) => daftar.filter((k) => k.judul.startsWith(awalan));

/** Props KPI (label, value, sub, delta) persis seperti dikirim komponen asli. */
function kpi(nama = "Kpi"): Obj[] {
  return propsElemen<Obj>(nama).map((p) => ({ label: p.label, value: p.value, sub: nul(p.sub), ...(p.delta !== undefined ? { delta: p.delta } : {}) }));
}

/** Tabel host di markup: header dan baris sel teks. */
function tabelHtml(html: string): { header: string[]; rows: string[][] }[] {
  return [...html.matchAll(/<table[^>]*>(.*?)<\/table>/gs)].map((m) => {
    const baris = [...m[1].matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map((r) =>
      [...r[1].matchAll(/<t[hd][^>]*>(.*?)<\/t[hd]>/gs)].map((c) => simpulTeks(c[1]).join(" ")),
    );
    const adaHead = /<thead/.test(m[1]);
    return { header: adaHead ? baris[0] ?? [] : [], rows: adaHead ? baris.slice(1) : baris };
  });
}

/** Panggil route handler Next.js dan kembalikan JSON-nya. */
async function panggilRoute(
  handler: (req: Request, ctx: { params: Promise<Obj> }) => Promise<Response> | Response,
  url: string,
  params: Obj = {},
): Promise<{ status: number; json: Obj }> {
  const res = await handler(new Request(`http://golden.local${url}`), { params: Promise.resolve(params) });
  return { status: res.status, json: (await res.json()) as Obj };
}

// ── dataset + katalog ─────────────────────────────────────────────────────────

async function katalog(): Promise<Golden[]> {
  const rSdi = await import("@/app/api/sdi/route");
  const rMed = await import("@/app/api/sdi/medallion/route");
  const { CatalogView } = await import("@/components/CatalogView");
  const sdi = (await panggilRoute(rSdi.GET as never, "/api/sdi")).json;
  const med = (await panggilRoute(rMed.GET as never, "/api/sdi/medallion")).json;
  type Row = { id: string; title: string; description: string; tags: string[]; tier: string; source: string; size: string; href: string; external: boolean; medalKey: string };
  const medal = med.datasets as Record<string, { level: string; mart?: string }>;
  const keluaran: Golden[] = [];
  // useState CatalogView: 0 rows (hasil /api/sdi), 1 q, 2 tier, 3 medallion (hasil /api/sdi/medallion).
  for (const tier of ["semua", "primer", "sekunder"] as const) {
    const el = h(CatalogView, { primaryOnly: tier === "primer" });
    renderSinkron(el, { 0: sdi.datasets, 2: tier === "sekunder" ? "sekunder" : "all", 3: medal });
    // Memo komponen asli: 0 catalog, 1 medalCounts, 2 filtered, lalu stats (sdiStats).
    const stats = memoDengan<{ total: number; tags: number; views: number; lastUpdated: string | null }>("tags", "views");
    const counts = memoDengan<Record<string, number>>("bronze", "silver", "gold");
    const baris = memoKe<Row[]>(2);
    keluaran.push({
      nama: `katalog.${tier}`,
      endpoint: "/v1/katalog",
      params: tier === "semua" ? {} : { tier },
      data: {
        items: baris.map((r) => ({
          id: r.id, title: r.title, description: r.description, tags: r.tags, tier: r.tier, source: r.source,
          size_label: r.size, href: r.href, external: r.external, medallion: medal[r.medalKey] ?? null,
        })),
        stats: { total: stats.total, tags: stats.tags, views: stats.views, last_updated: stats.lastUpdated },
        layer_counts: counts,
      },
      meta: { total: baris.length },
    });
  }
  return keluaran;
}

async function dataset(): Promise<Golden[]> {
  const store = await import("@/lib/ch/store");
  const rDetail = await import("@/app/api/sdi/[slug]/route");
  const rFacet = await import("@/app/api/sdi/[slug]/facets/route");
  const rAgg = await import("@/app/api/sdi/[slug]/aggregate/route");
  // Lima slug, satu per tier/medallion: primer silver, primer gold, primer bronze-saja,
  // sekunder (venue), sekunder (event, ada kolom tanggal).
  const medal = await store.medallion();
  const urut = [...medal.entries()].sort(([a], [b]) => a.localeCompare(b));
  const cari = (lvl: string) => urut.find(([, m]) => m.level === lvl)?.[0];
  const slugs = [
    "data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan",
    cari("gold"),
    cari("bronze"),
    "venue-mice-jakarta",
    "kegiatan-mice-jakarta-2026",
  ].filter((s): s is string => !!s);

  const keluaran: Golden[] = [];
  for (const slug of slugs) {
    const d = await panggilRoute(rDetail.GET as never, `/api/sdi/${slug}?offset=0&limit=50`, { slug });
    const j = d.json;
    const nama = `dataset.${slug}`;
    if (d.status !== 200) {
      keluaran.push({ nama, endpoint: "/v1/dataset/{slug}", params: { slug }, data: { status: d.status, error: j.error ?? null } });
      continue;
    }
    keluaran.push({
      nama,
      endpoint: "/v1/dataset/{slug}",
      params: { slug },
      data: {
        slug: j.slug, title: j.title, description: j.description, sumber_data: j.sumberData, frekuensi: j.frekuensi,
        satuan: j.satuan, periode: j.periode, klasifikasi: j.klasifikasi, kontak: j.kontak, author: j.author,
        medallion: j.medallion, total_bronze: j.total,
      },
      meta: { total: j.count },
    });
    keluaran.push({ nama: `${nama}.kolom`, endpoint: "/v1/dataset/{slug}/kolom", params: { slug }, data: { items: j.columns } });
    keluaran.push({
      nama: `${nama}.baris`, endpoint: "/v1/dataset/{slug}/baris", params: { slug, page: "1", size: "50" },
      data: { items: j.rows }, meta: { page: 1, size: 50, total: j.count, has_more: (j.rows as unknown[]).length < (j.count as number) },
    });
    const f = (await panggilRoute(rFacet.GET as never, `/api/sdi/${slug}/facets`, { slug })).json;
    keluaran.push({ nama: `${nama}.facet`, endpoint: "/v1/dataset/{slug}/facet", params: { slug }, data: { items: f.facets } });

    // Satu kueri berfilter + urut: nilai kategori pertama dan kolom pertama turun.
    const facets = (f.facets as { key: string; kind: string; values?: { v: string }[] }[]) ?? [];
    const kat = facets.find((x) => x.kind === "kategori" && x.values?.length);
    // Kolom urut diambil dari skema Silver (facet memuat semua kolom Silver): kolom angka/tanggal
    // pertama, atau kolom kategori itu sendiri. Kolom katalog seperti `id` bisa tidak ada di Silver.
    const kolom1 = facets.find((x) => x.kind === "angka" || x.kind === "tanggal")?.key ?? kat?.key;
    if (kat && kolom1) {
      const qs = new URLSearchParams({ offset: "0", limit: "50", sort: `${kolom1}:desc` });
      qs.append("f", `${kat.key}:in:${kat.values![0].v}`);
      const rr = await panggilRoute(rDetail.GET as never, `/api/sdi/${slug}?${qs}`, { slug });
      const r = rr.json;
      const paramsF = { slug, page: "1", size: "50", sort: `${kolom1}:desc`, f: `${kat.key}:in:${kat.values![0].v}` };
      if (rr.status !== 200) {
        // Perilaku error route asli juga oracle (Data API harus menolak dengan cara setara).
        console.error(`  ${slug}: baris berfilter → ${rr.status} ${String(r.error)}`);
        keluaran.push({ nama: `${nama}.baris-filter`, endpoint: "/v1/dataset/{slug}/baris", params: paramsF, data: { status: rr.status, error: r.error ?? null } });
      } else {
        keluaran.push({
          nama: `${nama}.baris-filter`, endpoint: "/v1/dataset/{slug}/baris", params: paramsF,
          data: { items: r.rows }, meta: { page: 1, size: 50, total: r.count, has_more: (r.rows as unknown[]).length < (r.count as number) },
        });
      }
      const a = (await panggilRoute(rAgg.GET as never, `/api/sdi/${slug}/aggregate?x=${encodeURIComponent(kat.key)}&agg=count`, { slug })).json;
      keluaran.push({ nama: `${nama}.agregat`, endpoint: "/v1/dataset/{slug}/agregat", params: { slug, x: kat.key, agg: "count" }, data: { items: a.data } });
    }
  }
  return keluaran;
}

// ── dashboard ─────────────────────────────────────────────────────────────────

/** Pasangan label/value chart → periode/nilai (hanya mengganti nama field). */
const titik = (d: unknown) => (d as { label: string; value: number | null }[]).map((p) => ({ label: p.label, value: p.value }));
/** Label yang dibangun dari data = bagian judul kartu setelah " · " (judulnya sendiri teks UI). */
const labelDari = (judul: string) => judul.split(" · ").slice(1).join(" · ") || null;

async function dashboard(): Promise<Golden[]> {
  const D = await import("@/lib/dashboard/data");
  const p = await import("@/lib/dashboard/pdrb-ekraf");
  const keluaran: Golden[] = [];
  const g = (nama: string, endpoint: string, params: Record<string, string>, data: unknown) => keluaran.push({ nama, endpoint, params, data });

  // ringkasan — halaman server /dashboard (angka 2025/2024 memang ditulis tetap di halaman).
  const { default: Ringkasan } = await import("@/app/dashboard/page");
  await renderAsync(h((Ringkasan as unknown as () => ReactElement)));
  const ks = kpi("KpiStat");
  const iK = p.PDRB_MAKRO.periode.indexOf("2024");
  g("dashboard.ringkasan", "/v1/dashboard/ringkasan", {}, {
    wisman: { tahun: "2025", jumlah: ks[0].value === "—" ? null : ks[0].value, target: D.TARGET_WISMAN["2025"] },
    pdrb: {
      tahun: "2024", kontribusi_pct: p.PDRB_MAKRO.kontribusi[iK], target_tahun: "2025", target_pct: p.TARGET_KONTRIBUSI_RPJMD["2025"],
      adhb_ekraf_miliar: p.PDRB_MAKRO.adhbEkraf[iK], tumbuh_ekraf_pct: p.PDRB_MAKRO.tumbuhEkraf[iK], tumbuh_dki_pct: p.PDRB_MAKRO.tumbuhDki[iK],
    },
    kpi: ks,
  });

  // wisman — komponen WismanStat dengan data yang sama seperti halaman.
  const [w, los, pintuBln] = await Promise.all([D.getWisman(), D.getLamaMenginap(), D.getPintuBulanan()]);
  const { WismanStat } = await import("@/components/dashboard/WismanStat");
  const wisman = (state: Record<number, unknown> = {}) => {
    renderSinkron(h(WismanStat, { data: w, los, target: D.TARGET_WISMAN, pintuBulanan: pintuBln }), state);
    return { k: kartu(), kp: kpi(), toggle: propsElemen<{ value: string; options: { value: string }[] }>("ModeToggle") };
  };
  const awal = wisman();
  const tahunList = memoKe<string[]>(0);
  const perBulan = titik(kartuBerjudul(awal.k, "Grafik Wisman per bulan")[0].data.data);
  const combo = kartuBerjudul(awal.k, "Capaian vs Target Wisman")[0].data as { categories: string[]; bar: { values: number[] }; line: { values: (number | null)[] } };
  const tumbuh = awal.kp.find((x) => String(x.label).startsWith("Pertumbuhan"))!;
  g("dashboard.wisman.tahunan", "/v1/dashboard/wisman/tahunan", {}, {
    data_tersedia: { dari: perBulan[0]?.label ?? null, sampai: perBulan.at(-1)?.label ?? null },
    tahun: tahunList.map((tahun, i) => ({ tahun, label: combo.categories[i], jumlah: combo.bar.values[i], target: combo.line.values[i] })),
    pertumbuhan: { label: tumbuh.label, persen: tumbuh.delta ?? null, sub: tumbuh.sub },
    tahun_default: awal.toggle[0]?.value ?? null,
    kpi: awal.kp.filter((x) => /^(Capaian|Pertumbuhan)/.test(String(x.label))),
  });
  const yoy = kartuBerjudul(awal.k, "Wisman year-on-year")[0].data;
  // Deret bulanan sama untuk semua periode; `kpi` = KPI bulan terpilih (default bulan terakhir).
  const bulanan = (kp: Obj[], periode: string) => ({
    rows: perBulan.map((x) => ({ periode: x.label, jumlah: x.value })),
    yoy: { kategori: yoy.categories, seri: yoy.series },
    pertumbuhan: titik(kartuBerjudul(awal.k, "Pertumbuhan YoY per bulan")[0].data.data).map((x) => ({ periode: x.label, persen: x.value })),
    periode,
    kpi: kp.filter((x) => !/^(Capaian|Pertumbuhan)/.test(String(x.label))),
  });
  g("dashboard.wisman.bulanan", "/v1/dashboard/wisman/bulanan", {}, bulanan(awal.kp, perBulan.at(-1)?.label ?? ""));
  // Rata-rata lama menginap lintas kelas (grafik RTL di halaman wisman).
  const rtl = (kartuBerjudul(awal.k, "RTL Bintang")[0].data.series as { name: string; data: unknown }[]);
  g("dashboard.lama-menginap.rata-rata", "/v1/dashboard/lama-menginap/rata-rata", {}, Object.fromEntries(
    rtl.map((s) => [s.name.toLowerCase(), titik(s.data).map((x) => ({ periode: x.label, nilai: x.value }))]),
  ));

  // kebangsaan + pintu masuk per tahun (state 0) dan per bulan (state 1).
  const periodeList = perBulan.map((x) => x.label);
  for (const tahun of tahunList) {
    const r = wisman({ 0: tahun });
    const keb = kartuBerjudul(r.k, "Persentase Wisman berdasarkan Kebangsaan")[0];
    const pin = kartuBerjudul(r.k, "Persentase Wisman berdasarkan Pintu Masuk")[0];
    const params: Record<string, string> = tahun === awal.toggle[0]?.value ? {} : { tahun };
    g(`dashboard.wisman.kebangsaan.tahun-${tahun}`, "/v1/dashboard/wisman/kebangsaan", params, { periode: tahun, label: labelDari(keb.judul), items: titik(keb.data.data) });
    g(`dashboard.wisman.pintu-masuk.tahun-${tahun}`, "/v1/dashboard/wisman/pintu-masuk", { tahun }, {
      sumber: "sdi_semester", label: labelDari(pin.judul), semester: pin.sub?.split("semester ")[1] ?? null, items: pin.data.data ? titik(pin.data.data) : [],
    });
  }
  for (const periode of periodeList) {
    const r = wisman({ 1: periode });
    const keb = kartuBerjudul(r.k, "Persentase Wisman berdasarkan Kebangsaan")[1];
    const pin = kartuBerjudul(r.k, "Persentase Wisman berdasarkan Pintu Masuk")[1];
    const bps = pin.sub === "data bulanan BPS DKI Jakarta";
    g(`dashboard.wisman.kebangsaan.periode-${periode}`, "/v1/dashboard/wisman/kebangsaan", { periode }, { periode, label: labelDari(keb.judul), items: titik(keb.data.data) });
    g(`dashboard.wisman.pintu-masuk.periode-${periode}`, "/v1/dashboard/wisman/pintu-masuk", { periode }, {
      sumber: bps ? "bps_bulanan" : "sdi_semester", label: labelDari(pin.judul), semester: null, items: pin.data.data ? titik(pin.data.data) : [],
    });
    g(`dashboard.wisman.bulanan.periode-${periode}`, "/v1/dashboard/wisman/bulanan", { periode }, bulanan(r.kp, periode));
  }

  // lama menginap per kelas (LosByClass) untuk tiap tamu dan periode yang ditawarkan select-nya.
  const { LosByClass } = await import("@/components/dashboard/LosByClass");
  for (const tamu of ["Wisman", "Wisnus"] as const) {
    const html = renderSinkron(h(LosByClass, { los, guest: tamu }));
    const periodeOpsi = [...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
    for (const periode of periodeOpsi) {
      const hh = renderSinkron(h(LosByClass, { los, guest: tamu }), { 0: periode });
      const k = kartu()[0];
      g(`dashboard.lama-menginap.per-kelas.${tamu.toLowerCase()}.${periode}`, "/v1/dashboard/lama-menginap/per-kelas", { tamu: tamu.toLowerCase(), periode }, {
        periode_list: periodeOpsi, periode, label: labelDari(k.judul), kategori: k.data.categories, seri: k.data.series, tabel: tabelHtml(hh)[0] ?? null,
      });
    }
  }
  const { WisnusLos } = await import("@/components/dashboard/WisnusLos");
  renderSinkron(h(WisnusLos, { los }));
  g("dashboard.lama-menginap.seri.wisnus", "/v1/dashboard/lama-menginap/seri", { tamu: "wisnus" }, { seri: kartuBerjudul(kartu(), "Lama menginap wisnus per bulan")[0].data.series });

  // wisnus — state WisnusStat: 0 kota, 1 kota YoY, 2 tahun.
  const wisnusRows = await D.getWisnusKotaTujuan();
  const { WisnusStat } = await import("@/components/dashboard/WisnusStat");
  const wisnus = (state: Record<number, unknown> = {}) => {
    const html = renderSinkron(h(WisnusStat, { rows: wisnusRows }), state);
    return { html, k: kartu(), kp: kpi(), toggle: propsElemen<{ value: string; options: { value: string }[] }>("ModeToggle") };
  };
  const wn = wisnus();
  const kotaOpsi = [...new Set([...wn.html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]))];
  const kotaList = kotaOpsi.filter((k) => k !== "Semua kota" && k !== "Seluruh Jakarta");
  const tahunWisnus = wn.toggle[0]?.options.map((o) => o.value) ?? [];
  const hilang = simpulTeks(wn.html).find((t) => /^Tahun .* belum tersedia\.$/.test(t));
  g("dashboard.wisnus.meta", "/v1/dashboard/wisnus/meta", {}, {
    kota: kotaList, tahun: tahunWisnus, tahun_hilang_teks: hilang ?? null, tahun_default: wn.toggle[0]?.value ?? null,
  });
  for (const kota of ["Semua kota", ...kotaList]) {
    const r = kota === "Semua kota" ? wn : wisnus({ 0: kota });
    g(`dashboard.wisnus.tahunan.${slugAman(kota)}`, "/v1/dashboard/wisnus/tahunan", { kota }, {
      tahun: titik(kartuBerjudul(r.k, "Capaian tahunan")[0].data.data), kpi: r.kp,
    });
    g(`dashboard.wisnus.bulanan.${slugAman(kota)}`, "/v1/dashboard/wisnus/bulanan", { kota }, { seri: kartuBerjudul(r.k, "Tren bulanan")[0].data.series });
  }
  for (const kota of ["Seluruh Jakarta", ...kotaList]) {
    const r = kota === "Seluruh Jakarta" ? wn : wisnus({ 1: kota });
    const y = kartuBerjudul(r.k, "Wisnus year-on-year")[0].data;
    g(`dashboard.wisnus.yoy.${slugAman(kota)}`, "/v1/dashboard/wisnus/yoy", { kota }, {
      kategori: y.categories, seri: y.series,
      pertumbuhan: titik(kartuBerjudul(r.k, "Pertumbuhan YoY per bulan")[0].data.data).map((x) => ({ periode: x.label, persen: x.value })),
    });
  }
  for (const tahun of tahunWisnus) {
    const r = wisnus({ 2: tahun });
    const kk = kartuBerjudul(r.k, "Persentase per kota tujuan")[0];
    g(`dashboard.wisnus.per-kota.${tahun}`, "/v1/dashboard/wisnus/per-kota", { tahun }, { label: labelDari(kk.judul), items: titik(kk.data.data) });
  }

  // tenaga kerja — halaman server (dki + sertifikasi) dan TkSubsektor (per tahun).
  const { default: Tk } = await import("@/app/dashboard/tenaga-kerja/page");
  await renderAsync(h((Tk as unknown as () => ReactElement)));
  const tkKartu = kartu();
  const tkKpi = kpi();
  const comboTk = kartuBerjudul(tkKartu, "Tenaga kerja ekraf DKI")[0].data as { categories: string[]; bar: { values: number[] }; line: { values: number[] } };
  const gender = kartuBerjudul(tkKartu, "Menurut jenis kelamin")[0].data as { series: { name: string; data: { value: number }[] }[] };
  g("dashboard.tenaga-kerja.dki", "/v1/dashboard/tenaga-kerja/dki", {}, {
    rows: comboTk.categories.map((tahun, i) => ({
      tahun, total: comboTk.bar.values[i], porsi_pct: comboTk.line.values[i], laki: gender.series[0].data[i].value, perempuan: gender.series[1].data[i].value,
    })),
    kpi: tkKpi,
  });
  const sertTahun = kartuBerjudul(tkKartu, "Peserta sertifikasi per tahun")[0].data;
  const sertBidang = kartuBerjudul(tkKartu, "Per bidang sertifikasi")[0].data;
  g("dashboard.tenaga-kerja.sertifikasi", "/v1/dashboard/tenaga-kerja/sertifikasi", {}, {
    per_tahun: titik(sertTahun.data), bidang: sertBidang.categories, seri: sertBidang.series,
  });
  const tk = await D.getTenagaKerjaEkraf();
  const { TkSubsektor } = await import("@/components/dashboard/TkSubsektor");
  renderSinkron(h(TkSubsektor, { rows: tk.subsektorNasional }));
  const tkTahun = propsElemen<{ value: string; options: { value: string }[] }>("ModeToggle")[0];
  for (const tahun of tkTahun?.options.map((o) => o.value) ?? []) {
    renderSinkron(h(TkSubsektor, { rows: tk.subsektorNasional }), { 0: tahun });
    const k = kartu()[0];
    g(`dashboard.tenaga-kerja.subsektor.${tahun}`, "/v1/dashboard/tenaga-kerja/subsektor", { tahun }, {
      tahun_list: tkTahun.options.map((o) => o.value), tahun, items: titik(k.data.data),
    });
  }
  return keluaran;
}

// ── indikator + pariwisata ────────────────────────────────────────────────────

/** Nama komponen chart Next.js → `type` blok kontrak (C §4.3). Hanya penamaan. */
const TIPE_BLOK: Record<string, string> = {
  LineTrend: "line", BarBreakdown: "bar", RankedList: "ranked", Donut: "donut", PointMap: "map_points", GroupedLines: "grouped_lines",
};

async function indikator(): Promise<Golden[]> {
  const { INDICATORS } = await import("@/lib/gci/indicators");
  const { computeReadiness } = await import("@/lib/gci/readiness");
  const { FrameworkView } = await import("@/components/FrameworkView");
  const reg = await import("@/components/indicators/registry");
  const store = await import("@/lib/ch/store");
  const keluaran: Golden[] = [];

  const semua = await computeReadiness();
  for (const framework of ["GCI", "GPCI"] as const) {
    const rows = semua.filter((r) => r.framework === framework);
    const html = renderSinkron(h(FrameworkView, { title: "", subtitle: "", rows, showTrend: false }));
    const ringkas = propsElemen<{ label: string; value: string }>("Card").map((c) => ({ label: c.label, value: c.value }));
    // Urutan baris tabel = urutan tautan indikator di markup.
    const kode = [...new Set(tautan(html).map((a) => a.href).filter((x) => /^\/(gci|gpci)\/[A-Z]/.test(x)).map((x) => x.split("/")[2]))];
    const byCode = new Map(rows.map((r) => [r.code, r]));
    keluaran.push({
      nama: `indikator.${framework}`,
      endpoint: "/v1/indikator",
      params: { framework },
      data: {
        framework,
        summary: ringkas,
        rows: kode.filter((c) => byCode.has(c)).map((c) => {
          const r = byCode.get(c)!;
          return {
            no: nul(r.officialNo), code: r.code, framework: r.framework, dimension: r.dimension, group: nul(r.group), name: r.name,
            status: r.status, data_available: r.dataAvailable, owner: nul(r.owner), note: nul(r.note),
            datasets: r.datasets, latest: r.latest,
          };
        }),
        gaps: rows.filter((r) => r.status !== "ready").map((r) => r.code),
      },
    });
  }

  for (const ind of INDICATORS) {
    const View = (reg.INDICATOR_VIEWS as Record<string, (() => ReactElement) | undefined>)[ind.code];
    const html = await renderAsync(View ? h(View) : h(reg.IndicatorFallback, { code: ind.code }));
    const shell = propsElemen<{ code: string; source?: string; sources?: { slug: string; title: string }[] }>("IndicatorShell")[0];
    const sumber = shell?.sources ?? [];
    const tier = sumber.length ? await store.tiers(sumber.map((s) => s.slug)) : new Map<string, string>();
    // Blok setengah lebar = Block yang menjadi anak langsung wadah grid dua kolom.
    const setengah = new Set(
      propsElemen<Obj>("grid2").flatMap((g) =>
        (Array.isArray(g.children) ? g.children.flat(Infinity) : [g.children])
          .map((c) => (c as El | null)?.props?.title)
          .filter((t): t is string => typeof t === "string"),
      ),
    );
    keluaran.push({
      nama: `indikator.${ind.code}`,
      endpoint: "/v1/indikator/{code}",
      params: { code: ind.code },
      data: {
        code: ind.code,
        sources: sumber.map((s) => ({ slug: s.slug, title: s.title, tier: tier.get(s.slug) ?? "primer" })),
        source_text: nul(shell?.source),
        kpis: kpi("KpiStat"),
        blocks: (() => {
          // Blok tanpa komponen chart = tabel event (host <table>), diambil berurutan dari markup.
          const tabel = tabelHtml(html);
          let iTabel = 0;
          return kartu("Block").map((b) => {
            const tipe = b.komponen ? TIPE_BLOK[b.komponen] ?? b.komponen : "table_events";
            const d = b.data;
            const data = tipe === "grouped_lines" ? { series: d.series } : tipe === "map_points" ? d.points : tipe === "table_events" ? tabel[iTabel++] ?? null : d.data;
            return { type: tipe, title: b.judul, layout: setengah.has(b.judul) ? "half" : "full", data };
          });
        })(),
        // Indikator tanpa view (belum tersedia): teks halaman fallback apa adanya.
        teks_fallback: View ? null : simpulTeks(html),
      },
      meta: { dataset_terpilih: sumber.map((s) => s.slug) },
    });
  }
  return keluaran;
}

async function pariwisata(): Promise<Golden[]> {
  const keluaran: Golden[] = [];
  const halaman = async (nama: string, endpoint: string, params: Record<string, string>, el: ReactElement) => {
    const html = await renderAsync(el);
    const shell = propsElemen<Obj>("PariwisataShell")[0] ?? {};
    const lain: Obj = {};
    for (const n of ["WismanDashboard", "VenueMapClient", "TahunFilter"]) {
      const p = propsElemen<Obj>(n)[0];
      if (p) lain[n] = Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v !== "function"));
    }
    keluaran.push({
      nama, endpoint, params,
      data: {
        shell: Object.fromEntries(Object.entries(shell).filter(([k, v]) => k !== "children" && typeof v !== "function" && typeof v !== "object")),
        kpis: kpi(),
        kartu: kartu(),
        raw: propsElemen<Obj>("RawDataDisclosure").map((r) => ({ slug: r.slug, title: r.title, count: r.count })),
        komponen: lain,
        tabel: tabelHtml(html),
      },
    });
  };
  const { default: Wisman } = await import("@/app/gci/pariwisata/wisatawan-internasional/page");
  await halaman("pariwisata.wisatawan-internasional", "/v1/pariwisata/wisatawan-internasional", {}, h(Wisman as unknown as () => ReactElement));
  const { default: Michelin } = await import("@/app/gci/pariwisata/kuliner-michelin/page");
  await halaman("pariwisata.kuliner-michelin", "/v1/pariwisata/kuliner-michelin", {}, h(Michelin as unknown as () => ReactElement));
  const { default: Seni } = await import("@/app/gci/pariwisata/seni-pertunjukan/page");
  const seni = (tahun?: string) => h(Seni as unknown as (p: Obj) => ReactElement, { searchParams: Promise.resolve(tahun ? { tahun } : {}) });
  await halaman("pariwisata.seni-pertunjukan", "/v1/pariwisata/seni-pertunjukan", {}, seni());
  const opsi = ((keluaran.at(-1)!.data as { komponen: { TahunFilter?: { years?: string[] } } }).komponen.TahunFilter?.years) ?? [];
  for (const tahun of opsi) {
    await halaman(`pariwisata.seni-pertunjukan.tahun-${tahun}`, "/v1/pariwisata/seni-pertunjukan", { tahun }, seni(tahun));
  }
  return keluaran;
}

// ── spasial ───────────────────────────────────────────────────────────────────

async function spasial(): Promise<Golden[]> {
  const rSp = await import("@/app/api/spatial/route");
  const sp = await import("@/lib/spatial");
  const { GmtiMapView } = await import("@/components/GmtiMapView");
  const lake = (await panggilRoute(rSp.GET as never, "/api/spatial")).json as { points: Obj[]; inventory: Obj[]; failed: string[]; complete: boolean };
  // Titik ibadah dipetakan persis seperti callback fetch GmtiMapView (pemindahan field).
  const berkas = JSON.parse(fs.readFileSync(path.resolve("public/gmti-ibadah.json"), "utf8")) as {
    rows: { id: string; name: string; kota: string; address: string; lat?: number; lon?: number }[];
  };
  const ibadah = berkas.rows.map((r) => ({ id: `simas-${r.id}`, name: r.name, category: "ibadah", city: sp.spatialCity(r.kota || ""), address: r.address || "", lat: r.lat, lng: r.lon, href: "/gmti" }));
  const geo = JSON.parse(fs.readFileSync(path.resolve("public/geo/dki-jakarta.geojson"), "utf8"));
  // useState GmtiMapView: 5 extraPoints (lake + ibadah, urutan seperti Promise.all), 11 geo.
  renderSinkron(h(GmtiMapView), { 5: [...lake.points, ...ibadah], 11: geo });
  const titikGabung = memoKe<Obj[]>(0);
  const kota = memoKe<string[]>(1);
  const kepadatan = memoKe<Map<string, { total: number; byCat: Map<string, number> } | Obj>>(3);
  const kepadatanObj = Object.fromEntries([...kepadatan.entries()].map(([k, v]) => [k, v instanceof Map ? Object.fromEntries(v) : JSON.parse(JSON.stringify(v, (_k, x) => (x instanceof Map ? Object.fromEntries(x) : x)))]));
  const hitung: Record<string, number> = {};
  for (const t of titikGabung) hitung[String(t.category)] = (hitung[String(t.category)] ?? 0) + 1;
  return [{
    nama: "spasial",
    endpoint: "/v1/spasial",
    params: {},
    data: {
      points: titikGabung.map((p) => ({
        id: p.id, name: p.name, category: p.category, city: p.city, lat: p.lat, lng: p.lng, href: p.href,
        kind: nul(p.kind), source: nul(p.source),
      })),
      cities: kota,
      kepadatan_berkoordinat: kepadatanObj,
      inventory: lake.inventory,
      failed: lake.failed,
      complete: lake.complete,
      catatan: "Hitungan ibadah tanpa koordinat per kecamatan (density_extra) dihitung di callback fetch GmtiMapView, bukan di memo; tidak direkam di sini dan diuji di lapis 2.",
    },
    meta: { total: titikGabung.length, per_kategori: hitung },
  }];
}

/** Semua golden live, urutan tetap. */
export async function goldenLive(): Promise<Golden[]> {
  const kelompok = [katalog, dataset, dashboard, indikator, pariwisata, spasial];
  const semua: Golden[] = [];
  for (const f of kelompok) {
    const t = Date.now();
    const hasil = await f();
    console.error(`  live ${f.name}: ${hasil.length} golden, ${Date.now() - t} ms`);
    semua.push(...hasil);
  }
  return semua;
}
