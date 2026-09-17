/**
 * POC runner: scrape Booking.com for Jakarta hotel availability and write to
 * the sandbox ClickHouse table.
 *
 * Usage:
 *   bun run start                 # default: 4 pages, polite delays
 *   SCRAPE_MAX_HOTELS=10 bun run start   # quick test
 *
 * ALWAYS read README.md first — this is research-grade, exit-strategy is
 * Booking.com Demand API.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scrape } from "./scraper.ts";
import { writeScrape, readRecent, TARGET_TABLE } from "./clickhouse.ts";

function loadDotEnv() {
  try {
    const txt = readFileSync(resolve(import.meta.dir, "..", ".env"), "utf8");
    for (const line of txt.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/i.exec(line);
      if (!m) continue;
      if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* .env optional */
  }
}
loadDotEnv();

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Booking.com → Jakarta hotel availability  (POC, research)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Target table: ${TARGET_TABLE}`);
  console.log(`  CH:           ${process.env.CH_URL}`);
  console.log("  Safeguards:   honest UA · rate-limit · robots.txt · abort on 403/429");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const offsetDays = Number(process.env.CHECKIN_OFFSET_DAYS ?? 14);
  const nights = Number(process.env.NIGHTS ?? 1);
  const adults = Number(process.env.ADULTS ?? 2);

  const checkin = new Date();
  checkin.setDate(checkin.getDate() + offsetDays);
  const checkout = new Date(checkin);
  checkout.setDate(checkout.getDate() + nights);

  console.log(`  Check-in:  ${checkin.toISOString().slice(0, 10)}`);
  console.log(`  Check-out: ${checkout.toISOString().slice(0, 10)}`);
  console.log(`  Adults:    ${adults}`);
  console.log();

  const t0 = Date.now();
  const result = await scrape({ checkin, checkout, adults });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("\n───────────────────────────────────────────────────────────");
  console.log(`  Total search results scraped:  ${result.total_search_results}`);
  console.log(`  Filtered OUT (non-DKI):        ${result.filtered_out}`);
  console.log(`  Detail pages OK:               ${result.detail_ok}`);
  console.log(`  Detail pages blocked:          ${result.detail_blocked}`);
  console.log(`  Filtered IN (DKI):             ${result.filtered_in}`);
  console.log(`  Elapsed:                       ${elapsed}s`);
  console.log("───────────────────────────────────────────────────────────");

  if (result.filter_rejections.length > 0) {
    console.log("\n  Sample rejections (showing first 8):");
    for (const r of result.filter_rejections.slice(0, 8)) {
      console.log(`    - ${r.name.slice(0, 50).padEnd(50)} → ${r.reason}`);
    }
  }

  if (result.rows.length === 0) {
    console.log("\n  No rows to write. Either blocked, or search returned no DKI hotels.");
    return;
  }

  const written = await writeScrape(result, checkin.toISOString().slice(0, 10), adults);
  console.log(`\n  ✓ Wrote ${written} rows to ${TARGET_TABLE}`);

  console.log("\n  Sample written rows (first 3):");
  for (const r of result.rows.slice(0, 3)) {
    console.log(`    - ${r.name.slice(0, 60).padEnd(60)} | ${r.star_rating ?? "-"}★ | ${r.review_score ?? "-"} / 10 | ${r.price_raw}`);
  }

  console.log("\n  Query them with:");
  console.log(`    bun run src/index.ts   # this file`);
  console.log(`    # or directly in ClickHouse:`);
  console.log(`    SELECT hotel_name, star_rating, review_score, price_idr, rooms_left`);
  console.log(`    FROM ${TARGET_TABLE} ORDER BY scraped_at DESC LIMIT 20;`);
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
