/**
 * Golden STATIS: endpoint Data API yang sumbernya `lake.bronze_file.*` (data statis app
 * yang diekspor ke Bronze). Oracle-nya adalah modul `lib/*` dan komponen client asli
 * platform-v2 yang sedang tayang.
 *
 * Aturan (plan 01): logika TIDAK ditulis ulang di sini. Angka diambil dari fungsi/konstanta
 * `lib/*`, dari nilai `useMemo` komponen asli yang terekam (`memoDengan`/`memoKe`), atau dari
 * opsi chart yang terekam (`rekamanChart`). Setiap fungsi `peta*` di bawah HANYA memindah
 * nilai ke bentuk respons endpoint (mengganti nama field, `undefined` → `null`); ia tidak
 * menghitung, menyaring, atau mengurutkan.
 */
import { createElement as h } from "react";
import fs from "node:fs";
import path from "node:path";
import { memoDengan, memoKe, rekamanChart, type EChartsOption } from "./alias";
import { renderSinkron, simpulTeks, tautan } from "./render";
import type { Golden } from "./tulis";

const nul = <T>(v: T | undefined): T | null => (v === undefined ? null : v);

/** Pasangan label–nilai dari seri chart ke-`s` (kategori dari sumbu kategori). Hanya memindah. */
function pasangan(o: EChartsOption, s = 0): { label: string; value: number | null }[] {
  const sumbu = (x: EChartsOption["xAxis"]) => (Array.isArray(x) ? x[0] : x);
  const kategori = sumbu(o.xAxis)?.data ?? sumbu(o.yAxis)?.data ?? [];
  const data = o.series?.[s]?.data ?? [];
  return kategori.map((label, i) => {
    const d = data[i] as number | null | { value: number | null };
    return { label, value: d !== null && typeof d === "object" ? d.value : (d ?? null) };
  });
}

/** Irisan pie (nama–nilai) dari seri pertama. Hanya memindah. */
function irisan(o: EChartsOption): { label: string; value: number }[] {
  return (o.series?.[0]?.data ?? []).map((d) => {
    const x = d as { name: string; value: number };
    return { label: x.name, value: x.value };
  });
}

// ── atlas ─────────────────────────────────────────────────────────────────────

async function atlasRestoranGci(): Promise<Golden[]> {
  const gci = await import("@/lib/gci");
  // Pemeta: memindah field GciRestaurant ke bentuk respons; maps_url/address_display dari lib.
  const items = gci.GCI_RESTAURANTS.map((r) => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    area: r.area,
    address: nul(r.address),
    address_display: gci.gciAddress(r),
    city: r.city,
    hotel: nul(r.hotel),
    tier: r.tier,
    source: r.source,
    lat: nul(r.lat),
    lng: nul(r.lng),
    rating: nul(r.rating),
    review_count: nul(r.reviewCount),
    rating_source: nul(r.ratingSource),
    place_id: nul(r.placeId),
    price_level: nul(r.priceLevel),
    price_source: nul(r.priceSource),
    needs_verify: r.needsVerify ?? false,
    maps_url: gci.gciMapsUrl(r),
  }));
  const s = gci.gciStats();
  return [{
    nama: "atlas.restoran-gci",
    endpoint: "/v1/atlas/restoran-gci",
    params: {},
    data: {
      items,
      stats: { total: s.total, rated: s.rated, hotel: s.hotel, cafe: s.cafe, restoran: s.restoran },
      curated: gci.GCI_CURATED_COUNT,
      tiers: gci.TIER_ORDER,
      cities: gci.CITY_ORDER,
    },
    meta: { total: items.length },
  }];
}

