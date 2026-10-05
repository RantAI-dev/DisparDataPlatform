import { NextResponse } from "next/server";
import { q } from "@/lib/ch/client";
import { catalog } from "@/lib/ch/store";
import { hasSpatialCoordinates, spatialCategory, spatialCity, type SpatialPoint } from "@/lib/spatial";

export const revalidate = 300;
export const maxDuration = 120;

// Hanya tabel katalog publik di Silver dan mart Hotel POC yang sudah dipublikasikan.
// Nama SQL berasal dari metadata server, bukan parameter pengguna, dan divalidasi.
const identifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const PAGE = 2000;

export async function GET() {
  try {
    const datasets = await catalog();
    const schemas = await q<{ database: string; table: string; columns: string[] }>(
      `SELECT database, table, groupArray(name) AS columns FROM system.columns
       WHERE database = 'silver' OR (database = 'serving' AND table = 'mart_hotel_scraped_booking')
       GROUP BY database, table`,
    );
    const sources = datasets.filter((d) => typeof d.table_name === "string" && identifier.test(d.table_name)).map((d) => ({
      database: "silver", table: d.table_name, slug: d.slug, title: d.title, href: `/sdi/${encodeURIComponent(d.slug)}`,
    }));
    sources.push({ database: "serving", table: "mart_hotel_scraped_booking", slug: "hotel-poc", title: "Hotel POC", href: "/scraped-hotels" });
    const points: SpatialPoint[] = [];
    const failed: string[] = [];
    const inventory: { slug: string; coordinates: number }[] = [];
    const seenTables = new Set<string>();

    for (const source of sources) {
      const ref = `${source.database}.${source.table}`;
      if (seenTables.has(ref)) continue;
      seenTables.add(ref);
      const schema = schemas.find((s) => s.database === source.database && s.table === source.table);
      if (!schema) continue;
      const pick = (names: string[]) => names.map((n) => schema.columns.find((c) => c.toLowerCase() === n && identifier.test(c))).find(Boolean);
      const lat = pick(["lat", "latitude", "lintang"]);
      const lng = pick(["lon", "lng", "longitude", "bujur", "long"]);
      if (!lat || !lng) continue;
      const name = pick(["nama", "name", "nama_usaha", "nama_dagang", "nama_tempat", "nama_hotel", "hotel_name", "venue", "nama_masjid"]);
      const city = pick(["kota", "city", "wilayah", "kabupaten_kota", "kota_administrasi"]);
      const address = pick(["alamat", "address", "formatted_address"]);
      const field = (column: string | undefined) => column ? `toString(\`${column}\`)` : "''";
      let count = 0;
      try {
        for (let offset = 0; ; offset += PAGE) {
          const rows = await q<{ name: string; city: string; address: string; lat: number | null; lng: number | null }>(
            `SELECT DISTINCT name, city, address, lat, lng FROM (
             SELECT ${field(name)} AS name, ${field(city)} AS city, ${field(address)} AS address,
             toFloat64OrNull(toString(\`${lat}\`)) AS lat, toFloat64OrNull(toString(\`${lng}\`)) AS lng
             FROM ${source.database}.\`${source.table}\`)
             WHERE isNotNull(lat) AND isNotNull(lng)
             ORDER BY lat, lng, name, city, address LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
            { limit: PAGE, offset },
          );
          for (const [i, r] of rows.entries()) {
            const point: SpatialPoint = {
              id: `lake-${source.slug}-${offset + i}`, name: r.name || source.title,
              category: spatialCategory(source.slug), city: spatialCity(r.city || ""), address: r.address || "",
              lat: r.lat ?? undefined, lng: r.lng ?? undefined, href: source.href, source: source.title,
            };
            if (hasSpatialCoordinates(point)) { points.push(point); count++; }
          }
          if (rows.length < PAGE) break;
        }
        inventory.push({ slug: source.slug, coordinates: count });
      } catch {
        failed.push(source.slug);
      }
    }
    return NextResponse.json({ points, inventory, failed, complete: failed.length === 0 });
  } catch {
    return NextResponse.json({ points: [], inventory: [], failed: [], complete: false, error: "Sumber titik lakehouse belum dapat dimuat." }, { status: 503 });
  }
}
