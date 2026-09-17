/**
 * Schema for the sandbox table that holds POC scraped data.
 *
 * This lives in the `serving` database (Gold layer) but is clearly named
 * `_sandbox_*` so it's obvious it's research-grade data. A real production
 * version should be renamed e.g. `serving.mart_hotel_ota` and be fed by the
 * Booking.com Demand API (or partner data).
 *
 * Usage:
 *   bun run schema
 */

import { createClient } from "@clickhouse/client";

const CH_URL = process.env.CH_URL ?? "http://localhost:18123";
const CH_USER = process.env.CH_USER ?? "dispar_app";
const CH_PASSWORD = process.env.CH_PASSWORD ?? "";
const DB = process.env.CH_DATABASE ?? "serving";

const TABLE = `${DB}.mart_hotel_scraped_booking`;

// MergeTree over scraped_at is fine — each run is append, latest row wins per
// hotel_id+scraped_at. We don't dedupe to a single row per hotel because we
// want the history of snapshots for time-series analysis.
const DDL = `
CREATE TABLE IF NOT EXISTS ${TABLE} (
  -- identity
  hotel_id          String,                        -- Booking.com hotel slug (e.g. "the-ritz-carlton-jakarta")
  hotel_name        String,
  hotel_url         String,

  -- location
  address           String,                        -- full address as shown on detail page
  city              LowCardinality(String),         -- city as Booking shows it
  country           LowCardinality(String),         -- "Indonesia"
  latitude          Nullable(Float64),
  longitude         Nullable(Float64),
  distance_km       Nullable(Float64),             -- distance from Jakarta center (-6.2088, 106.8456)

  -- rating
  star_rating       Nullable(UInt8),               -- 0-5
  review_score      Nullable(Float32),             -- e.g. 8.7
  review_label      LowCardinality(String),         -- "Fabulous", "Very good", etc.
  review_count      Nullable(UInt32),

  -- pricing (public, visible without login)
  price_idr         Nullable(UInt32),              -- converted to IDR (USD ~ 16000 IDR) — cheapest rate found
  price_currency    LowCardinality(String),         -- "IDR" or "USD"
  price_raw         String,                        -- original string of cheapest rate

  -- availability (public, visible without login)
  rooms_left        Nullable(UInt16),              -- "Only X rooms left" badge, null if not shown
  total_room_types  Nullable(UInt8),               -- number of distinct room types
  is_available      UInt8 DEFAULT 1,                -- 0 = sold out / unavailable for selected dates

  -- room inventory (full detail per-room JSON)
  -- Each element: {name, beds?, sleeps?, price_min_idr, price_max_idr, price_raw_min, price_raw_max,
  --                 breakfast_included:bool, cancellation:str, rate_count:UInt8}
  room_types_json   String DEFAULT '[]',           -- JSON array of unique room types + price ranges

  -- search context
  checkin           Date,
  checkout          Date,
  adults            UInt8,

  -- provenance
  scraped_at        DateTime DEFAULT now(),
  source            LowCardinality(String) DEFAULT 'booking.com-poc'
)
ENGINE = MergeTree()
ORDER BY (checkin, hotel_id, scraped_at)
TTL scraped_at + INTERVAL 30 DAY
`.trim();

async function main() {
  const client = createClient({ url: CH_URL, username: CH_USER, password: CH_PASSWORD });
  try {
    await client.query({ query: DDL });
    console.log(`✓ Schema applied: ${TABLE}`);
  } catch (e) {
    console.error("✗ Schema failed:", e);
    process.exit(1);
  } finally {
    await client.close();
  }
}

if (import.meta.main) await main();
