-- 04-dim-wilayah.sql
-- Dimensi wilayah Kemendagri, kamus kunci wilayah, dan daftar kunci ambigu.

CREATE OR REPLACE TABLE {{db}}.dim_wilayah
ENGINE = MergeTree
ORDER BY (tingkat, kode)
AS
WITH raw AS (
    SELECT
        trimBoth(kode) AS kode,
        trimBoth(nama) AS nama,
        trimBoth(tingkat) AS tingkat,
        nullIf(trimBoth(kode_induk), '') AS kode_induk
    FROM {{ref:ref_wilayah_kemendagri}}
),
kabkota_lookup AS (
    SELECT kode, nama FROM raw WHERE tingkat = 'kabkota'
),
kecamatan_lookup AS (
    SELECT kode, nama FROM raw WHERE tingkat = 'kecamatan'
)
SELECT
    r.kode AS kode,
    r.nama AS nama,
    r.tingkat AS tingkat,
    r.kode_induk AS kode_induk,
    splitByChar('.', r.kode)[1] AS kode_provinsi,
    if(length(splitByChar('.', r.kode)) >= 2,
       concat(splitByChar('.', r.kode)[1], '.', splitByChar('.', r.kode)[2]),
       NULL) AS kode_kabkota,
    if(length(splitByChar('.', r.kode)) >= 3,
       concat(splitByChar('.', r.kode)[1], '.', splitByChar('.', r.kode)[2], '.', splitByChar('.', r.kode)[3]),
       NULL) AS kode_kecamatan,
    nullIf(kk.nama, '') AS nama_kabkota,
    nullIf(kc.nama, '') AS nama_kecamatan,
    if(startsWith(r.kode, '31'), toUInt8(1), toUInt8(0)) AS di_dki
FROM raw AS r
LEFT JOIN kabkota_lookup AS kk ON kk.kode = if(length(splitByChar('.', r.kode)) >= 2, concat(splitByChar('.', r.kode)[1], '.', splitByChar('.', r.kode)[2]), '')
LEFT JOIN kecamatan_lookup AS kc ON kc.kode = if(length(splitByChar('.', r.kode)) >= 3, concat(splitByChar('.', r.kode)[1], '.', splitByChar('.', r.kode)[2], '.', splitByChar('.', r.kode)[3]), '');

CREATE OR REPLACE TABLE {{db}}.dim_wilayah_ambigu
ENGINE = MergeTree
ORDER BY (tingkat, kunci, kunci_induk)
AS
WITH semua_kunci AS (
    SELECT DISTINCT
        tingkat,
        assumeNotNull(kunci) AS kunci,
        assumeNotNull(kunci_induk) AS kunci_induk,
        kode
    FROM (
        -- 1. Nama resmi dengan awalan
        SELECT
            tingkat,
            kf_kunci_wilayah(nama) AS kunci,
            '' AS kunci_induk,
            kode
        FROM {{db}}.dim_wilayah
        WHERE kf_kunci_wilayah(nama) IS NOT NULL

        UNION ALL

        -- 2. Nama resmi tanpa awalan (kab/kota)
        SELECT
            tingkat,
            kf_kunci_wilayah(replaceRegexpOne(nama, '^(Kota Administrasi|Kabupaten Administrasi|Kota|Kabupaten)\\s+', '')) AS kunci,
            '' AS kunci_induk,
            kode
        FROM {{db}}.dim_wilayah
        WHERE tingkat IN ('kabkota', 'provinsi')

        UNION ALL

        -- 3. Kelurahan dengan induk kecamatan
        SELECT
            'kelurahan' AS tingkat,
            kf_kunci_wilayah(nama) AS kunci,
            kf_kunci_wilayah(nama_kecamatan) AS kunci_induk,
            kode
        FROM {{db}}.dim_wilayah
        WHERE tingkat = 'kelurahan'
          AND kf_kunci_wilayah(nama) IS NOT NULL
          AND kf_kunci_wilayah(nama_kecamatan) IS NOT NULL

        UNION ALL

        -- 4. Dari berkas alias
        SELECT
            tingkat,
            kf_kunci_wilayah(alias) AS kunci,
            '' AS kunci_induk,
            kode
        FROM {{ref:ref_wilayah_alias}}
        WHERE kf_kunci_wilayah(alias) IS NOT NULL
    )
    WHERE kunci IS NOT NULL AND kunci != ''
)
SELECT
    tingkat,
    kunci,
    kunci_induk,
    groupArray(kode) AS daftar_kode,
    count() AS jml_kode
FROM semua_kunci
GROUP BY tingkat, kunci, kunci_induk
HAVING count() > 1;

CREATE OR REPLACE TABLE {{db}}.dim_wilayah_kunci
ENGINE = MergeTree
ORDER BY (tingkat, kunci, kunci_induk)
AS
WITH semua_kunci AS (
    SELECT DISTINCT
        tingkat,
        assumeNotNull(kunci) AS kunci,
        assumeNotNull(kunci_induk) AS kunci_induk,
        kode
    FROM (
        -- 1. Nama resmi dengan awalan
        SELECT
            tingkat,
            kf_kunci_wilayah(nama) AS kunci,
            '' AS kunci_induk,
            kode
        FROM {{db}}.dim_wilayah
        WHERE kf_kunci_wilayah(nama) IS NOT NULL

        UNION ALL

        -- 2. Nama resmi tanpa awalan (kab/kota)
        SELECT
            tingkat,
            kf_kunci_wilayah(replaceRegexpOne(nama, '^(Kota Administrasi|Kabupaten Administrasi|Kota|Kabupaten)\\s+', '')) AS kunci,
            '' AS kunci_induk,
            kode
        FROM {{db}}.dim_wilayah
        WHERE tingkat IN ('kabkota', 'provinsi')

        UNION ALL

        -- 3. Kelurahan dengan induk kecamatan
        SELECT
            'kelurahan' AS tingkat,
            kf_kunci_wilayah(nama) AS kunci,
            kf_kunci_wilayah(nama_kecamatan) AS kunci_induk,
            kode
        FROM {{db}}.dim_wilayah
        WHERE tingkat = 'kelurahan'
          AND kf_kunci_wilayah(nama) IS NOT NULL
          AND kf_kunci_wilayah(nama_kecamatan) IS NOT NULL

        UNION ALL

        -- 4. Dari berkas alias
        SELECT
            tingkat,
            kf_kunci_wilayah(alias) AS kunci,
            '' AS kunci_induk,
            kode
        FROM {{ref:ref_wilayah_alias}}
        WHERE kf_kunci_wilayah(alias) IS NOT NULL
    )
    WHERE kunci IS NOT NULL AND kunci != ''
)
SELECT
    tingkat,
    kunci,
    kunci_induk,
    any(kode) AS kode
FROM semua_kunci
GROUP BY tingkat, kunci, kunci_induk
HAVING count() = 1;
