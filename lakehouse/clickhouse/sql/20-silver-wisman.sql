-- Silver kurasi: riwayat Soekarno-Hatta + dataset SDI kebangsaan terbaru.
-- Dataset terbaru tidak merinci pintu masuk; jangan melabelinya Soekarno-Hatta.
-- Untuk negara/bulan yang tumpang tindih, sumber terbaru menjadi acuan.
--
-- Baris yang kebangsaan-nya tak terpetakan ke dim_negara TIDAK dibuang — masuk
-- ke silver.wisman_karantina supaya bisa ditinjau, bukan hilang diam-diam.

CREATE DATABASE IF NOT EXISTS silver;

CREATE OR REPLACE VIEW silver.wisman AS
WITH src AS (
    SELECT
        r.kebangsaan AS kebangsaan_asli,
        toFloat64(r.wisman) AS jumlah,
        tahun_dari(r.periode_data) AS tahun,
        b.nomor AS bulan_no,
        kunci_cocok(r.kebangsaan) AS k_negara,
        'Soekarno-Hatta' AS pintu_masuk,
        1 AS prioritas
    FROM silver.data_jumlah_kunjungan_dan_ranking_wisatawan_mancanegara_ke_provinsi_dki_jakarta_melalui_pintu_soekarno_hatta_berdasarkan_kebangsaan r
    LEFT JOIN (SELECT match_key, nomor FROM silver.dim_bulan FINAL) b
        ON b.match_key = kunci_cocok(r.bulan)
    WHERE r.wisman IS NOT NULL
    UNION ALL
    SELECT
        kebangsaan AS kebangsaan_asli,
        toFloat64(jumlah_kunjungan) AS jumlah,
        tahun_dari(periode_data) AS tahun,
        toMonth(tanggal_id(toString(periode_data))) AS bulan_no,
        kunci_cocok(kebangsaan) AS k_negara,
        'Tidak dirinci' AS pintu_masuk,
        2 AS prioritas
    FROM silver.data_jumlah_wisatawan_mancanegara_berdasarkan_kebangsaan
    WHERE jumlah_kunjungan IS NOT NULL
), dipetakan AS (
    SELECT
        n.kode_iso3 AS kode_negara,
        n.nama_negara AS negara,
        n.kawasan AS kawasan,
        src.bulan_no AS bulan_no,
        b.nama_bulan AS bulan,
        src.tahun AS tahun,
        src.pintu_masuk AS pintu_masuk,
        src.jumlah AS jumlah,
        src.kebangsaan_asli AS kebangsaan_asli,
        row_number() OVER (
            PARTITION BY n.kode_iso3, src.tahun, src.bulan_no
            ORDER BY src.prioritas DESC, src.kebangsaan_asli
        ) AS urutan
    FROM src
    INNER JOIN (SELECT match_key, kode_iso3, nama_negara, kawasan FROM silver.dim_negara FINAL) n
        ON n.match_key = src.k_negara
    LEFT JOIN (SELECT nomor, any(nama_bulan) AS nama_bulan FROM silver.dim_bulan FINAL GROUP BY nomor) b
        ON b.nomor = src.bulan_no
)
SELECT
    kode_negara, negara, kawasan, bulan_no, bulan, tahun,
    pintu_masuk, jumlah, kebangsaan_asli
FROM dipetakan WHERE urutan = 1;

-- Baris yang gagal dipetakan ke negara kanonik — untuk ditinjau, bukan dibuang.
CREATE OR REPLACE VIEW silver.wisman_karantina AS
SELECT DISTINCT kebangsaan AS kebangsaan_tak_terpetakan
FROM (
    SELECT kebangsaan
    FROM silver.data_jumlah_kunjungan_dan_ranking_wisatawan_mancanegara_ke_provinsi_dki_jakarta_melalui_pintu_soekarno_hatta_berdasarkan_kebangsaan
    UNION ALL
    SELECT kebangsaan FROM silver.data_jumlah_wisatawan_mancanegara_berdasarkan_kebangsaan
)
WHERE kebangsaan IS NOT NULL
  AND kunci_cocok(kebangsaan) NOT IN (SELECT match_key FROM silver.dim_negara FINAL);
