/**
 * ClickHouse writer for scraped hotel data.
 * Sandbox table — clearly named _scraped_booking so it's obvious in dashboards.
 */

import { createClient, type ClickHouseClient } from "@clickhouse/client";
import type { DetailRow, ScrapeResult } from "./scraper.ts";

const CH_URL = process.env.CH_URL ?? "http://localhost:18123";
const CH_USER = process.env.CH_USER ?? "dispar";
const CH_PASSWORD = process.env.CH_PASSWORD ?? "";
const CH_DATABASE = process.env.CH_DATABASE ?? "serving";

export const TARGET_TABLE = `${CH_DATABASE}.mart_hotel_scraped_booking`;

let _client: ClickHouseClient | null = null;
function client(): ClickHouseClient {
  if (_client) return _client;
  _client = createClient({ url: CH_URL, username: CH_USER, password: CH_PASSWORD });
  return _client;
}

function toRow(row: DetailRow, checkin: string, adults: number) {
  return {
    hotel_id: row.slug,
    hotel_name: row.name,
    hotel_url: `https://www.booking.com/hotel/id/${row.slug}.html`,
    address: row.address ?? "",
    city: row.city ?? "Jakarta",
    country: row.country ?? "Indonesia",
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    distance_km: computeDistanceKm(row.latitude ?? null, row.longitude ?? null),
    star_rating: row.star_rating ?? null,
    review_score: row.review_score ?? null,
    review_label: row.review_label ?? null,
    review_count: row.review_count ?? null,
    price_idr: row.price_idr ?? null,
    price_currency: row.price_currency ?? "IDR",
    price_raw: row.price_raw ?? "",
    rooms_left: row.rooms_left ?? null,
    total_room_types: row.total_room_types ?? null,
    room_types_json: row.room_types_json ?? "[]",
    is_available: row.is_available === false ? 0 : 1,
    checkin,
    checkout: nextDay(checkin),
    adults,
  };
}

function nextDay(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Haversine distance from Jakarta center (-6.2088, 106.8456). */
function computeDistanceKm(lat: number | null, lng: number | null): number | null {
  if (lat == null || lng == null) return null;
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat - -6.2088);
  const dLng = toRad(lng - 106.8456);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(-6.2088)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export async function writeScrape(result: ScrapeResult, checkin: string, adults: number): Promise<number> {
  if (result.rows.length === 0) return 0;
  const rows = result.rows.map((r) => toRow(r, checkin, adults));
  await client().insert({
    table: TARGET_TABLE,
    values: rows,
    format: "JSONEachRow",
  });
  return rows.length;
}

export async function readRecent(limit: number = 100, checkin?: string): Promise<Record<string, unknown>[]> {
  const params: Record<string, unknown> = { limit };
  const where = checkin ? `WHERE checkin = {checkin:Date}` : "";
  if (checkin) params.checkin = checkin;
  const rs = await client().query({
    query: `SELECT * FROM ${TARGET_TABLE} ${where} ORDER BY scraped_at DESC LIMIT {limit:UInt32}`,
    query_params: params,
    format: "JSONEachRow",
  });
  return rs.json<Record<string, unknown>[]>();
}
