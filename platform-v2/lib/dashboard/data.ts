import { q } from "@/lib/ch/client";

/**
 * Data Dashboard Statistik (menu /dashboard) — dibaca langsung dari Silver.
 * Semua agregasi kecil dilakukan di ClickHouse; UInt64/Float dikonversi ke Number.
 */

export type Point = { label: string; value: number };

/** Target RPJMD 2025–2029 (Tabel III.2) indikator 2.1.c "Jumlah Tamu Mancanegara". */
export const TARGET_WISMAN: Record<string, number> = {
  "2025": 1286092,
  "2026": 1289257,
  "2027": 1594162,
  "2028": 1848874,
  "2029": 2105833,
  "2030": 2332494,
};

const safe = async <T>(p: Promise<T[]>): Promise<T[]> => {
  try {
    return await p;
  } catch (e) {
    console.error("[dashboard]", e);
    return [];
  }
};

export type WismanData = {
  /** Deret bulanan: periode "YYYY-MM". */
  bulanan: { periode: string; tahun: string; bulan: number; jumlah: number }[];
  /** Per negara per bulan. */
  negara: { periode: string; negara: string; jumlah: number }[];
  /** Per pintu masuk per semester (sumber hanya semesteran). */
  pintu: { tahun: string; semester: number; pintu: string; jumlah: number }[];
};

export async function getWisman(): Promise<WismanData> {
  const [bulanan, negara, pintu] = await Promise.all([
    safe(
      q<{ periode: string; tahun: string; bulan: string; jumlah: string }>(
        `SELECT formatDateTime(periode_data, '%Y-%m') AS periode,
                toString(toYear(periode_data)) AS tahun,
                toString(toMonth(periode_data)) AS bulan,
                toString(sum(jumlah_kunjungan)) AS jumlah
         FROM silver.wisman_jakarta_per_bulan
         WHERE periode_data IS NOT NULL AND toYear(periode_data) >= 2024
         GROUP BY periode, tahun, bulan ORDER BY periode`,
      ),
    ),
    safe(
      q<{ periode: string; negara: string; jumlah: string }>(
        `SELECT formatDateTime(periode_data, '%Y-%m') AS periode, negara,
                toString(sum(jumlah_kunjungan)) AS jumlah
         FROM silver.wisman_jakarta_per_negara
         WHERE periode_data IS NOT NULL AND toYear(periode_data) >= 2024 AND negara IS NOT NULL
         GROUP BY periode, negara ORDER BY periode`,
      ),
    ),
    safe(
      q<{ tahun: string; semester: string; pintu: string; jumlah: string }>(
        `SELECT toString(toYear(periode_data)) AS tahun, toString(semester) AS semester,
                pintu_masuk AS pintu, toString(sum(jumlah)) AS jumlah
         FROM silver.jumlah_wisatawan
         WHERE periode_data IS NOT NULL AND toYear(periode_data) >= 2024
         GROUP BY tahun, semester, pintu ORDER BY tahun, semester`,
      ),
    ),
  ]);
  return {
    bulanan: bulanan.map((r) => ({ periode: r.periode, tahun: r.tahun, bulan: Number(r.bulan), jumlah: Number(r.jumlah) })),
    negara: negara.map((r) => ({ periode: r.periode, negara: r.negara, jumlah: Number(r.jumlah) })),
    pintu: pintu.map((r) => ({ tahun: r.tahun, semester: Number(r.semester), pintu: r.pintu, jumlah: Number(r.jumlah) })),
  };
}

export type LosRow = { periode: string; jenisHotel: string; jenisTamu: "Wisman" | "Wisnus"; rataRata: number };

/**
 * Rata-rata lama menginap (hari) di hotel BINTANG per bulan, per kelas & jenis tamu.
 * Hotel non-bintang belum ada di lake — menunggu rekap internal.
 */
export async function getLamaMenginap(): Promise<LosRow[]> {
  const rows = await safe(
    q<{ periode: string; jenis_hotel: string; jenis_tamu: string; rata: string }>(
      `SELECT formatDateTime(periode_data, '%Y-%m') AS periode, jenis_hotel, jenis_tamu,
              toString(avg(rata_rata)) AS rata
       FROM silver.data_rata_rata_lama_menginap_wisatawan_mancanegara_dan_wisatawan_nusantara_pada_hotel_berbintang_di_provinsi_dki_jakarta
       WHERE periode_data IS NOT NULL AND rata_rata IS NOT NULL
       GROUP BY periode, jenis_hotel, jenis_tamu ORDER BY periode`,
    ),
  );
  return rows.map((r) => ({
    periode: r.periode,
    jenisHotel: r.jenis_hotel,
    jenisTamu: /MANCANEGARA/i.test(r.jenis_tamu) ? "Wisman" : "Wisnus",
    rataRata: Number(r.rata),
  }));
}

export type SertifikasiRow = { tahun: string; bidang: string; jumlah: number };

