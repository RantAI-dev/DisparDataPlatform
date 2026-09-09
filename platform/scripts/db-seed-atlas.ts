/**
 * Seed data Atlas (sekunder, hasil pendataan lapangan GCI) ke DB platform.
 * Sumber = array in-code yang juga dipakai view Atlas, jadi DB & UI konsisten.
 *
 *   npx tsx --env-file=.env scripts/db-seed-atlas.ts
 *
 * Idempoten: CREATE TABLE IF NOT EXISTS + hapus-per-kind sebelum insert ulang.
 */
import postgres from "postgres";
import { GCI_RESTAURANTS } from "../lib/gci";
import { GCI_EVENTS } from "../lib/events";
import { GOLF_COURSES } from "../lib/golf";
import { RESTAURANTS } from "../lib/restaurants";
import { SOUVENIR_SHOPS } from "../lib/souvenir";
import { HOTEL_REGISTRY } from "../lib/hotel";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL belum di-set (lihat .env).");
const sql = postgres(url, { prepare: false });

type Row = {
  kind: string;
  ext_id: string;
  name: string;
  category: string | null;
  area: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  data: unknown;
};

const KINDS: {
  kind: string;
  title: string;
  description: string;
  rows: () => Row[];
}[] = [
  {
    kind: "gci",
    title: "Restoran GCI",
    description:
      "Seluruh restoran & kafe se-Jakarta (termasuk resto hotel bintang 3–4) untuk Global City Index.",
    rows: () =>
      GCI_RESTAURANTS.map((r) => ({
        kind: "gci",
        ext_id: r.id,
        name: r.name,
        category: r.cuisine ?? null,
        area: r.area ?? null,
        city: r.city ?? null,
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        data: r,
      })),
  },
  {
    kind: "events",
    title: "Pertunjukan & Budaya",
    description: "Konser, festival, tari, teater, seni rupa, film 2025–2026.",
    rows: () =>
      GCI_EVENTS.map((r) => ({
        kind: "events",
        ext_id: r.id,
        name: r.name,
        category: r.category ?? r.type ?? null,
        area: r.venue ?? null,
        city: "DKI Jakarta",
        lat: null,
        lng: null,
        data: r,
      })),
  },
  {
    kind: "golf",
    title: "Lapangan Golf",
    description: "Lapangan & driving range golf di Jakarta dan sekitarnya.",
    rows: () =>
      GOLF_COURSES.map((r) => ({
        kind: "golf",
        ext_id: r.id,
        name: r.name,
        category: r.kind ?? null,
        area: r.area ?? null,
        city: r.city ?? null,
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        data: r,
      })),
  },
  {
    kind: "restaurants",
    title: "Direktori Restoran",
    description:
      "Restoran & kafe pilihan Jakarta dengan sumber sitasi publik terverifikasi.",
    rows: () =>
      RESTAURANTS.map((r) => ({
        kind: "restaurants",
        ext_id: r.id,
        name: r.name,
        category: r.cuisine ?? null,
        area: r.area ?? null,
        city: r.city ?? null,
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        data: r,
      })),
  },
  {
    kind: "souvenir",
    title: "Toko Suvenir",
    description:
      "Toko suvenir, oleh-oleh & kerajinan Jakarta yang terdaftar di TripAdvisor.",
    rows: () =>
      SOUVENIR_SHOPS.map((r) => ({
        kind: "souvenir",
        ext_id: r.id,
        name: r.name,
        category: r.product ?? r.category ?? null,
        area: r.district ?? null,
        city: r.city ?? null,
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        data: r,
      })),
  },
  {
    kind: "hotel",
    title: "Hotel & Akomodasi",
    description:
      "Hotel berbintang DKI Jakarta (Rekapitulasi Usaha & Kamar Hotel, Satu Data Jakarta) — jumlah kamar, klasifikasi, wilayah.",
    rows: () =>
      HOTEL_REGISTRY.map((r, i) => ({
        kind: "hotel",
        ext_id: `hotel-${i + 1}`,
        name: r.nama,
        category: r.golongan ?? null,
        area: r.wilayah ?? null,
        city: "DKI Jakarta",
        lat: null,
        lng: null,
        data: r,
      })),
  },
];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS atlas_record (
      id         serial PRIMARY KEY,
      kind       text NOT NULL,
      ext_id     text NOT NULL,
      name       text NOT NULL,
      category   text,
      area       text,
      city       text,
      lat        double precision,
      lng        double precision,
      data       jsonb NOT NULL,
      synced_at  timestamp NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS atlas_record_kind_idx ON atlas_record (kind)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS atlas_record_kind_ext_id ON atlas_record (kind, ext_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS atlas_dataset (
      kind         text PRIMARY KEY,
      title        text NOT NULL,
      description  text DEFAULT '',
      total        integer NOT NULL DEFAULT 0,
      synced_at    timestamp NOT NULL DEFAULT now()
    )`;

  for (const k of KINDS) {
    const rows = k.rows();
    await sql`DELETE FROM atlas_record WHERE kind = ${k.kind}`;
    for (const batch of chunk(rows, 500)) {
      const values = batch.map((r) => ({
        kind: r.kind,
        ext_id: r.ext_id,
        name: r.name,
        category: r.category,
        area: r.area,
        city: r.city,
        lat: r.lat,
        lng: r.lng,
        // Record Atlas berisi optional field (undefined) → bukan JSONValue ketat;
        // sql.json meng-handle-nya saat serialisasi. Cast longgar agar tsc lolos.
        data: sql.json(r.data as never),
      }));
      await sql`INSERT INTO atlas_record ${sql(
        values,
        "kind",
        "ext_id",
        "name",
        "category",
        "area",
        "city",
        "lat",
        "lng",
        "data"
      )}`;
    }
    await sql`
      INSERT INTO atlas_dataset (kind, title, description, total, synced_at)
      VALUES (${k.kind}, ${k.title}, ${k.description}, ${rows.length}, now())
      ON CONFLICT (kind) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        total = EXCLUDED.total,
        synced_at = now()`;
    console.log(`  atlas_record[${k.kind}] ← ${rows.length} baris`);
  }

  const [{ count }] = await sql`SELECT count(*)::int AS count FROM atlas_record`;
  console.log(`Selesai. Total atlas_record: ${count} baris.`);
}

main()
  .then(() => sql.end())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e);
    await sql.end().catch(() => {});
    process.exit(1);
  });
