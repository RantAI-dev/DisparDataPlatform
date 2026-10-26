"""SQL fitur dashboard — disalin apa adanya dari platform-v2 `lib/dashboard/data.ts` @ 6b858eb
(inventaris B §1.1–1.7), termasuk `avg(rata_rata)` (Q2). Angka di-`toString()` di SQL lalu diubah
ke angka di `service.py`, sama dengan Next.js.

PDRB dan target RPJMD dibaca dari berkas Bronze (`bronze_file.*`), pengganti konstanta
`lib/dashboard/pdrb-ekraf.ts` dan `TARGET_WISMAN` (KONTRAK §2.2).
"""

from __future__ import annotations

from typing import Any

from data_api.shared import queries as sq
from data_api.shared.konteks import Konteks

Baris = list[dict[str, Any]]


def wisman_bulanan(k: Konteks) -> Baris:
    return k.q(
        """SELECT concat(toString(w.tahun), '-', leftPad(toString(w.bulan_no), 2, '0')) AS periode,
                toString(w.tahun) AS tahun,
                toString(w.bulan_no) AS bulan,
                toString(sum(w.jumlah)) AS jumlah
         FROM serving.mart_wisman w
         WHERE w.tahun >= 2024
         GROUP BY periode, tahun, bulan ORDER BY periode"""
    )


def wisman_negara(k: Konteks) -> Baris:
    return k.q(
        """SELECT concat(toString(w.tahun), '-', leftPad(toString(w.bulan_no), 2, '0')) AS periode, w.negara AS negara,
                toString(sum(w.jumlah)) AS jumlah
         FROM serving.mart_wisman w
         WHERE w.tahun >= 2024
         GROUP BY periode, negara ORDER BY periode"""
    )


def wisman_pintu(k: Konteks) -> Baris:
    return k.q(
        """SELECT toString(toYear(periode_data)) AS tahun, toString(semester) AS semester,
                pintu_masuk AS pintu, toString(sum(jumlah)) AS jumlah
         FROM silver.jumlah_wisatawan
         WHERE periode_data IS NOT NULL AND toYear(periode_data) >= 2024
         GROUP BY tahun, semester, pintu ORDER BY tahun, semester"""
    )


def lama_menginap(k: Konteks) -> Baris:
    return k.q(
        """SELECT formatDateTime(periode_data, '%Y-%m') AS periode, jenis_hotel, jenis_tamu,
              toString(avg(rata_rata)) AS rata
       FROM silver.data_rata_rata_lama_menginap_wisatawan_mancanegara_dan_wisatawan_nusantara_pada_hotel_berbintang_di_provinsi_dki_jakarta
       WHERE periode_data IS NOT NULL AND rata_rata IS NOT NULL
       GROUP BY periode, jenis_hotel, jenis_tamu ORDER BY periode"""
    )


def sertifikasi(k: Konteks) -> Baris:
    return k.q(
        """SELECT toString(periode_data) AS tahun,
              trimBoth(replaceRegexpAll(replaceRegexpAll(upper(bidang), '\\\\s+AMP\\\\s+', ' DAN '), '\\\\s+', ' ')) AS bidang,
              toString(sum(jumlah_peserta)) AS jumlah
       FROM (
         SELECT periode_data, bidang, jumlah_peserta FROM silver.jumlah_tenaga_kerja_pariwisata_dan_ekonomi_kreatif_yang_tersertifikasi
         UNION ALL
         SELECT periode_data, bidang, jumlah_peserta FROM silver.jumlah_tenaga_kerja_pariwisata_dan_ekonomi_kreatif_yang_tersertifikasi_tahun_2023_dan_2024
       )
       WHERE bidang IS NOT NULL
       GROUP BY tahun, bidang ORDER BY tahun"""
    )


def wisnus_kota(k: Konteks) -> Baris:
    return k.q(
        """SELECT formatDateTime(periode, '%Y-%m') AS periode, kota_tujuan AS kota, toString(sum(jumlah_perjalanan)) AS jumlah
       FROM silver.wisnus_perjalanan_per_kota_tujuan
       WHERE periode IS NOT NULL AND kota_tujuan IS NOT NULL
       GROUP BY periode, kota ORDER BY periode, kota"""
    )


def kunjungan_destinasi(k: Konteks) -> Baris:
    # sum() mengabaikan NULL dan memberi 0; NULL dipertahankan bila tak satu pun nilai dilaporkan.
    return k.q(
        """SELECT formatDateTime(periode_data, '%Y-%m') AS periode, obyek_wisata AS destinasi, jenis_wisatawan AS jenis,
              if(count(jumlah_kunjungan) = 0, NULL, toString(sum(jumlah_kunjungan))) AS jumlah
       FROM silver.jumlah_kunjungan_wisatawan_ke_obyek_wisata_menurut_lokasi_di_provinsi_dki_jakarta
       WHERE periode_data IS NOT NULL AND obyek_wisata IS NOT NULL AND jenis_wisatawan IS NOT NULL
       GROUP BY periode, destinasi, jenis ORDER BY periode, destinasi"""
    )


def pintu_bulanan(k: Konteks) -> Baris:
    return k.q(
        """SELECT formatDateTime(periode, '%Y-%m') AS periode, pintu_masuk AS pintu, toString(sum(jumlah_kunjungan)) AS jumlah
       FROM silver.wisman_per_pintu_masuk_bulanan_bps
       WHERE periode IS NOT NULL
       GROUP BY periode, pintu ORDER BY periode"""
    )


def tk_dki(k: Konteks) -> Baris:
    return k.q(
        """SELECT toString(toUInt16(tahun)) AS tahun,
                toString(sumIf(jumlah_tenaga_kerja, kode_wilayah = 31 AND jenis_kelamin = 'Total')) AS total,
                toString(sumIf(jumlah_tenaga_kerja, kode_wilayah = 31 AND jenis_kelamin = 'Laki-laki')) AS laki,
                toString(sumIf(jumlah_tenaga_kerja, kode_wilayah = 31 AND jenis_kelamin = 'Perempuan')) AS perempuan,
                toString(sumIf(jumlah_tenaga_kerja, jenis_kelamin = 'Total')) AS nasional
         FROM silver.tenaga_kerja_ekraf_per_provinsi
         WHERE tahun IS NOT NULL
         GROUP BY tahun ORDER BY tahun"""
    )


def tk_subsektor(k: Konteks) -> Baris:
    return k.q(
        """SELECT toString(toUInt16(tahun)) AS tahun, subsektor, toString(sum(jumlah_tenaga_kerja)) AS jumlah
         FROM silver.tenaga_kerja_ekraf_per_subsektor_nasional
         WHERE tahun IS NOT NULL AND subsektor IS NOT NULL
         GROUP BY tahun, subsektor ORDER BY tahun"""
    )


def bronze(k: Konteks, tabel: str) -> Baris:
    """`target_wisman`, `target_kontribusi_ekraf_rpjmd`, `pdrb_ekraf_makro`, `pdrb_ekraf_subsektor`."""
    return sq.baris_bronze_file(k, tabel)
