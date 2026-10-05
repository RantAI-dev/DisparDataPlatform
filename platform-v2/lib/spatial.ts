import { GCI_RESTAURANTS } from "@/lib/gci";
import { RESTAURANTS } from "@/lib/restaurants";
import { GOLF_COURSES } from "@/lib/golf";
import { SOUVENIR_SHOPS } from "@/lib/souvenir";
import { GMTI_PLACES } from "@/lib/gmti-data";
import { DATA_SECTIONS } from "@/lib/data-sections";
import { PILLAR_COLOR, PILLAR_LABEL } from "@/lib/gmti";
import SENI_VENUES from "@/lib/pariwisata/seni-venues.json";

export const SPATIAL_CATEGORIES = {
  gci: { label: "Restoran GCI", color: "#ed6b23", icon: '<path d="M4 3v6m3-6v6M4 6h3M5.5 9v12M16 3c-3 3-3 7 0 7h2V3m0 7v11"/>' },
  restaurants: { label: "Direktori Restoran", color: "#b45309", icon: '<path d="M3 5h14v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V5ZM17 6h2a3 3 0 0 1 0 6h-2M3 21h16"/>' },
  golf: { label: "Lapangan Golf", color: "#15803d", icon: '<path d="M7 21V3l11 4-11 4M3 21h10"/>' },
  souvenir: { label: "Toko Suvenir", color: "#a16207", icon: '<path d="M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9c-9-1-6-8-2-5l2 5Zm0 0c9-1 6-8 2-5l-2 5Z"/>' },
  budaya: { label: "Budaya", color: "#7c3aed", icon: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>' },
  hotel: { label: "Hotel", color: "#0369a1", icon: '<path d="M3 18V5M3 14h18v7M3 18h18M7 14V8h4v6M11 14V9h8a2 2 0 0 1 2 2v3"/>' },
  wisata: { label: "Destinasi lainnya", color: "#0891b2", icon: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>' },
  ibadah: { label: PILLAR_LABEL.ibadah, color: PILLAR_COLOR.ibadah, icon: '<path d="M4 21V10l-2-2 2-2 2 2-2 2M20 21V10l-2-2 2-2 2 2-2 2M7 21v-9h10v9M7 12c0-4 5-5 5-8 0 3 5 4 5 8M10 21v-4a2 2 0 0 1 4 0v4"/>' },
  makan: { label: PILLAR_LABEL.makan, color: PILLAR_COLOR.makan, icon: '<circle cx="12" cy="12" r="6"/><path d="M2 3v6m2-6v6M2 6h2M3 9v12M21 3v18M21 3c-3 2-3 7 0 7"/>' },
  menginap: { label: PILLAR_LABEL.menginap, color: PILLAR_COLOR.menginap, icon: '<path d="M3 18V5M3 14h18v7M3 18h18M7 14V8h4v6M11 14V9h8a2 2 0 0 1 2 2v3"/>' },
  destinasi: { label: PILLAR_LABEL.destinasi, color: PILLAR_COLOR.destinasi, icon: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>' },
  program: { label: PILLAR_LABEL.program, color: PILLAR_COLOR.program, icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18m-14 5 3 3 6-5"/>' },
} as const;

export type SpatialCategory = keyof typeof SPATIAL_CATEGORIES;
export const MUSLIM_CATEGORIES: SpatialCategory[] = ["ibadah", "makan", "menginap", "destinasi", "program"];
export type SpatialPoint = {
  id: string;
  name: string;
  category: SpatialCategory;
  city: string;
  address: string;
  lat?: number;
  lng?: number;
  href: string;
  kind?: string;
  cert?: string;
  source?: string;
};

export function spatialCity(value: string): string {
  const city = value.trim().toLowerCase();
  const names: Record<string, string> = {
    "central jakarta": "Jakarta Pusat", "south jakarta": "Jakarta Selatan",
    "north jakarta": "Jakarta Utara", "west jakarta": "Jakarta Barat",
    "east jakarta": "Jakarta Timur", "kepulauan seribu": "Kepulauan Seribu",
  };
  return names[city] ?? city.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Gunakan sumber yang sama dengan daftar; jangan membuat koordinat pengganti. */
export const SPATIAL_POINTS: SpatialPoint[] = [
  ...GCI_RESTAURANTS.map((r): SpatialPoint => ({ id: `gci-${r.id}`, name: r.name, category: "gci", city: spatialCity(r.city), address: r.address ?? r.area, lat: r.lat, lng: r.lng, href: DATA_SECTIONS.gci.href })),
  ...RESTAURANTS.map((r): SpatialPoint => ({ id: `restaurants-${r.id}`, name: r.name, category: "restaurants", city: spatialCity(r.city), address: r.address ?? r.area, lat: r.lat, lng: r.lng, href: DATA_SECTIONS.restaurants.href })),
  ...GOLF_COURSES.map((r): SpatialPoint => ({ id: `golf-${r.id}`, name: r.name, category: "golf", city: spatialCity(r.city), address: r.address ?? r.area, lat: r.lat, lng: r.lng, href: DATA_SECTIONS.golf.href })),
  ...SOUVENIR_SHOPS.map((r): SpatialPoint => ({ id: `souvenir-${r.id}`, name: r.name, category: "souvenir", city: spatialCity(r.city ?? ""), address: r.address ?? "", lat: r.lat, lng: r.lng, href: DATA_SECTIONS.souvenir.href })),
  ...SENI_VENUES.map((r, i): SpatialPoint => ({ id: `budaya-${i}`, name: r.venue, category: "budaya", city: spatialCity(r.wilayah), address: r.address, lat: r.lat ?? undefined, lng: r.lon ?? undefined, href: DATA_SECTIONS.pertunjukan.href })),
  ...GMTI_PLACES.map((r): SpatialPoint => ({ id: `gmti-${r.id}`, name: r.name, category: r.pillar, city: spatialCity(r.city ?? ""), address: r.address ?? "", lat: r.lat, lng: r.lon, href: r.href ?? "/gmti", kind: r.kind, cert: r.cert })),
];

export function spatialCategory(slug: string): SpatialCategory {
  if (/masjid|musala|mushalla|ibadah/.test(slug)) return "ibadah";
  if (/halal|muslim|islam/.test(slug)) {
    if (/hotel|menginap/.test(slug)) return "menginap";
    if (/restoran|makan|kuliner|rph/.test(slug)) return "makan";
    if (/program|inovasi|event/.test(slug)) return "program";
    return "destinasi";
  }
  if (/hotel|akomodasi/.test(slug)) return "hotel";
  if (/budaya|seni|museum|pertunjukan/.test(slug)) return "budaya";
  if (/golf/.test(slug)) return "golf";
  if (/suvenir|souvenir|oleh-oleh/.test(slug)) return "souvenir";
  if (/restoran|restaurant|kuliner/.test(slug)) return "restaurants";
  return "wisata";
}

export function hasSpatialCoordinates(p: SpatialPoint): p is SpatialPoint & { lat: number; lng: number } {
  return typeof p.lat === "number" && typeof p.lng === "number" && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);
}
