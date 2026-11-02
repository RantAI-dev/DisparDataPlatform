/**
 * Khusus galeri /_kerangka (dihapus di plan 17): kepadatan per kecamatan dari titik golden, dengan
 * point-in-polygon yang sama dengan GmtiMapView v2. Di produksi angka ini dihitung Data API
 * (`kepadatan_berkoordinat` di /v1/spasial), bukan di browser.
 */
type Ring = number[][];
type Poly = { bbox: [number, number, number, number]; rings: Ring[] };
type Fitur = { properties: { kecamatan: string }; geometry: { type: string; coordinates: unknown } };

const geoKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function toPolys(g: Fitur["geometry"]): Poly[] {
  const polys = g.type === "Polygon" ? [g.coordinates as Ring[]] : g.type === "MultiPolygon" ? (g.coordinates as Ring[][]) : [];
  return polys.map((rings) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of (rings[0] ?? []) as [number, number][]) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
    return { bbox: [a, b, c, d], rings };
  });
}

function inPoly(x: number, y: number, p: Poly): boolean {
  const [a, b, c, d] = p.bbox;
  if (x < a || x > c || y < b || y > d) return false;
  if (!inRing(x, y, p.rings[0]!)) return false;
  for (let i = 1; i < p.rings.length; i++) if (inRing(x, y, p.rings[i]!)) return false;
  return true;
}

export function hitungKepadatan(points: { category: string; lat: number; lng: number }[], features: Fitur[]) {
  const polys = features.map((f) => ({ key: geoKey(f.properties.kecamatan), polys: toPolys(f.geometry) }));
  const m: Record<string, { total: number; byCat: Record<string, number> }> = {};
  for (const p of points) {
    const hit = polys.find((f) => f.polys.some((pl) => inPoly(p.lng, p.lat, pl)));
    if (!hit) continue;
    const c = (m[hit.key] ??= { total: 0, byCat: {} });
    c.total++;
    c.byCat[p.category] = (c.byCat[p.category] ?? 0) + 1;
  }
  return m;
}