async function atlasDirektoriRestoran(): Promise<Golden[]> {
  const lib = await import("@/lib/restaurants");
  const { Dashboard } = await import("@/components/Dashboard");
  renderSinkron(h(Dashboard, { restaurants: lib.RESTAURANTS }));
  // Memo komponen asli: 1 = opsi kuliner, 2 = opsi kota (keduanya diawali "All"), stats.
  const kuliner = memoKe<string[]>(1).slice(1);
  const kota = memoKe<string[]>(2).slice(1);
  const st = memoDengan<{ total: number; cuisines: number; ratedCount: number; avgRating: number }>(
    "cuisines", "ratedCount", "avgRating",
  );
  // Pemeta: memindah field Restaurant; maps_url/embed_url dari lib.
  const items = lib.RESTAURANTS.map((r) => ({
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    category: r.category,
    area: r.area,
    city: r.city,
    address: nul(r.address),
    price_range: nul(r.priceRange),
    price_note: nul(r.priceNote),
    rating: nul(r.rating),
    review_count: nul(r.reviewCount),
    rating_source: nul(r.ratingSource),
    highlights: r.highlights,
    description: nul(r.description),
    sources: r.sources,
    source: r.source,
    lat: nul(r.lat),
    lng: nul(r.lng),
    osm_id: nul(r.osmId),
    phone: nul(r.phone),
    website: nul(r.website),
    maps_url: lib.googleMapsUrl(r),
    embed_url: lib.mapsEmbedUrl(r),
  }));
  return [{
    nama: "atlas.direktori-restoran",
    endpoint: "/v1/atlas/direktori-restoran",
    params: {},
    data: {
      items,
      stats: { total: st.total, cuisines: st.cuisines, rated: st.ratedCount, avg_rating: st.avgRating },
      cities: kota,
      cuisines: kuliner,
    },
    meta: { total: items.length },
  }];
}

async function atlasPertunjukan(): Promise<Golden[]> {
  const ev = await import("@/lib/events");
  const { EventsView } = await import("@/components/EventsView");
  type E = (typeof ev.GCI_EVENTS)[number];
  // Pemeta: memindah field GciEvent; date_sort dan visitors_needs_verify dari lib.
  const peta = (e: E) => ({
    id: e.id,
    organizer: e.organizer,
    name: e.name,
    date: e.date,
    date_sort: ev.eventDateSort(e.date),
    venue: e.venue,
    type: e.type,
    visitors: e.visitors,
    visitors_needs_verify: ev.eventNeedsVerify(e),
    note: e.note,
    category: e.category,
    source: nul(e.source),
  });
  const keluaran: Golden[] = [];
  // useState EventsView: 0 lang, 1 kategori, 2 tahun. Tahun "Semua" = tanpa parameter.
  for (const tahun of ["", "2025", "2026"]) {
    renderSinkron(h(EventsView), tahun ? { 2: tahun } : {});
    // Memo `filtered` komponen asli = daftar baris pada tahun itu (kategori Semua, tanpa cari).
    const baris = memoKe<E[]>(1);
    const s = ev.eventStats(tahun || undefined);
    keluaran.push({
      nama: tahun ? `atlas.pertunjukan.tahun-${tahun}` : "atlas.pertunjukan",
      endpoint: "/v1/atlas/pertunjukan",
      params: tahun ? { tahun } : {},
      data: {
        items: baris.map(peta),
        stats: { total: s.total, konser: s.konser, festival: s.festival, budaya: s.budaya },
        categories: ev.EVENT_CATEGORIES,
      },
      meta: { total: baris.length },
    });
  }
  return keluaran;
}

async function atlasGolf(): Promise<Golden[]> {
  const golf = await import("@/lib/golf");
  const { GolfView } = await import("@/components/GolfView");
  renderSinkron(h(GolfView));
  const st = memoDengan<{ total: number; courses: number; ranges: number; totalHoles: number }>("courses", "totalHoles");
  // Pemeta: memindah field GolfCourse; maps_url dari lib.
  const items = golf.GOLF_COURSES.map((g) => ({
    id: g.id,
    name: g.name,
    kind: g.kind,
    holes: nul(g.holes),
    par: nul(g.par),
    designer: nul(g.designer),
    established: nul(g.established),
    membership: nul(g.membership),
    city: g.city,
    area: g.area,
    address: nul(g.address),
    lat: g.lat,
    lng: g.lng,
    website: nul(g.website),
    description: nul(g.description),
    highlights: g.highlights,
    sources: g.sources,
    maps_url: golf.golfMapsUrl(g),
  }));
  return [{
    nama: "atlas.golf",
    endpoint: "/v1/atlas/golf",
    params: {},
    data: { items, stats: { total: st.total, courses: st.courses, ranges: st.ranges, total_holes: st.totalHoles } },
    meta: { total: items.length },
  }];
}

