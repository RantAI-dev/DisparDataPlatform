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
