/** Konstanta tampilan fitur indikator (v2 @ 464fc15), dengan sumbernya. */

/** components/FrameworkView.tsx:16-20 dan IndexContext.tsx:8-12 */
export const STATUS = {
  ready: { label: "Ready", bg: "#e8f5ee", fg: "#0e7c42" },
  partial: { label: "Partial", bg: "#fff6e9", fg: "#b5651d" },
  gap: { label: "Gap", bg: "#fdecec", fg: "#b3261e" },
} as const;
export const STATUS_DATA = {
  punya: { label: "Punya", bg: "#e8f5ee", fg: "#0e7c42" },
  proksi: { label: "Proksi", bg: "#fff6e9", fg: "#b5651d" },
  belum: { label: "Belum ada", bg: "#fdecec", fg: "#b3261e" },
} as const;

/** Titik warna kartu ringkasan FrameworkView.tsx:62-67 (per label). */
export const DOT_RINGKASAN: Record<string, string | undefined> = { "DATA ADA": "#f0a13a", READY: "#4ade80", PARTIAL: "#fbbf24", GAP: "#f87171" };

/** Teks halaman framework: app/gci/page.tsx:15-16, app/gpci/page.tsx:8-9. */
export const JUDUL_FRAMEWORK = {
  GCI: {
    title: "Kesiapan Data Indikator GCI",
    subtitle: "Status kesiapan data Dispar untuk mengisi tiap indikator GCI (Kearney) — sumber dataset, tren, dan gap.",
  },
  GPCI: {
    title: "Mori — Global Power City Index (GPCI)",
    subtitle: "Fungsi Cultural Interaction + konektivitas (Accessibility) pariwisata. Kesiapan data Dispar untuk mengisi indikator GPCI.",
  },
} as const;

/** Kartu "Dataset GCI/GPCI" (components/FrameworkDataLinks.tsx:9-45), per href halaman. */
export const KARTU_DATASET: Record<string, { description: string; unit: string; icon: string }> = {
  "/gci/pariwisata/restoran-gci": {
    description: "Seluruh restoran & kafe se-Jakarta (termasuk resto hotel bintang 3–4) untuk Global City Index — dengan tier, rating, harga.",
    unit: "entri",
    icon: '<path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11" /><path d="M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4m0-9v18" />',
  },
  "/gci/pariwisata/direktori-restoran": {
    description: "Restoran & kafe pilihan Jakarta dengan sumber sitasi publik terverifikasi.",
    unit: "entri",
    icon: '<path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9L12 3z" />',
  },
  "/gci/pariwisata/pertunjukan-budaya": {
    description: "Konser, festival, tari, teater, seni rupa, dan film 2025–2026.",
    unit: "entri",
    icon: '<path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" />',
  },
  "/sdi/michelin-keys-indonesia": {
    description: "Hotel & resor peraih MICHELIN Key 2026 se-Indonesia (1–3 Key), lengkap dengan lokasi dan sumber verifikasi.",
    unit: "hotel",
    icon: '<circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 9.2-9.2M17 6l3 3M14 9l2 2" />',
  },
  "/gpci/lapangan-golf": {
    description: "Lapangan & driving range golf di Jakarta dan sekitarnya.",
    unit: "entri",
    icon: '<path d="M12 18V4l7 3-7 3" /><path d="M7 21c0-1.7 2.2-3 5-3s5 1.3 5 3" />',
  },
  "/gpci/toko-suvenir": {
    description: "Toko suvenir, oleh-oleh & kerajinan dari TripAdvisor, ditandai mana yang benar-benar toko suvenir.",
    unit: "listing",
    icon: '<path d="M3 8h18l-1.4 11.2A2 2 0 0 1 17.6 21H6.4a2 2 0 0 1-2-1.8L3 8z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" />',
  },
  "/gpci/hotel": {
    description: "Pasokan kamar, okupansi (TPK), dan lama menginap hotel berbintang — data resmi Satu Data Jakarta / BPS.",
    unit: "hotel",
    icon: '<path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 8h3a1 1 0 0 1 1 1v12" /><path d="M8 7h.01M11 7h.01M8 11h.01M11 11h.01M8 15h.01M11 15h.01" />',
  },
};

/** Catatan kriteria per indikator (components/indicators/{Ce2,Ce3,CiFv}.tsx, C §4.4). */
export const MOM_NOTE: Record<string, string> = {
  CE2: "Kearney saat ini hanya mengakui data restoran <b>Michelin Star</b> dan <b>TripAdvisor</b>; data Google belum diakui. Karena belum ada restoran Michelin Star di Jakarta, indikator ini dihitung dari data <b>TripAdvisor</b>.",
  CE3: "Kearney hanya mengakui event seni/pertunjukan yang menghadirkan artis <b>Top 10 Global Chart</b> (Billboard/Spotify) selama <b>5 tahun berturut-turut</b>.",
  "CI-FV": "Menampilkan total wisatawan <b>per bulan</b> dan <b>per pintu masuk</b>, selain per kebangsaan. Klasifikasi negara pada data BPS telah distandarkan.",
};

/** Warna blok batang setengah lebar, berurutan (BaMice/CiIc/CiHr/CiNl: skala, kota). */
export const WARNA_BATANG_SETENGAH = ["#0e7c42", "#e8a33d"];

/** Target RPJMD 2025–2029, indikator 2.1.c (components/pariwisata/WismanDashboard.tsx:31-39). */
export const TARGET_WISMAN: Record<string, number> = {
  "2025": 1286092,
  "2026": 1289257,
  "2027": 1594162,
  "2028": 1848874,
  "2029": 2105833,
  "2030": 2332494,
};
export const KONDISI_AWAL_WISMAN = 1273358;

const BULAN_PARSE = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
/** YYYYMM / YYYY-MM / MM → "Mmm 'YY" atau "Mmm" (lib/pariwisata/parse.ts bulanLabel). */
export function bulanLabel(periode: unknown): string {
  const s = String(periode ?? "").replace(/[^0-9]/g, "");
  if (s.length >= 6) {
    const m = parseInt(s.slice(4, 6), 10);
    return `${BULAN_PARSE[m] ?? s.slice(4, 6)} '${s.slice(2, 4)}`;
  }
  return BULAN_PARSE[parseInt(s, 10)] ?? s;
}

/** Data pendukung halaman seni pertunjukan (app/gci/pariwisata/seni-pertunjukan/page.tsx:23-27). */
export const PENDUKUNG_SENI = [
  { slug: "data-penyelenggaraan-event-pariwisata-dan-budaya-dki-jakarta", label: "Penyelenggaraan Event Pariwisata & Budaya" },
  { slug: "data-event-pariwisata-dan-kebudayaan-dki-jakarta-2011-2019", label: "Event Pariwisata & Kebudayaan 2011–2019" },
  { slug: "data-rekomendasi-penyelenggaraan-pertunjukan-musik", label: "Rekomendasi Penyelenggaraan Pertunjukan Musik" },
];
/** Judul tabel peringkat (CHARTS, page.tsx:37-40), berurutan seperti `tabel[1..]` respons. */
export const CHART_ARTIS = ["Billboard Year-End Top Artists", "Spotify Global Year-End"];
