/**
 * Skrip ekspor data statis app ke berkas mentah (Plan 04).
 *
 * Menghasilkan JSON datar yang deterministik untuk setiap dataset:
 * - Kunci objek diurutkan alfabetis
 * - Kolom bersarang diratakan (induk_anak)
 * - Array di dalam baris diserialisasi sebagai string JSON
 * - Indentasi 1 spasi, newline di akhir berkas
 *
 * Jalankan dari platform-v2:
 *   cd platform-v2 && ./node_modules/.bin/tsx ../scripts/ekspor_data_statis.ts [--check]
 */

import fs from "fs";
import path from "path";

// ── Impor modul sumber dari platform-v2 ───────────────────────────────────────
import { RESTAURANTS } from "@/lib/restaurants";
import { OSM_RESTAURANTS } from "@/lib/restaurants-osm";
import { GCI_RESTAURANTS } from "@/lib/gci";
import { GCI_OSM } from "@/lib/gci-osm";
import { GCI_RATINGS } from "@/lib/gci-ratings";
import { GCI_ADDRESSES } from "@/lib/gci-addresses";
import { GCI_PRICELEVELS } from "@/lib/gci-pricelevels";
import { GCI_HOTEL_RESTOS } from "@/lib/gci-hotel-restos";
import { GCI_EVENTS } from "@/lib/events";
import { GOLF_COURSES } from "@/lib/golf";
import { SOUVENIR_SHOPS } from "@/lib/souvenir";
import { HOTEL_REGISTRY, HOTEL_TPK, HOTEL_LOS } from "@/lib/hotel";
import {
  GMTI_PLACES,
  GMTI_AGG,
  GMTI_TIPOLOGI,
  GMTI_CAPAIAN,
} from "@/lib/gmti-data";
import { JAKARTA_APPEARANCES } from "@/lib/pariwisata/jakarta-appearances";
import {
  PDRB_MAKRO,
  PDRB_SUBSEKTOR,
  PDRB_SUB_PERIODE,
  TARGET_KONTRIBUSI_RPJMD,
} from "@/lib/dashboard/pdrb-ekraf";
import { TARGET_WISMAN } from "@/lib/dashboard/data";

// ── Path repo ─────────────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(REPO_ROOT, "data");
const STATIS_DIR = path.join(DATA_DIR, "statis");
const REFERENSI_DIR = path.join(DATA_DIR, "referensi");
const CRAWL_DIR = path.join(DATA_DIR, "crawl");

// ── Utilitas transformasi ─────────────────────────────────────────────────────

