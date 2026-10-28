/**
 * Warna bersama (inventaris A §4.5). Palet khusus satu chart tinggal di builder opsinya
 * (utils/chart-options); di sini hanya yang dipakai lintas komponen.
 */

/** Palet oranye bertingkat untuk seri chart (DashboardKit.tsx, lintas dashboard pariwisata). */
export const PALETTE = ["#ed6b23", "#f0a13a", "#c2410c", "#f4a672", "#9a3412", "#fb923c"];

/**
 * Warna tetap per subsektor ekonomi kreatif — satu sumber untuk semua grafik
 * (PDRB Ekraf, Tenaga Kerja) agar subsektor yang sama selalu berwarna sama.
 */
const WARNA: Record<string, string> = {
  "aplikasi dan pengembang permainan": "#2563eb",
  arsitektur: "#64748b",
  "desain interior": "#0891b2",
  "desain komunikasi visual": "#7c3aed",
  "desain produk": "#db2777",
  fashion: "#e11d48",
  "film animasi dan video": "#f0a13a",
  fotografi: "#0d9488",
  kriya: "#a16207",
  kuliner: "#ed6b23",
  musik: "#9333ea",
  penerbitan: "#65a30d",
  periklanan: "#0e7c42",
  "seni pertunjukan": "#c2410c",
  "seni rupa": "#4f46e5",
  "televisi dan radio": "#0369a1",
};

/** Variasi penulisan nama (mis. dari sumber Kemenekraf) → kunci ternormalisasi di atas. */
const ALIAS: Record<string, string> = {
  "aplikasi dan game developer": "aplikasi dan pengembang permainan",
  "aplikasi game": "aplikasi dan pengembang permainan",
  "pengembang permainan": "aplikasi dan pengembang permainan",
  dkv: "desain komunikasi visual",
  "film animasi video": "film animasi dan video",
  "tv dan radio": "televisi dan radio",
  "televisi radio": "televisi dan radio",
};

export const SUBSEKTOR_FALLBACK = "#94a3b8";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Warna untuk nama subsektor (tak sensitif huruf besar/kecil & spasi); tak dikenal → abu-abu. */
export function warnaSubsektor(nama: string): string {
  const k = norm(nama);
  return WARNA[ALIAS[k] ?? k] ?? SUBSEKTOR_FALLBACK;
}

/** Pilar GMTI (lib/gmti.ts). */
export const PILLARS = ["ibadah", "makan", "menginap", "destinasi", "program"] as const;
export type Pillar = (typeof PILLARS)[number];

export const PILLAR_LABEL: Record<Pillar, string> = {
  ibadah: "Ibadah",
  makan: "Makan & minum",
  menginap: "Menginap",
  destinasi: "Destinasi & fasilitas",
  program: "Program dan Event",
};

export const PILLAR_COLOR: Record<Pillar, string> = {
  ibadah: "#0f7b6c",
  makan: "#ed6b23",
  menginap: "#7048b6",
  destinasi: "#1e6bb8",
  program: "#c2185b",
};

/** Kategori titik peta Spatial (lib/spatial.ts) beserta path ikon SVG-nya. */
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
