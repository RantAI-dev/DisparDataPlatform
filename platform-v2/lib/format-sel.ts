/**
 * Format sel tabel dataset (halaman /sdi/[slug] dan SdiTable).
 *
 * Teks berisi angka saja (> 4 digit) ditampilkan dengan pemisah ribuan id-ID,
 * kecuali bila itu pengenal: nilai berawalan 0 (telepon, kode ber-nol depan)
 * dan kolom pengenal (NIB, telepon, kode, KBLI, NIK, NPWP) ditampilkan apa
 * adanya. Tanpa pengecualian ini NIB "0222010232817" tampil "222.010.232.817".
 */
const KOLOM_PENGENAL = /(^|_)(nib|kbli|kode|telepon|telp|hp|kontak|nik|npwp|id)(_|$)/i;

export function fmtCell(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  if (/^\d{5,}$/.test(s) && !s.startsWith("0") && !KOLOM_PENGENAL.test(key)) {
    return Number(s).toLocaleString("id-ID");
  }
  return s;
}
