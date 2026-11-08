/** Konstanta tampilan dashboard (teks/warna tulisan tangan v2 @ 464fc15), dengan sumbernya. */
import { BULAN } from "../shared/utils/format";

/** components/dashboard/WismanStat.tsx:34-38 — warna tetap per pintu masuk. */
export const PINTU_COLORS: Record<string, string> = {
  "Soekarno-Hatta": "#0e7c42",
  "Halim Perdana Kusuma": "#ed6b23",
  "Tanjung Priok": "#2563eb",
};

/** components/dashboard/WismanStat.tsx:44-54 — warna tetap per negara. */
export const NEGARA_COLORS: Record<string, string> = {
  Tiongkok: "#0e7c42",
  Malaysia: "#ed6b23",
  Singapura: "#f0a13a",
  Jepang: "#2563eb",
  "Korea Selatan": "#7c3aed",
  "Amerika Serikat": "#0891b2",
  Australia: "#e11d48",
  India: "#65a30d",
  "Arab Saudi": "#0d9488",
};

/** Warna deret year-on-year (WismanStat.tsx:190, WisnusStat.tsx:166). */
export const WARNA_YOY = ["#f4a672", "#ed6b23", "#0e7c42"];

/** app/dashboard/tenaga-kerja/page.tsx (DATA_SUMBER) — dataset sumber yang tampil sebagai tabel di bawah grafik. */
export const TK_DATA_SUMBER = [
  { slug: "tenaga-kerja-ekraf-per-provinsi", title: "Tenaga kerja ekraf per provinsi (Kemenekraf)" },
  { slug: "tenaga-kerja-ekraf-per-subsektor-nasional", title: "Tenaga kerja ekraf per subsektor, nasional (Kemenekraf)" },
  { slug: "sebaran-pelaku-ekraf-jakarta", title: "Pelaku ekraf DKI terdaftar di EKRAF Hub" },
  {
    slug: "jumlah-tenaga-kerja-pariwisata-dan-ekonomi-kreatif-yang-tersertifikasi-tahun-2023-dan-2024",
    title: "Tenaga kerja pariwisata & ekraf tersertifikasi 2023–2024 (SDI)",
  },
  {
    slug: "jumlah-tenaga-kerja-pariwisata-dan-ekonomi-kreatif-yang-tersertifikasi",
    title: "Tenaga kerja pariwisata & ekraf tersertifikasi (SDI)",
  },
];

/** WisnusStat.tsx:13-14 */
export const SEMUA_KOTA = "Semua kota";
export const SELURUH_JAKARTA = "Seluruh Jakarta";
/** DestinasiStat.tsx:12-13 */
export const SEMUA_DESTINASI = "Semua destinasi";
export const NAMA_JENIS = { wisnus: "wisatawan nusantara", wisman: "wisatawan mancanegara" } as const;

/** "2024-01" → "Jan 2024" (labelBulan v2). */
export const labelBulan = (periode: string) => {
  const [y, m] = periode.split("-");
  return `${BULAN[Number(m) - 1] ?? m} ${y}`;
};
