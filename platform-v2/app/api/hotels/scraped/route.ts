import { NextResponse } from "next/server";
import { q } from "@/lib/ch/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RoomType = {
  name: string;
  beds?: string;
  sleeps?: string;
  price_min_idr: number;
  price_max_idr: number;
  price_raw_min: string;
  price_raw_max: string;
  breakfast_included: boolean;
  cancellation?: string;
  rate_count: number;
};

function safeParseRooms(s: string | null | undefined): RoomType[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Read hotel availability snapshots scraped from Booking.com (POC).
 * Sandbox table: serving.mart_hotel_scraped_booking
 * Returns the latest snapshot per hotel for the most recent checkin date.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

  try {
    // Latest snapshot per hotel for the most recent checkin date we have.
    const rawRows = await q<Record<string, unknown>>(
      `SELECT *
       FROM serving.mart_hotel_scraped_booking
       WHERE (checkin, hotel_id, scraped_at) IN (
         SELECT checkin, hotel_id, max(scraped_at)
         FROM serving.mart_hotel_scraped_booking
         GROUP BY checkin, hotel_id
       )
       ORDER BY review_score DESC NULLS LAST, price_idr ASC NULLS LAST
       LIMIT {limit:UInt32}`,
      { limit },
    );

    // Hydrate room_types_json into parsed objects.
    const rows = rawRows.map((r) => ({
      ...r,
      room_types: safeParseRooms(r.room_types_json as string),
    }));

    // Summary stats (last 7 days)
    const stats = await q<{
      total: number;
      with_coords: number;
      with_address: number;
      with_rooms_left: number;
      with_rooms: number;
      total_room_types: number;
      avg_price: number | null;
      min_price: number | null;
      max_price: number | null;
      distinct_cities: number;
      avg_room_types_per_hotel: number;
    }>(
      `SELECT
         count() AS total,
         countIf(latitude IS NOT NULL AND longitude IS NOT NULL) AS with_coords,
         countIf(address != '') AS with_address,
         countIf(rooms_left IS NOT NULL) AS with_rooms_left,
         countIf(length(room_types_json) > 2) AS with_rooms,
         round(avg(price_idr)) AS avg_price,
         min(price_idr) AS min_price,
         max(price_idr) AS max_price,
         uniqExact(city) AS distinct_cities
       FROM serving.mart_hotel_scraped_booking
       WHERE scraped_at > now() - INTERVAL 7 DAY`,
    );

    // Separate query for room types total (aggregate over non-aggregate).
    // ClickHouse is strict: any aggregate function in a subquery then re-aggregated
    // needs the inner GROUP BY at the top level. Use a CTE-style approach.
    const roomStats = await q<{ total_room_types: number; avg_room_types_per_hotel: number }>(
      `WITH per_hotel AS (
         SELECT hotel_id,
                anyLast(total_room_types) AS rooms_for_hotel
         FROM serving.mart_hotel_scraped_booking
         WHERE scraped_at > now() - INTERVAL 7 DAY
         GROUP BY hotel_id
         HAVING rooms_for_hotel IS NOT NULL
       )
       SELECT
         sum(rooms_for_hotel) AS total_room_types,
         round(avg(rooms_for_hotel), 1) AS avg_room_types_per_hotel
       FROM per_hotel`,
    );
    const combinedStats = { ...stats[0], ...roomStats[0] };

    return NextResponse.json({
      rows,
      stats: combinedStats,
      last_checkin: (rows[0] as any)?.checkin ?? null,
      source: "booking.com-poc",
      note: "Sandbox table from research-grade POC scraper. Exit-strategy → Booking Demand API.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