function flattenRecord(
  obj: Record<string, any>,
  prefix = ""
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}_${key}` : key;
    const val = obj[key];
    if (val === undefined) {
      continue;
    }
    if (val === null || typeof val !== "object") {
      result[fullKey] = val;
    } else if (Array.isArray(val)) {
      result[fullKey] = JSON.stringify(val);
    } else {
      const child = flattenRecord(val, fullKey);
      for (const [ck, cv] of Object.entries(child)) {
        result[ck] = cv;
      }
    }
  }
  return result;
}

function sortKeys(obj: Record<string, any>): Record<string, any> {
  const sorted: Record<string, any> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = obj[k];
  }
  return sorted;
}

function formatJson(records: Record<string, any>[]): string {
  const normalized = records.map((r) => sortKeys(flattenRecord(r)));
  return JSON.stringify(normalized, null, 1) + "\n";
}

// ── Generator Dataset ─────────────────────────────────────────────────────────

export function getDatasets(): Record<string, { relPath: string; rows: Record<string, any>[] }> {
  const results: Record<string, { relPath: string; rows: Record<string, any>[] }> = {};

  // 1. restoran-kurasi
  results["restoran-kurasi"] = {
    relPath: "data/statis/restoran-kurasi.json",
    rows: RESTAURANTS.filter((r) => r.source === "curated"),
  };

  // 2. restoran-osm
  results["restoran-osm"] = {
    relPath: "data/statis/restoran-osm.json",
    rows: OSM_RESTAURANTS,
  };

  // 3. gci-venue-kurasi
  results["gci-venue-kurasi"] = {
    relPath: "data/statis/gci-venue-kurasi.json",
    rows: GCI_RESTAURANTS.filter((r) => r.source === "curated"),
  };

  // 4. gci-venue-osm
  results["gci-venue-osm"] = {
    relPath: "data/statis/gci-venue-osm.json",
    rows: GCI_OSM,
  };

  // 5. gci-venue-rating (hanya yang memiliki rating nyata, found: true = 1785)
  const ratingsRows: Record<string, any>[] = [];
  for (const [id, v] of Object.entries(GCI_RATINGS)) {
    if (v.found) {
      ratingsRows.push({
        id,
        rating: v.rating,
        reviewCount: v.reviewCount,
        source: v.source,
        placeId: v.placeId,
        found: v.found,
      });
    }
  }
  results["gci-venue-rating"] = {
    relPath: "data/statis/gci-venue-rating.json",
    rows: ratingsRows,
  };

  // 6. gci-venue-alamat (seluruh 2573 lookup alamat)
  const addressesRows: Record<string, any>[] = [];
  for (const [id, v] of Object.entries(GCI_ADDRESSES)) {
    addressesRows.push({
      id,
      address: v.address ?? null,
      found: v.found,
    });
  }
  results["gci-venue-alamat"] = {
    relPath: "data/statis/gci-venue-alamat.json",
    rows: addressesRows,
  };

  // 7. gci-venue-harga (1147 level harga)
  const pricesRows: Record<string, any>[] = [];
  for (const [id, v] of Object.entries(GCI_PRICELEVELS)) {
    pricesRows.push({
      id,
      priceLevel: v.priceLevel ?? null,
      source: v.source ?? null,
      found: v.found,
    });
  }
  results["gci-venue-harga"] = {
    relPath: "data/statis/gci-venue-harga.json",
    rows: pricesRows,
  };

  // 8. gci-resto-hotel (107 restoran hotel)
  const hotelRestosRows: Record<string, any>[] = [];
  for (const [id, v] of Object.entries(GCI_HOTEL_RESTOS)) {
    hotelRestosRows.push({
      id,
      name: v.name,
      source: v.source,
    });
  }
  results["gci-resto-hotel"] = {
    relPath: "data/statis/gci-resto-hotel.json",
    rows: hotelRestosRows,
  };

  // 9. event-pertunjukan
  results["event-pertunjukan"] = {
    relPath: "data/statis/event-pertunjukan.json",
    rows: GCI_EVENTS,
  };

  // 10. golf
  results["golf"] = {
    relPath: "data/statis/golf.json",
    rows: GOLF_COURSES,
  };

  // 11. souvenir
  results["souvenir"] = {
    relPath: "data/statis/souvenir.json",
    rows: SOUVENIR_SHOPS,
  };

  // 12. hotel-registri
  results["hotel-registri"] = {
    relPath: "data/statis/hotel-registri.json",
    rows: HOTEL_REGISTRY,
  };

  // 13. hotel-tpk
  results["hotel-tpk"] = {
    relPath: "data/statis/hotel-tpk.json",
    rows: HOTEL_TPK,
  };

  // 14. hotel-los
  results["hotel-los"] = {
    relPath: "data/statis/hotel-los.json",
    rows: HOTEL_LOS,
  };

  // 15. gmti-tempat
  results["gmti-tempat"] = {
    relPath: "data/statis/gmti-tempat.json",
    rows: GMTI_PLACES,
  };

  // 16. gmti-kecamatan
  results["gmti-kecamatan"] = {
    relPath: "data/statis/gmti-kecamatan.json",
    rows: GMTI_AGG,
  };

  // 17. gmti-tipologi
  results["gmti-tipologi"] = {
    relPath: "data/statis/gmti-tipologi.json",
    rows: GMTI_TIPOLOGI,
  };

  // 18. gmti-capaian
  results["gmti-capaian"] = {
    relPath: "data/statis/gmti-capaian.json",
    rows: GMTI_CAPAIAN,
  };

  // 19. gmti-ibadah (dari platform-v2/public/gmti-ibadah.json)
  const ibadahRaw = JSON.parse(
    fs.readFileSync(
      path.join(REPO_ROOT, "platform-v2", "public", "gmti-ibadah.json"),
      "utf-8"
    )
  );
  results["gmti-ibadah"] = {
    relPath: "data/statis/gmti-ibadah.json",
    rows: ibadahRaw.rows,
  };

  // 20. seni-venue (dari platform-v2/lib/pariwisata/seni-venues.json)
  const seniVenuesRaw = JSON.parse(
    fs.readFileSync(
      path.join(REPO_ROOT, "platform-v2", "lib", "pariwisata", "seni-venues.json"),
      "utf-8"
    )
  );
  results["seni-venue"] = {
    relPath: "data/statis/seni-venue.json",
    rows: seniVenuesRaw,
  };

  // 21. artis-tampil-jakarta
  const appearancesRows: Record<string, any>[] = [];
  for (const [artist, v] of Object.entries(JAKARTA_APPEARANCES)) {
    appearancesRows.push({
      artist,
      years: v.years,
      venue: v.venue,
      source: v.source,
    });
  }
  results["artis-tampil-jakarta"] = {
    relPath: "data/statis/artis-tampil-jakarta.json",
    rows: appearancesRows,
  };

  // 22. pdrb-ekraf-makro (bentuk panjang: satu baris per periode)
  const makroRows: Record<string, any>[] = [];
  for (let i = 0; i < PDRB_MAKRO.periode.length; i++) {
    makroRows.push({
      periode: PDRB_MAKRO.periode[i],
      adhb_ekraf: PDRB_MAKRO.adhbEkraf[i],
      adhb_dki: PDRB_MAKRO.adhbDki[i],
      kontribusi: PDRB_MAKRO.kontribusi[i],
      adhk_ekraf: PDRB_MAKRO.adhkEkraf[i],
      tumbuh_ekraf: PDRB_MAKRO.tumbuhEkraf[i],
      tumbuh_non_ekraf: PDRB_MAKRO.tumbuhNonEkraf[i],
      tumbuh_dki: PDRB_MAKRO.tumbuhDki[i],
    });
  }
  results["pdrb-ekraf-makro"] = {
    relPath: "data/statis/pdrb-ekraf-makro.json",
    rows: makroRows,
  };

  // 23. pdrb-ekraf-subsektor (bentuk panjang: satu baris per periode x subsektor)
  const subsektorRows: Record<string, any>[] = [];
  for (const s of PDRB_SUBSEKTOR) {
    for (let j = 0; j < PDRB_SUB_PERIODE.length; j++) {
      subsektorRows.push({
        subsektor: s.nama,
        periode: PDRB_SUB_PERIODE[j],
        adhb: s.adhb[j],
        adhk: s.adhk[j],
        tumbuh: s.tumbuh[j],
      });
    }
  }
  results["pdrb-ekraf-subsektor"] = {
    relPath: "data/statis/pdrb-ekraf-subsektor.json",
    rows: subsektorRows,
  };

  // 24. gci-gpci-benchmark (28 indikator benchmark)
  const benchmarkRaw = JSON.parse(
    fs.readFileSync(
      path.join(REPO_ROOT, "platform-v2", "data", "gci-gpci-benchmarks.json"),
      "utf-8"
    )
  );
  const benchmarkRows: Record<string, any>[] = [];
  for (const [metricId, v] of Object.entries<any>(benchmarkRaw)) {
    benchmarkRows.push({
      metric_id: metricId,
      index_metric: v.indexMetric,
      index_source: v.indexSource,
      unit: v.unit,
      frontier_city: v.frontier?.city ?? null,
      frontier_value: v.frontier?.value ?? null,
      jakarta_value: v.jakarta?.value ?? null,
      jakarta_note: v.jakarta?.note ?? null,
      target: v.target ?? null,
      data_needed: v.dataNeeded,
    });
  }
  results["gci-gpci-benchmark"] = {
    relPath: "data/statis/gci-gpci-benchmark.json",
    rows: benchmarkRows,
  };

  // 25. target-wisman (bentuk panjang)
  const wismanRows: Record<string, any>[] = [];
  for (const [tahun, target] of Object.entries(TARGET_WISMAN)) {
    wismanRows.push({
      tahun: parseInt(tahun, 10),
      target_wisman: target,
      satuan: "orang",
      dasar_hukum: "RPJMD 2025–2029 (Tabel III.2) indikator 2.1.c",
    });
  }
  results["target-wisman"] = {
    relPath: "data/referensi/target-wisman.json",
    rows: wismanRows,
  };

  // 26. target-kontribusi-ekraf-rpjmd (bentuk panjang)
  const kontribusiRows: Record<string, any>[] = [];
  for (const [tahun, target] of Object.entries(TARGET_KONTRIBUSI_RPJMD)) {
    kontribusiRows.push({
      tahun: parseInt(tahun, 10),
      target_kontribusi_persen: target,
      satuan: "persen",
      dasar_hukum: "RPJMD 2025–2029",
    });
  }
  results["target-kontribusi-ekraf-rpjmd"] = {
    relPath: "data/referensi/target-kontribusi-ekraf-rpjmd.json",
    rows: kontribusiRows,
  };

  // 27. gci-kearney-resmi (peringkat Kearney dan 4 sub-indikator resmi, bentuk panjang)
  const kearneyRows: Record<string, any>[] = [
    {
      kategori: "peringkat",
      indikator: "Peringkat Keseluruhan (Overall)",
      tahun: 2024,
      nilai: 74,
      satuan: "peringkat",
      sumber: "jakarta.go.id/competitiveness (Kearney GCI)",
      pj: "Pemerintah Provinsi DKI Jakarta",
      catatan: "",
    },
    {
      kategori: "peringkat",
      indikator: "Peringkat Keseluruhan (Overall)",
      tahun: 2025,
      nilai: 71,
      satuan: "peringkat",
      sumber: "jakarta.go.id/competitiveness (Kearney GCI)",
      pj: "Pemerintah Provinsi DKI Jakarta",
      catatan: "",
    },
    {
      kategori: "peringkat",
      indikator: "Pengalaman Budaya (Cultural Experience)",
      tahun: 2024,
      nilai: 52,
      satuan: "peringkat",
      sumber: "jakarta.go.id/competitiveness (Kearney GCI)",
      pj: "Pemerintah Provinsi DKI Jakarta",
      catatan: "Dimensi pariwisata & budaya",
    },
    {
      kategori: "peringkat",
      indikator: "Pengalaman Budaya (Cultural Experience)",
      tahun: 2025,
      nilai: 58,
      satuan: "peringkat",
      sumber: "jakarta.go.id/competitiveness (Kearney GCI)",
      pj: "Pemerintah Provinsi DKI Jakarta",
      catatan: "Dimensi pariwisata & budaya",
    },
    {
      kategori: "indikator",
      indikator: "Jumlah Museum",
      tahun: 2025,
      nilai: 79,
      satuan: "Museum",
      sumber: "satudata.jakarta.go.id",
      pj: "Dinas Kebudayaan",
      catatan: "",
    },
    {
      kategori: "indikator",
      indikator: "Seni Visual & Pertunjukan",
      tahun: 2024,
      nilai: 156,
      satuan: "Karya / kegiatan",
      sumber: "Dinas Pariwisata & Ekraf",
      pj: "Dinas Pariwisata & Ekraf",
      catatan: "Belum digabung dengan data Disbud.",
    },
    {
      kategori: "indikator",
      indikator: "Wisatawan Internasional",
      tahun: 2025,
      nilai: 2767622,
      satuan: "Wisatawan",
      sumber: "jakarta.bps.go.id",
      pj: "Dinas Pariwisata & Ekraf",
      catatan: "",
    },
    {
      kategori: "indikator",
      indikator: "Penawaran Kuliner (Michelin)",
      tahun: 2025,
      nilai: 0,
      satuan: "Restoran Michelin",
      sumber: "Michelin",
      pj: "Dinas Pariwisata & Ekraf",
      catatan: "Belum ada Michelin Star di Jakarta.",
    },
  ];
  results["gci-kearney-resmi"] = {
    relPath: "data/referensi/gci-kearney-resmi.json",
    rows: kearneyRows,
  };

  return results;
}

// ── Eksekusi CLI ──────────────────────────────────────────────────────────────

function main() {
  const isCheck = process.argv.includes("--check");
  const datasets = getDatasets();

  // Pastikan folder tujuan ada
  fs.mkdirSync(STATIS_DIR, { recursive: true });
  fs.mkdirSync(REFERENSI_DIR, { recursive: true });
  fs.mkdirSync(CRAWL_DIR, { recursive: true });

  let hasDiff = false;
  let totalDatasets = 0;
  let totalRows = 0;

  console.log(`[ekspor_data_statis] Mode: ${isCheck ? "CHECK" : "EXPORT"}`);

  for (const [name, ds] of Object.entries(datasets)) {
    totalDatasets++;
    totalRows += ds.rows.length;
    const fullPath = path.join(REPO_ROOT, ds.relPath);
    const content = formatJson(ds.rows);

    if (isCheck) {
      if (!fs.existsSync(fullPath)) {
        console.error(`[CHECK FAIL] Berkas belum ada: ${ds.relPath}`);
        hasDiff = true;
      } else {
        const existing = fs.readFileSync(fullPath, "utf-8");
        if (existing !== content) {
          console.error(`[CHECK FAIL] Berkas berbeda: ${ds.relPath}`);
          hasDiff = true;
        } else {
          console.log(`[OK] ${ds.relPath} (${ds.rows.length} baris)`);
        }
      }
    } else {
      fs.writeFileSync(fullPath, content, "utf-8");
      console.log(`[EXPORTED] ${ds.relPath} (${ds.rows.length} baris)`);
    }
  }

  // 28. Validasi berkas crawl booking-hotel jika ada
  const bookingRelPath = "data/crawl/booking-hotel-2026-09-15.json";
  const bookingFullPath = path.join(REPO_ROOT, bookingRelPath);
  if (!fs.existsSync(bookingFullPath)) {
    if (isCheck) {
      console.error(`[CHECK FAIL] Berkas crawl belum ada: ${bookingRelPath}`);
      hasDiff = true;
    }
  } else {
    const rawBooking = JSON.parse(fs.readFileSync(bookingFullPath, "utf-8"));
    console.log(`[OK] ${bookingRelPath} (${rawBooking.length} baris)`);
    totalDatasets++;
    totalRows += rawBooking.length;
  }

  console.log(`[ekspor_data_statis] Total: ${totalDatasets} dataset, ${totalRows} baris`);

  if (isCheck && hasDiff) {
    process.exit(1);
  }
}

main();