async function atlasSuvenir(): Promise<Golden[]> {
  const sv = await import("@/lib/souvenir");
  const { SouvenirView } = await import("@/components/SouvenirView");
  renderSinkron(h(SouvenirView));
  // Memo komponen asli: 0 = opsi wilayah, 1 = opsi produk (keduanya diawali "All"), stats.
  const kota = memoKe<string[]>(0).slice(1);
  const produk = memoKe<string[]>(1).slice(1);
  const st = memoDengan<{ total: number; ya: number; tidak: number; sebagian: number; belumPasti: number; avg: number; geo: number }>(
    "ya", "belumPasti", "geo",
  );
  // Pemeta: memindah field SouvenirShop; maps_url/embed_url dari lib.
  const items = sv.SOUVENIR_SHOPS.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    relevance: s.relevance,
    product: nul(s.product),
    address: nul(s.address),
    city: nul(s.city),
    district: nul(s.district),
    lat: nul(s.lat),
    lng: nul(s.lng),
    coord_source: nul(s.coordSource),
    phone: nul(s.phone),
    rating: nul(s.rating),
    reviews: nul(s.reviews),
    status: nul(s.status),
    note: nul(s.note),
    url: nul(s.url),
    maps_url: sv.souvenirMapsUrl(s),
    embed_url: sv.souvenirEmbedUrl(s),
  }));
  return [{
    nama: "atlas.suvenir",
    endpoint: "/v1/atlas/suvenir",
    params: {},
    data: {
      items,
      stats: { total: st.total, ya: st.ya, sebagian: st.sebagian, tidak: st.tidak, belum_pasti: st.belumPasti, avg_rating: st.avg, geo: st.geo },
      products: produk,
      cities: kota,
    },
    meta: { total: items.length },
  }];
}

async function atlasHotel(): Promise<Golden[]> {
  const ht = await import("@/lib/hotel");
  const { HotelView } = await import("@/components/HotelView");
  renderSinkron(h(HotelView));
  type Chart = { periods: string[]; series: { name: string; data: (number | null)[] }[] };
  // Memo komponen asli: 0 opsi wilayah, 1 opsi golongan, 2 tren TPK, 3 tren LoS, KPI, daftar urut kamar.
  const wilayah = memoKe<string[]>(0).slice(1);
  const golongan = memoKe<string[]>(1).slice(1);
  const tpk = memoKe<Chart>(2);
  const los = memoKe<Chart>(3);
  const kpi = memoDengan<{ avgOcc: number; occPeriod: string; avgLos: number; losPeriod: string }>("avgOcc", "avgLos");
  const registri = memoKe<(typeof ht.HOTEL_REGISTRY)[number][]>(5);
  return [{
    nama: "atlas.hotel",
    endpoint: "/v1/atlas/hotel",
    params: {},
    data: {
      built: ht.HOTEL_META.built,
      registry_period: ht.HOTEL_META.registryPeriod,
      sources: ht.HOTEL_META.sources,
      kpi: {
        hotels: ht.HOTEL_META.totals.hotels,
        rooms: ht.HOTEL_META.totals.rooms,
        occupancy_latest: kpi.avgOcc,
        occupancy_period: kpi.occPeriod,
        los_latest: kpi.avgLos,
        los_period: kpi.losPeriod,
      },
      tpk_chart: tpk,
      los_chart: los,
      registry: registri,
      filters: { wilayah, golongan },
    },
    meta: { total: registri.length },
  }];
}

