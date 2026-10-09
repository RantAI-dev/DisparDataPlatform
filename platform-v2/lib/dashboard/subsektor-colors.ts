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