/** Tenaga kerja pariwisata & ekraf tersertifikasi (program Dinas), per tahun × bidang. */
export async function getSertifikasi(): Promise<SertifikasiRow[]> {
  const rows = await safe(
    q<{ tahun: string; bidang: string; jumlah: string }>(
      `SELECT toString(periode_data) AS tahun,
              trimBoth(replaceRegexpAll(replaceRegexpAll(upper(bidang), '\\\\s+AMP\\\\s+', ' DAN '), '\\\\s+', ' ')) AS bidang,
              toString(sum(jumlah_peserta)) AS jumlah
       FROM (
         SELECT periode_data, bidang, jumlah_peserta FROM silver.jumlah_tenaga_kerja_pariwisata_dan_ekonomi_kreatif_yang_tersertifikasi
         UNION ALL
         SELECT periode_data, bidang, jumlah_peserta FROM silver.jumlah_tenaga_kerja_pariwisata_dan_ekonomi_kreatif_yang_tersertifikasi_tahun_2023_dan_2024
       )
       WHERE bidang IS NOT NULL
       GROUP BY tahun, bidang ORDER BY tahun`,
    ),
  );
  return rows.map((r) => ({ tahun: r.tahun, bidang: r.bidang, jumlah: Number(r.jumlah) }));
}

export type WisnusRow = { periode: string; tahun: string; bulan: number; kota: string; jumlah: number };

/** Perjalanan wisnus bulanan per kota/kabupaten TUJUAN (BPS, dataset sekunder). */
export async function getWisnusKotaTujuan(): Promise<WisnusRow[]> {
  const rows = await safe(
    q<{ periode: string; kota: string; jumlah: string }>(
      `SELECT formatDateTime(periode, '%Y-%m') AS periode, kota_tujuan AS kota, toString(sum(jumlah_perjalanan)) AS jumlah
       FROM silver.wisnus_perjalanan_per_kota_tujuan
       WHERE periode IS NOT NULL AND kota_tujuan IS NOT NULL
       GROUP BY periode, kota ORDER BY periode, kota`,
    ),
  );
  return rows.map((r) => ({
    periode: r.periode,
    tahun: r.periode.slice(0, 4),
    bulan: Number(r.periode.slice(5, 7)),
    kota: r.kota,
    jumlah: Number(r.jumlah),
  }));
}

export type PintuBulananRow = { periode: string; pintu: string; jumlah: number };

/** Wisman bulanan per pintu masuk (BPS, dataset sekunder) — menggantikan data semesteran bila tersedia. */
export async function getPintuBulanan(): Promise<PintuBulananRow[]> {
  const rows = await safe(
    q<{ periode: string; pintu: string; jumlah: string }>(
      `SELECT formatDateTime(periode, '%Y-%m') AS periode, pintu_masuk AS pintu, toString(sum(jumlah_kunjungan)) AS jumlah
       FROM silver.wisman_per_pintu_masuk_bulanan_bps
       WHERE periode IS NOT NULL
       GROUP BY periode, pintu ORDER BY periode`,
    ),
  );
  return rows.map((r) => ({ periode: r.periode, pintu: r.pintu, jumlah: Number(r.jumlah) }));
}

export type TkEkraf = {
  /** DKI per tahun: total, laki-laki, perempuan, dan total nasional (jumlah seluruh provinsi). */
  dki: { tahun: string; total: number; laki: number; perempuan: number; nasional: number }[];
  /** Nasional per subsektor per tahun (rincian subsektor per provinsi belum dipublikasikan). */
  subsektorNasional: { tahun: string; subsektor: string; jumlah: number }[];
};

/** Tenaga kerja ekonomi kreatif — Satu Data Ekraf (Kemenekraf, olahan Sakernas BPS). */
export async function getTenagaKerjaEkraf(): Promise<TkEkraf> {
  const [dki, sub] = await Promise.all([
    safe(
      q<{ tahun: string; total: string; laki: string; perempuan: string; nasional: string }>(
        `SELECT toString(toUInt16(tahun)) AS tahun,
                toString(sumIf(jumlah_tenaga_kerja, kode_wilayah = 31 AND jenis_kelamin = 'Total')) AS total,
                toString(sumIf(jumlah_tenaga_kerja, kode_wilayah = 31 AND jenis_kelamin = 'Laki-laki')) AS laki,
                toString(sumIf(jumlah_tenaga_kerja, kode_wilayah = 31 AND jenis_kelamin = 'Perempuan')) AS perempuan,
                toString(sumIf(jumlah_tenaga_kerja, jenis_kelamin = 'Total')) AS nasional
         FROM silver.tenaga_kerja_ekraf_per_provinsi
         WHERE tahun IS NOT NULL
         GROUP BY tahun ORDER BY tahun`,
      ),
    ),
    safe(
      q<{ tahun: string; subsektor: string; jumlah: string }>(
        `SELECT toString(toUInt16(tahun)) AS tahun, subsektor, toString(sum(jumlah_tenaga_kerja)) AS jumlah
         FROM silver.tenaga_kerja_ekraf_per_subsektor_nasional
         WHERE tahun IS NOT NULL AND subsektor IS NOT NULL
         GROUP BY tahun, subsektor ORDER BY tahun`,
      ),
    ),
  ]);
  return {
    dki: dki.map((r) => ({ tahun: r.tahun, total: Number(r.total), laki: Number(r.laki), perempuan: Number(r.perempuan), nasional: Number(r.nasional) })),
    subsektorNasional: sub.map((r) => ({ tahun: r.tahun, subsektor: r.subsektor, jumlah: Number(r.jumlah) })),
  };
}