// ── gmti ──────────────────────────────────────────────────────────────────────

async function gmti(): Promise<Golden[]> {
  const data = await import("@/lib/gmti-data");
  const g = await import("@/lib/gmti");
  const { GmtiView } = await import("@/components/GmtiView");
  const m = data.GMTI_META;
  type Place = (typeof data.GMTI_PLACES)[number];

  renderSinkron(h(GmtiView));
  const award = memoDengan<(typeof data.GMTI_CAPAIAN)[number]>("nama", "pemberi");
  const ringkasan: Golden = {
    nama: "gmti.ringkasan",
    endpoint: "/v1/gmti/ringkasan",
    params: {},
    data: {
      meta: {
        source: m.source,
        source_url: m.sourceUrl,
        fetched_at: m.fetchedAt,
        ibadah_total: m.ibadahTotal,
        masjid: m.masjid,
        mushalla: m.mushalla,
        ibadah_non_signature: m.ibadahNonSignature,
        ibadah_signature: m.ibadahSignature,
        ibadah_berkoordinat: m.ibadahBerkoordinat,
        halal_total: m.halalTotal,
        halal_berkoordinat: m.halalBerkoordinat,
        kecamatan: m.kecamatan,
        kecamatan_tanpa_poligon: m.kecamatanTanpaPoligon,
        tanpa_kecamatan: m.tanpaKecamatan,
      },
      pillars: g.PILLARS.map((p) => ({ id: p, label: g.PILLAR_LABEL[p], desc: g.PILLAR_DESC[p], color: g.PILLAR_COLOR[p] })),
      kecamatan: data.GMTI_AGG.map((a) => ({ kecamatan: a.kecamatan, kota: a.kota, geo_key: a.geoKey, masjid: a.masjid, mushalla: a.mushalla, total: a.total })),
      tipologi: data.GMTI_TIPOLOGI.map((t) => ({ tipologi: t.tipologi, jenis: t.jenis, count: t.count })),
      capaian: data.GMTI_CAPAIAN.map((c) => ({ nama: c.nama, pemberi: nul(c.pemberi), tahun: nul(c.tahun), tingkat: nul(c.tingkat), deskripsi: nul(c.deskripsi) })),
      award: { nama: award.nama, pemberi: nul(award.pemberi), tahun: nul(award.tahun), tingkat: nul(award.tingkat), deskripsi: nul(award.deskripsi) },
    },
  };

  // Daftar ibadah sama dengan yang di-fetch GmtiView (public/gmti-ibadah.json). Pemeta di
  // bawah memindah field persis seperti callback `loadIbadah` komponen; tidak menghitung.
  const berkas = JSON.parse(fs.readFileSync(path.resolve("public/gmti-ibadah.json"), "utf8")) as {
    rows: { id: number; name: string; tipologi: string; address?: string; kota?: string; kecamatan?: string; lat?: number; lon?: number }[];
  };
  const ibadah: Place[] = berkas.rows.map((r) => ({
    id: `simas-${r.id}`, name: r.name, pillar: "ibadah" as const, kind: r.tipologi, dataset: "SIMAS Kemenag",
    address: r.address, city: r.kota, district: r.kecamatan, lat: r.lat, lon: r.lon,
  }));
  // Pemeta: memindah field GmtiPlace; maps_url dari lib.
  const peta = (p: Place) => ({
    id: p.id, name: p.name, pillar: p.pillar, kind: p.kind, dataset: p.dataset, href: nul(p.href),
    address: nul(p.address), city: nul(p.city), district: nul(p.district), lat: nul(p.lat), lon: nul(p.lon),
    cert: nul(p.cert), note: nul(p.note), maps_url: g.gmtiMapsUrl(p),
  });

  const tempat: Golden[] = [];
  // useState GmtiView: 0 tab, …, 6 ibadah (diisi seolah fetch sudah selesai).
  for (const pilar of ["semua", ...g.PILLARS] as const) {
    renderSinkron(h(GmtiView), { 0: pilar, 6: ibadah });
    // Memo komponen asli: 1 pool tab, 2 opsi kota, 3 opsi jenis (diawali "All").
    const pool = memoKe<Place[]>(1);
    tempat.push({
      nama: `gmti.tempat.${pilar}`,
      endpoint: "/v1/gmti/tempat",
      params: pilar === "semua" ? {} : { pilar },
      data: {
        items_halaman_1: pool.slice(0, 200).map(peta),
        ids: pool.map((p) => p.id),
        facets: { kota: memoKe<string[]>(2).slice(1), jenis: memoKe<string[]>(3).slice(1) },
      },
      meta: { total: pool.length, page: 1, size: 200 },
    });
  }

  // Filter server `/v1/gmti/tempat` (plan 05) harus sama dengan filter klien: memo `filtered` komponen
  // asli dengan state cari (1), kota (2), jenis (3); halaman 1–3 = potongan 200 seperti tombol "muat lagi".
  const filter: { pilar: string; q?: string; kota?: string; jenis?: string }[] = [
    { pilar: "semua", kota: "Kota Administrasi Jakarta Timur" },
    { pilar: "ibadah", q: "  Al " },
    { pilar: "semua", jenis: "Mushalla Perumahan", q: "jl" },
    { pilar: "makan", q: "SUSHI" },
  ];
  filter.forEach((f, i) => {
    renderSinkron(h(GmtiView), { 0: f.pilar, 1: f.q ?? "", 2: f.kota ?? "All", 3: f.jenis ?? "All", 6: ibadah });
    const hasil = memoKe<Place[]>(4);
    const { pilar, ...lain } = f;
    tempat.push({
      nama: `gmti.tempat.filter-${i + 1}`,
      endpoint: "/v1/gmti/tempat",
      params: pilar === "semua" ? lain : f,
      data: {
        items_halaman_1: hasil.slice(0, 200).map(peta),
        items_halaman_2: hasil.slice(200, 400).map(peta),
        items_halaman_3: hasil.slice(400, 600).map(peta),
        facets: { kota: memoKe<string[]>(2).slice(1), jenis: memoKe<string[]>(3).slice(1) },
      },
      meta: { total: hasil.length, page: 1, size: 200 },
    });
  });
  return [ringkasan, ...tempat];
}

