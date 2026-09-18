/**
 * Enrich inventori venue wellness DKI Jakarta dengan Google Places API (New)
 * Text Search. Tujuannya menangkap venue premium/hotel-spa kelas atas yang
 * OSM tidak catat (Aman Spa, ESPA at Pullman, Four Seasons Spa, St. Regis,
 * Ritz-Carlton, Mandarin Oriental, Shangri-La, Kempinski, JW Marriott,
 * InterContinental, Mulia, Alila, Fairmont, Keraton Plaza, Westin, dll).
 *
 * Field mask: Essentials tier (formattedAddress = gratis 10k/bulan).
 *   - places.id
 *   - places.displayName
 *   - places.formattedAddress
 *   - places.location
 *   - places.types
 *   - places.primaryType
 *
 * API key dari env GOOGLE_API_KEY. JANGAN tulis key ke repo (publik).
 * Sandarkan ke Portainer stack Env.
 *
 * Usage:
 *   GOOGLE_API_KEY=xxx bun run scripts/enrich_wellness_google.ts
 *
 * Output:
 *   - scripts/google_wellness_cache.json    (raw API responses per query)
 *   - data/wellness-jakarta-google-additions.json  (parsed rows + summary)
 *
 * Lalu merge ke data/sekunder/wellness-jakarta.json.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO = "/home/alfi/repos/DisparDataPlatform";
const CACHE = join(REPO, "scripts", "google_wellness_cache.json");
const OUT = join(REPO, "data", "wellness-jakarta-google-additions.json");

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error("ERROR: GOOGLE_API_KEY env kosong. Pasang dulu.");
  console.error("  GOOGLE_API_KEY=xxx bun run scripts/enrich_wellness_google.ts");
  process.exit(1);
}

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
].join(",");

// DKI Jakarta bbox untuk locationRestriction.rectangle.
const DKI_RECT = {
  low: { latitude: -6.51, longitude: 106.38 },
  high: { latitude: -5.30, longitude: 107.10 },
};

// Filter kategori premium: hotel-spa brand-name Jakarta.
const QUERIES: string[] = [
  // Brand-name spa — high-signal premium
  "Aman Spa Jakarta",
  "ESPA Pullman Jakarta",
  "Four Seasons Spa Jakarta",
  "Mandarin Oriental Spa Jakarta",
  "St. Regis Spa Jakarta",
  "Ritz-Carlton Spa Jakarta",
  "Shangri-La Spa Jakarta",
  "Kempinski Spa Jakarta",
  "JW Marriott Spa Jakarta",
  "InterContinental Spa Jakarta",
  "Mulia Spa Jakarta",
  "Alila Spa Jakarta",
  "Fairmont Spa Jakarta",
  "Keraton Plaza Spa Jakarta",
  "Westin Spa Jakarta",
  "Sheraton Spa Jakarta",
  "Grand Hyatt Spa Jakarta",
  "Raffles Spa Jakarta",
  "Conrad Spa Jakarta",
  "Hilton Spa Jakarta",
  "Le Meridien Spa Jakarta",
  "W Hotel Spa Jakarta",
  "Park Hyatt Spa Jakarta",
  "Ritz Carlton Pacific Place Spa",
  // Umum
  "luxury hotel spa Jakarta",
  "hotel spa Jakarta pusat",
  "hotel spa Jakarta selatan",
  "hotel spa Senayan",
  "hotel spa Sudirman",
  "hotel spa Thamrin",
  "hotel spa Kuningan",
  "hotel spa Kelapa Gading",
  "day spa Jakarta premium",
];

// Hanya tipe venue wellness/spa yang dianggap.
const ALLOWED_PRIMARY_TYPES = new Set([
  "spa",
  "wellness_center",
  "beauty_salon",
  "health",
  "gym",
  "fitness_center",
]);

// Tipe venue yang boleh datang dari hotel (hotel punya spa di dalamnya).
const ALLOWED_TYPES = new Set([
  "spa",
  "wellness_center",
  "beauty_salon",
  "health",
  "gym",
  "fitness_center",
  "lodging", // hotel — akan di-filter dengan keyword "spa" di nama
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type PlacesResponse = {
  places?: Array<{
    id: string;
    displayName?: { text?: string; languageCode?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    types?: string[];
    primaryType?: string;
    primaryTypeDisplayName?: string;
  }>;
};

async function searchText(query: string): Promise<PlacesResponse> {
  const body = {
    textQuery: query,
    maxResultCount: 10,
    locationRestriction: {
      rectangle: DKI_RECT,
    },
  };
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY!,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as PlacesResponse;
}

function isLikelyWellness(place: {
  displayName?: { text?: string };
  primaryType?: string;
  types?: string[];
}): boolean {
  const n = (place.displayName?.text ?? "").toLowerCase();
  // High-signal: primary type
  if (place.primaryType && ALLOWED_PRIMARY_TYPES.has(place.primaryType)) return true;
  // Hotel lodging → harus ada "spa" / "wellness" di nama
  if (place.types?.includes("lodging") || place.primaryType === "lodging") {
    return /spa|wellness|estetika|kecantikan/.test(n);
  }
  // Tipe mengandung spa/wellness → lolos
  if (place.types?.some((t) => ALLOWED_TYPES.has(t))) return true;
  // Nama mengandung kata wellness → lolos
  return /spa|wellness|estetika|kecantikan|refleksi|masaj|massage/.test(n);
}

async function main() {
  let perQuery: Record<string, PlacesResponse | { error: string }> = {};
  if (existsSync(CACHE)) {
    perQuery = JSON.parse(readFileSync(CACHE, "utf8"));
    console.log(`  cache hit: ${CACHE} (${Object.keys(perQuery).length} queries cached)`);
  } else {
    perQuery = {};
  }

  const seenIds = new Set<string>();
  const rows: Array<Record<string, unknown>> = [];
  const skippedNonWellness: Array<{ q: string; name: string }> = [];
  const skippedNonDKI: Array<{ q: string; name: string }> = [];
  const byQuery: Record<string, number> = {};

  for (let i = 0; i < QUERIES.length; i++) {
    const q = QUERIES[i];
    if (perQuery[q]) {
      console.log(`  [${i + 1}/${QUERIES.length}] cached q=${q}`);
    } else {
      console.log(`  [${i + 1}/${QUERIES.length}] q=${q}`);
      try {
        perQuery[q] = await searchText(q);
      } catch (err) {
        perQuery[q] = { error: String((err as Error).message ?? err) };
        console.error(`    ERROR: ${perQuery[q].error}`);
      }
      // Save per 5 query — aman kalau putus di tengah jalan
      if ((i + 1) % 5 === 0) {
        writeFileSync(CACHE, JSON.stringify(perQuery, null, 0));
      }
      await sleep(120); // 8 QPS; di bawah limit Google Places (100 QPS default)
    }

    const cached = perQuery[q] as PlacesResponse | { error: string };
    if ("error" in cached) continue;
    byQuery[q] = 0;
    for (const p of cached.places ?? []) {
      if (seenIds.has(p.id)) continue;
      const name = p.displayName?.text ?? "";
      if (!isLikelyWellness(p)) {
        skippedNonWellness.push({ q, name });
        continue;
      }
      const loc = p.location;
      if (!loc) continue;
      // Final bbox check (locationRestriction sudah diterapkan, tapi double-check)
      if (
        loc.latitude < DKI_RECT.low.latitude ||
        loc.latitude > DKI_RECT.high.latitude ||
        loc.longitude < DKI_RECT.low.longitude ||
        loc.longitude > DKI_RECT.high.longitude
      ) {
        skippedNonDKI.push({ q, name });
        continue;
      }
      seenIds.add(p.id);
      byQuery[q]++;
      rows.push({
        id: `wellness-jakarta-google-${p.id}`,
        nama: name,
        kategori_wellness:
          p.primaryType === "lodging"
            ? "Hotel Spa Premium"
            : p.primaryType === "gym" || p.primaryType === "fitness_center"
              ? "Fitness & Gym"
              : p.primaryType === "beauty_salon"
                ? "Klinik Kecantikan & Estetika"
                : "Spa & Pijat",
        kategori_osm: `google_places/${p.primaryType ?? "unknown"}`,
        alamat: p.formattedAddress ?? "",
        latitude: Math.round(loc.latitude * 1e6) / 1e6,
        longitude: Math.round(loc.longitude * 1e6) / 1e6,
        sumber: `Google Places (New) places/${p.id}`,
        google_place_id: p.id,
        google_primary_type: p.primaryType ?? "",
        importance: null,
      });
    }
  }

  writeFileSync(CACHE, JSON.stringify(perQuery, null, 0));

  const summary = {
    total_queries: QUERIES.length,
    added_unique: rows.length,
    skipped_non_wellness: skippedNonWellness.length,
    skipped_out_of_bbox: skippedNonDKI.length,
    by_query: byQuery,
    api_tier: "Essentials (formattedAddress)",
    cost_estimate_usd: 0.0, // < 10k requests/month = gratis
  };
  writeFileSync(OUT, JSON.stringify({ summary, rows }, null, 0));

  console.log("\n=== SUMMARY ===");
  console.log(`  total queries:        ${summary.total_queries}`);
  console.log(`  added unique:         ${summary.added_unique}`);
  console.log(`  skipped non-wellness: ${summary.skipped_non_wellness}`);
  console.log(`  skipped out-of-bbox:  ${summary.skipped_out_of_bbox}`);
  console.log(`  by_query:`);
  for (const [q, c] of Object.entries(summary.by_query)) {
    if (c > 0) console.log(`    ${q}: ${c}`);
  }
  console.log(`\nOutput: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});