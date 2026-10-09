import raw from "@/data/gci-gpci-indicators.json";

/**
 * Katalog indikator pariwisata GCI (Kearney) & GPCI (Mori) + pemetaan ke data.
 * SUMBER KEBENARAN = data/gci-gpci-indicators.json (28 indikator).
 * Divalidasi dari sheet: gci-gpci-pariwisata-sheet.tsv.
 *
 * Untuk mengubah/menambah indikator: edit JSON-nya (bukan file ini).
 */
export type Readiness = "ready" | "partial" | "gap";

export type Indicator = {
  framework: "GCI" | "GPCI";
  dimension: string;
  group: string;
  code: string;
  /** Nomor indikator di dokumen rujukan resmi (GPCI 2025, tabel Methodology). */
  officialNo?: number;
  name: string;
  definition: string;
  /** OPD pemilik data (bisa DISPAREKRAF atau lintas-OPD). */
  owner: string;
  /** Apakah Dispar punya data (langsung/proksi) untuk indikator ini. */
  dataAvailable: boolean;
  /** Readiness draft manual dari sheet (divalidasi Mas Maulana). */
  draftReadiness: Readiness;
  /** Kata kunci (lowercase) untuk mencocokkan JUDUL dataset di tabel `dataset`. */
  match: string[];
  /** Regex nama kolom ukuran untuk menarik nilai terbaru (opsional). */
  measure: string | null;
  note: string;
};

export const INDICATORS = raw as Indicator[];

export const READINESS_ORDER: Record<Readiness, number> = {
  gap: 0,
  partial: 1,
  ready: 2,
};