// ── dashboard pdrb-ekraf (konstanta app) ──────────────────────────────────────

async function pdrbEkraf(): Promise<Golden[]> {
  const p = await import("@/lib/dashboard/pdrb-ekraf");
  const { PdrbEkrafStat } = await import("@/components/dashboard/PdrbEkrafStat");
  const M = p.PDRB_MAKRO;
  renderSinkron(h(PdrbEkrafStat));
  const c = rekamanChart();
  // Chart 1 (ADHB) memuat label periode yang ditampilkan, sejajar dengan PDRB_MAKRO.periode.
  const label = pasangan(c[1]).map((x) => x.label);
  const kontribusi = pasangan(c[0], 0);
  const target = pasangan(c[0], 1);
  const makro: Golden = {
    nama: "dashboard.pdrb-ekraf.makro",
    endpoint: "/v1/dashboard/pdrb-ekraf/makro",
    params: {},
    data: {
      sumber: p.PDRB_SUMBER,
      rows: M.periode.map((periode, i) => ({
        periode,
        label: label[i],
        adhb_ekraf: M.adhbEkraf[i],
        adhb_dki: M.adhbDki[i],
        kontribusi_pct: M.kontribusi[i],
        adhk_ekraf: M.adhkEkraf[i],
        tumbuh_ekraf_pct: M.tumbuhEkraf[i],
        tumbuh_non_ekraf_pct: M.tumbuhNonEkraf[i],
        tumbuh_dki_pct: M.tumbuhDki[i],
      })),
      kontribusi_vs_target: kontribusi.map((k, i) => ({ label: k.label, capaian: k.value, target: target[i].value })),
      target_kontribusi: Object.entries(p.TARGET_KONTRIBUSI_RPJMD).map(([tahun, target_pct]) => ({ tahun, target_pct })),
    },
  };
  const labelPeriode = Object.fromEntries(M.periode.map((x, i) => [x, label[i]]));
  const keluaran: Golden[] = [makro];
  // useState PdrbEkrafStat: 0 periode sebaran, 1 periode pertumbuhan. Default "2024".
  for (const periode of p.PDRB_SUB_PERIODE) {
    renderSinkron(h(PdrbEkrafStat), { 0: periode, 1: periode });
    const r = rekamanChart();
    const nilai = pasangan(r[4]);
    // Donut: 5 terbesar (nama pendek) + "Lainnya", urutannya sama dengan 5 teratas `nilai`.
    const distribusi = irisan(r[3]).map((d, i) => ({ label: d.label, nama: i < 5 ? nilai[i].label : d.label, pct: d.value }));
    const params: Record<string, string> = periode === "2024" ? {} : { periode };
    keluaran.push({
      nama: `dashboard.pdrb-ekraf.subsektor.sebaran.${periode.replace(" ", "-")}`,
      endpoint: "/v1/dashboard/pdrb-ekraf/subsektor/sebaran",
      params,
      data: { periode_list: [...p.PDRB_SUB_PERIODE], periode, label: labelPeriode[periode], distribusi, nilai_top10: nilai },
    });
    keluaran.push({
      nama: `dashboard.pdrb-ekraf.subsektor.pertumbuhan.${periode.replace(" ", "-")}`,
      endpoint: "/v1/dashboard/pdrb-ekraf/subsektor/pertumbuhan",
      params,
      data: { periode_list: [...p.PDRB_SUB_PERIODE], periode, label: labelPeriode[periode], items: pasangan(r[6]) },
    });
  }
  return keluaran;
}

