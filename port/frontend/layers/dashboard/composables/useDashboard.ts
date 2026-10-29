/** Endpoint fitur dashboard (KONTRAK §2.2), satu fungsi per endpoint. Bentuk = data-api.openapi.yaml. */
type Titik = { label: string; value: number };
type Kpi = { label: string; value: string | number; sub?: string | null; delta?: number | null };
type Seri = { name: string; data: Titik[] };
export type Jenis = "wisnus" | "wisman";

export type WismanTahunan = {
  data_tersedia: { dari: string; sampai: string };
  tahun: { tahun: string; label: string; jumlah: number; target: number | null }[];
  tahun_default: string;
  kpi: Kpi[];
};
export type WismanBulanan = {
  rows: { periode: string; jumlah: number }[];
  yoy: { kategori: string[]; seri: Seri[] };
  pertumbuhan: { periode: string; persen: number }[];
  periode: string;
  kpi: Kpi[];
};
export type Komposisi = { label: string; items: Titik[] };
export type PintuMasuk = Komposisi & { sumber: "bps_bulanan" | "sdi_semester"; semester: string | null };
export type LosRataRata = Record<Jenis, { periode: string; nilai: number }[]>;
export type LosPerKelas = { periode_list: string[]; periode: string | null; label: string | null; tabel: { header: string[]; rows: string[][] } };
export type WisnusMeta = { kota: string[]; tahun: string[]; tahun_hilang_teks: string | null; tahun_default: string };
export type DestinasiMeta = { tahun: { value: string; label: string }[]; tahun_default: string; destinasi: string[] };
export type DestinasiRingkasan = { kpi: Kpi[]; catatan: string[] };
export type PerDestinasi = { label: string; items: { destinasi: string; jumlah: number; persen: number | null; bulan: number }[] };
export type PdrbMakro = {
  sumber: string;
  rows: {
    periode: string;
    label: string;
    adhb_ekraf: number;
    adhk_ekraf: number;
    kontribusi_pct: number;
    tumbuh_ekraf_pct: number;
    tumbuh_non_ekraf_pct: number;
    tumbuh_dki_pct: number;
  }[];
  kontribusi_vs_target: { label: string; capaian: number | null; target: number | null }[];
  target_kontribusi: { tahun: string; target_pct: number }[];
};
export type PdrbSebaran = {
  periode_list: string[];
  periode: string;
  label: string;
  distribusi: { label: string; nama: string; pct: number }[];
  nilai_top10: Titik[];
};
export type PdrbPertumbuhan = { periode_list: string[]; periode: string; label: string; items: Titik[] };

export function useDashboard() {
  const api = useApi();
  const d = <T>(jalur: string, query?: Record<string, string | number | undefined>) => api<T>(`dashboard/${jalur}`, query).then((r) => r.data);
  return {
    ringkasan: () => d<{ kpi: Kpi[] }>("ringkasan"),
    wismanTahunan: () => d<WismanTahunan>("wisman/tahunan"),
    wismanBulanan: (periode?: string) => d<WismanBulanan>("wisman/bulanan", { periode }),
    wismanKebangsaan: (q: { tahun?: string; periode?: string }) => d<Komposisi>("wisman/kebangsaan", { ...q, top: 8 }),
    wismanPintuMasuk: (q: { tahun?: string; periode?: string }) => d<PintuMasuk>("wisman/pintu-masuk", q),
    losRataRata: () => d<LosRataRata>("lama-menginap/rata-rata"),
    losPerKelas: (tamu: Jenis, periode?: string) => d<LosPerKelas>("lama-menginap/per-kelas", { tamu, periode }),
    losSeri: (tamu: Jenis) => d<{ seri: Seri[] }>("lama-menginap/seri", { tamu }),
    wisnusMeta: () => d<WisnusMeta>("wisnus/meta"),
    wisnusTahunan: (kota?: string) => d<{ tahun: Titik[]; kpi: Kpi[] }>("wisnus/tahunan", { kota }),
    wisnusPerKota: (tahun: string) => d<Komposisi>("wisnus/per-kota", { tahun }),
    wisnusBulanan: (kota?: string) => d<{ seri: Seri[] }>("wisnus/bulanan", { kota }),
    wisnusYoy: (kota?: string) => d<{ kategori: string[]; seri: Seri[]; pertumbuhan: { periode: string; persen: number }[] }>("wisnus/yoy", { kota }),
    destinasiMeta: (jenis: Jenis) => d<DestinasiMeta>("destinasi/meta", { jenis }),
    destinasiRingkasan: (jenis: Jenis, tahun: string, destinasi?: string) => d<DestinasiRingkasan>("destinasi/ringkasan", { jenis, tahun, destinasi }),
    destinasiPerDestinasi: (jenis: Jenis, tahun: string) => d<PerDestinasi>("destinasi/per-destinasi", { jenis, tahun }),
    destinasiBulanan: (jenis: Jenis, destinasi?: string) => d<{ items: Titik[] }>("destinasi/bulanan", { jenis, destinasi }),
    tkDki: () => d<{ rows: { tahun: string; total: number; porsi_pct: number | null; laki: number; perempuan: number }[]; kpi: Kpi[] }>("tenaga-kerja/dki"),
    tkSubsektor: (tahun?: string) => d<{ tahun_list: string[]; tahun: string; items: Titik[] }>("tenaga-kerja/subsektor", { tahun }),
    tkSertifikasi: () => d<{ per_tahun: Titik[]; bidang: string[]; seri: Seri[] }>("tenaga-kerja/sertifikasi"),
    pdrbMakro: () => d<PdrbMakro>("pdrb-ekraf/makro"),
    pdrbSebaran: (periode: string) => d<PdrbSebaran>("pdrb-ekraf/subsektor/sebaran", { periode }),
    pdrbPertumbuhan: (periode: string) => d<PdrbPertumbuhan>("pdrb-ekraf/subsektor/pertumbuhan", { periode }),
  };
}
