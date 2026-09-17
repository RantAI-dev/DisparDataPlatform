/**
 * Smoke test — connectivity check before the real scrape.
 *
 * Verifies:
 *   • ClickHouse reachable, can create the sandbox table
 *   • Booking.com reachable, not blocked
 *   • robots.txt parseable
 *
 * Usage: bun run smoke
 */

import { createClient } from "@clickhouse/client";
import { fetchRobotsTxt, isPathDisallowed } from "./scraper.ts";

async function main() {
  console.log("SMOKE TEST — booking-jakarta POC\n");

  // 1. ClickHouse
  const ch = createClient({
    url: process.env.CH_URL ?? "http://localhost:18123",
    username: process.env.CH_USER ?? "dispar",
    password: process.env.CH_PASSWORD ?? "",
  });
  try {
    const rs = await ch.query({ query: "SELECT 1 as ok", format: "JSONEachRow" });
    const j = await rs.json<{ ok: number }[]>();
    console.log("  ✓ ClickHouse reachable:", j[0]?.ok === 1 ? "OK" : "wrong response");
  } catch (e) {
    console.error("  ✗ ClickHouse unreachable:", e);
    process.exit(1);
  } finally {
    await ch.close();
  }

  // 2. Apply schema
  try {
    const mod = await import("./schema.ts");
    // Run the schema's main() by invoking it indirectly — Bun module imports
    // with import.meta.main won't auto-run when imported from another file.
    // We duplicate the DDL call here for simplicity:
    await ch.query({
      query: `CREATE TABLE IF NOT EXISTS serving.mart_hotel_scraped_booking (
        hotel_id String, hotel_name String, hotel_url String,
        address String, city LowCardinality(String), country LowCardinality(String),
        latitude Nullable(Float64), longitude Nullable(Float64), distance_km Nullable(Float64),
        star_rating Nullable(UInt8), review_score Nullable(Float32),
        review_label LowCardinality(String), review_count Nullable(UInt32),
        price_idr Nullable(UInt32), price_currency LowCardinality(String), price_raw String,
        rooms_left Nullable(UInt16), total_room_types Nullable(UInt8),
        room_types_json String DEFAULT '[]',
        is_available UInt8 DEFAULT 1,
        checkin Date, checkout Date, adults UInt8,
        scraped_at DateTime DEFAULT now(),
        source LowCardinality(String) DEFAULT 'booking.com-poc'
      ) ENGINE = MergeTree() ORDER BY (checkin, hotel_id, scraped_at) TTL scraped_at + INTERVAL 30 DAY`,
    });
    // Idempotent ALTERs for columns added after the initial deploy.
    const alters = [
      `ALTER TABLE serving.mart_hotel_scraped_booking ADD COLUMN IF NOT EXISTS room_types_json String DEFAULT '[]'`,
    ];
    for (const sql of alters) {
      try { await ch.query({ query: sql }); } catch { /* ignore */ }
    }
    console.log("  ✓ Schema: serving.mart_hotel_scraped_booking");
  } catch (e) {
    console.error("  ✗ Schema failed:", e);
    process.exit(1);
  }

  // 3. robots.txt
  const robots = await fetchRobotsTxt();
  if (!robots) {
    console.error("  ✗ Could not fetch robots.txt");
    process.exit(1);
  }
  const blocksSearch = isPathDisallowed(robots, "/searchresults.html");
  const blocksHotel = isPathDisallowed(robots, "/hotel/");
  console.log(`  ✓ robots.txt fetched (search blocked: ${blocksSearch}, hotel blocked: ${blocksHotel})`);
  if (blocksSearch || blocksHotel) {
    console.error("  ✗ robots.txt blocks our paths — abort per safety policy.");
    process.exit(1);
  }

  console.log("\n✓ All systems green. Run: bun run start");
}

main().catch((e) => { console.error(e); process.exit(1); });