// ── indikator: gci/resmi + dataset-tematik ────────────────────────────────────

async function gciResmi(): Promise<Golden[]> {
  const { GciOfficial } = await import("@/components/GciOfficial");
  const t = simpulTeks(renderSinkron(h(GciOfficial)));
  // Konstanta GciOfficial tidak diekspor; nilainya dibaca dari markup sesuai urutan tampil.
  const angka = (label: string, geser: number) => Number(t[t.indexOf(label) + geser]);
  const kartu = (label: string) => {
    const i = t.indexOf(label);
    const ujung = t.indexOf("Sumber", i);
    const tahun = t[t.indexOf("Tahun", i) + 1];
    const tengah = t.slice(i + 3, t.indexOf("Tahun", i));
    const ekor = t.slice(ujung + 2, ujung + 4);
    return {
      label, nilai: t[i + 1], satuan: t[i + 2], tahun, sumber: t[ujung + 1],
      catatan: tengah[0] ?? null,
      punya_detail: ekor[0] === "Lihat detail",
    };
  };
  const html = renderSinkron(h(GciOfficial));
  const href = new Map(tautan(html).map((a) => [simpulTeks(a.html).join(" "), a.href]));
  const kartuHref = (k: ReturnType<typeof kartu>) => {
    const { punya_detail, ...isi } = k;
    const cocok = [...href.entries()].find(([teks]) => teks.startsWith(k.label));
    return { ...isi, href: punya_detail && cocok ? cocok[1] : null };
  };
  return [{
    nama: "gci.resmi",
    endpoint: "/v1/gci/resmi",
    params: {},
    data: {
      ranking: {
        cultural: { y2024: angka("Peringkat Pengalaman Budaya", 1), y2025: angka("Peringkat Pengalaman Budaya", 3) },
        overall: { y2024: angka("GCI keseluruhan", 1), y2025: angka("GCI keseluruhan", 3) },
        sumber: { label: "jakarta.go.id/competitiveness", url: [...href.values()].find((u) => u.includes("competitiveness")) ?? null },
        catatan: t[t.indexOf("Sumber:") + 2].replace(/^· /, ""),
      },
      kartu: ["Jumlah Museum", "Seni Visual & Pertunjukan", "Wisatawan Internasional", "Penawaran Kuliner (Michelin)"].map((l) => kartuHref(kartu(l))),
    },
  }];
}

