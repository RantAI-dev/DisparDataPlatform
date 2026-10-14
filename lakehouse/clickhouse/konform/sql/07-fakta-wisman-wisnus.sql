-- 07-fakta-wisman-wisnus.sql
-- Fakta perintis: wisman dan wisnus beserta view penampung nilai tak cocok (tc_*).

CREATE OR REPLACE VIEW {{db}}.f_wisman_bulanan AS
SELECT
    assumeNotNull(kf_periode_bulan(toYear(assumeNotNull(periode_data)), toMonth(assumeNotNull(periode_data)))) AS periode_id,
    'wisman_jakarta_per_bulan' AS sumber,
    toFloat64(assumeNotNull(jumlah_kunjungan)) AS jumlah
FROM silver.wisman_jakarta_per_bulan;

CREATE OR REPLACE VIEW {{db}}.f_wisman_negara_bulanan AS
SELECT
    assumeNotNull(kf_periode_bulan(toYear(assumeNotNull(periode_data)), toMonth(assumeNotNull(periode_data)))) AS periode_id,
    'wisman_jakarta_per_negara' AS sumber,
    assumeNotNull(negara) AS negara_asli,
    cast(k.kode, 'Nullable(String)') AS kode_negara,
    toFloat64(assumeNotNull(jumlah_kunjungan)) AS jumlah
FROM silver.wisman_jakarta_per_negara s
LEFT JOIN {{db}}.dim_negara_kunci k ON k.kunci = kunci_cocok(s.negara)

UNION ALL

SELECT
    assumeNotNull(kf_periode_bulan(toYear(assumeNotNull(periode_data)), toMonth(assumeNotNull(periode_data)))) AS periode_id,
    'data_jumlah_wisatawan_mancanegara_berdasarkan_kebangsaan' AS sumber,
    assumeNotNull(kebangsaan) AS negara_asli,
    cast(k.kode, 'Nullable(String)') AS kode_negara,
    toFloat64(assumeNotNull(jumlah_kunjungan)) AS jumlah
FROM silver.data_jumlah_wisatawan_mancanegara_berdasarkan_kebangsaan s
LEFT JOIN {{db}}.dim_negara_kunci k ON k.kunci = kunci_cocok(s.kebangsaan);

CREATE OR REPLACE VIEW {{db}}.f_wisman_pintu_bulanan AS
SELECT
    assumeNotNull(kf_periode_bulan(toYear(assumeNotNull(periode_data)), toMonth(assumeNotNull(periode_data)))) AS periode_id,
    'wisman_jakarta_per_pintu_masuk' AS sumber,
    assumeNotNull(pintu_masuk) AS pintu_asli,
    cast(k.kode, 'Nullable(String)') AS kode_pintu,
    toFloat64(assumeNotNull(jumlah_kunjungan)) AS jumlah
FROM silver.wisman_jakarta_per_pintu_masuk s
LEFT JOIN {{db}}.dim_pintu_masuk_kunci k ON k.kunci = kunci_cocok(s.pintu_masuk)

UNION ALL

SELECT
    assumeNotNull(kf_periode_bulan(toYear(assumeNotNull(periode)), toMonth(assumeNotNull(periode)))) AS periode_id,
    'wisman_per_pintu_masuk_bulanan_bps' AS sumber,
    assumeNotNull(pintu_masuk) AS pintu_asli,
    cast(k.kode, 'Nullable(String)') AS kode_pintu,
    toFloat64(assumeNotNull(jumlah_kunjungan)) AS jumlah
FROM silver.wisman_per_pintu_masuk_bulanan_bps s
LEFT JOIN {{db}}.dim_pintu_masuk_kunci k ON k.kunci = kunci_cocok(s.pintu_masuk);

CREATE OR REPLACE VIEW {{db}}.f_target_wisman AS
SELECT
    assumeNotNull(kf_periode_tahun(toInt32(assumeNotNull(tahun)))) AS periode_id,
    'target_wisman' AS sumber,
    toFloat64(assumeNotNull(target_wisman)) AS target,
    assumeNotNull(dasar_hukum) AS dasar_hukum
FROM silver.target_wisman;

CREATE OR REPLACE VIEW {{db}}.f_wisnus_kota_bulanan AS
SELECT
    assumeNotNull(kf_periode_bulan(toYear(assumeNotNull(periode)), toMonth(assumeNotNull(periode)))) AS periode_id,
    'wisnus_perjalanan_per_kota_tujuan' AS sumber,
    assumeNotNull(kota_tujuan) AS kota_asli,
    cast(k.kode, 'Nullable(String)') AS kode_wilayah,
    toFloat64(assumeNotNull(jumlah_perjalanan)) AS jumlah
FROM silver.wisnus_perjalanan_per_kota_tujuan s
LEFT JOIN {{db}}.dim_wilayah_kunci k
    ON k.tingkat IN ('kabkota', 'provinsi')
   AND k.kunci_induk = ''
   AND k.kunci = kf_kunci_wilayah(s.kota_tujuan);

-- ── View Nilai Tak Cocok (tc_*) ──────────────────────────────────────────────

CREATE OR REPLACE VIEW {{db}}.tc_f_wisman_negara_bulanan AS
SELECT
    'f_wisman_negara_bulanan' AS fakta,
    'kode_negara' AS kolom,
    assumeNotNull(negara_asli) AS nilai_asli,
    count() AS baris
FROM {{db}}.f_wisman_negara_bulanan
WHERE kode_negara IS NULL
GROUP BY negara_asli;

CREATE OR REPLACE VIEW {{db}}.tc_f_wisman_pintu_bulanan AS
SELECT
    'f_wisman_pintu_bulanan' AS fakta,
    'kode_pintu' AS kolom,
    assumeNotNull(pintu_asli) AS nilai_asli,
    count() AS baris
FROM {{db}}.f_wisman_pintu_bulanan
WHERE kode_pintu IS NULL
GROUP BY pintu_asli;

CREATE OR REPLACE VIEW {{db}}.tc_f_wisnus_kota_bulanan AS
SELECT
    'f_wisnus_kota_bulanan' AS fakta,
    'kode_wilayah' AS kolom,
    assumeNotNull(kota_asli) AS nilai_asli,
    count() AS baris
FROM {{db}}.f_wisnus_kota_bulanan
WHERE kode_wilayah IS NULL
GROUP BY kota_asli;