async function datasetTematik(): Promise<Golden[]> {
  const { FrameworkDataLinks } = await import("@/components/FrameworkDataLinks");
  const keluaran: Golden[] = [];
  for (const framework of ["GCI", "GPCI"] as const) {
    // Kartu dibaca dari markup: [no, judul, deskripsi, jumlah, satuan, "→"]. Deskripsi dan
    // satuan adalah teks tampilan (konstanta layer Nuxt), jadi tidak masuk respons.
    const items = tautan(renderSinkron(h(FrameworkDataLinks, { framework }))).map((a) => {
      const [no, title, , jumlah] = simpulTeks(a.html);
      return { no, title, href: a.href, total: jumlah === "—" ? null : Number(jumlah.replace(/\./g, "")) };
    });
    keluaran.push({ nama: `dataset-tematik.${framework}`, endpoint: "/v1/dataset-tematik", params: { framework }, data: { items } });
  }
  return keluaran;
}

// ── spasial (porsi statis) + beranda (angka beku, P4) ─────────────────────────

async function spasialStatis(): Promise<Golden[]> {
  const sp = await import("@/lib/spatial");
  // Sama dengan konstanta modul GmtiMapView: SPATIAL_POINTS.filter(hasSpatialCoordinates).
  const titik = sp.SPATIAL_POINTS.filter(sp.hasSpatialCoordinates).map((p) => ({
    id: p.id, name: p.name, category: p.category, city: p.city, address: p.address, lat: p.lat, lng: p.lng,
    href: p.href, kind: nul(p.kind), cert: nul(p.cert), source: nul(p.source),
  }));
  return [{
    nama: "spasial.statis",
    endpoint: "/v1/spasial",
    params: {},
    data: {
      categories: Object.entries(sp.SPATIAL_CATEGORIES).map(([id, c]) => ({
        id, label: c.label, color: c.color, icon_svg: c.icon, group: sp.MUSLIM_CATEGORIES.includes(id as never) ? "muslim" : null,
      })),
      points_statis: titik,
    },
    meta: { total: titik.length },
  }];
}

async function berandaStatis(): Promise<Golden[]> {
  const { default: Beranda } = await import("@/app/page");
  const t = simpulTeks(renderSinkron(h(Beranda)));
  const nilai = (label: string) => t[t.indexOf(label) - 1];
  return [{
    nama: "beranda.nextjs",
    endpoint: "/v1/beranda/ringkasan",
    params: {},
    data: {
      catatan: "Angka beku halaman beranda Next.js (P4). Portal memakai angka hidup; selisihnya di-whitelist uji paritas.",
      hero: ["Dataset primer SDI", "Baris pendataan lapangan", "Indikator GCI · GPCI dipantau", "Indeks global (GCI · GPCI)"].map((label) => ({ label, nilai: nilai(label) })),
      kartu: ["Katalog Data", "GCI", "GPCI", "Spatial"].map((judul) => {
        const i = t.indexOf(judul);
        const j = t.indexOf("→", i);
        return { judul, stat: t[j - 1] };
      }),
    },
  }];
}

/** Semua golden statis, urutan tetap. */
export async function goldenStatis(): Promise<Golden[]> {
  const kelompok = [
    atlasRestoranGci, atlasDirektoriRestoran, atlasPertunjukan, atlasGolf, atlasSuvenir, atlasHotel,
    gmti, pdrbEkraf, gciResmi, datasetTematik, spasialStatis, berandaStatis,
  ];
  const semua: Golden[] = [];
  for (const f of kelompok) semua.push(...(await f()));
  return semua;
}
