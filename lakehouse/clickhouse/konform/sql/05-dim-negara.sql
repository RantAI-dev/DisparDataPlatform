-- 05-dim-negara.sql
-- Dimensi negara ISO 3166-1 alpha-3, kamus pencocokan kunci negara, dan daftar ambigu.

CREATE OR REPLACE TABLE {{db}}.dim_negara
ENGINE = MergeTree
ORDER BY (kode)
AS
SELECT
    trimBoth(coalesce(kode, '')) AS kode,
    trimBoth(coalesce(kode_iso2, '')) AS kode_iso2,
    trimBoth(coalesce(nama, '')) AS nama,
    trimBoth(coalesce(nama_inggris, '')) AS nama_inggris,
    trimBoth(coalesce(kawasan, '')) AS kawasan,
    trimBoth(coalesce(jenis, '')) AS jenis
FROM {{ref:ref_negara_iso3166}};

CREATE OR REPLACE TABLE {{db}}.dim_negara_ambigu
ENGINE = MergeTree
ORDER BY (kunci)
AS
WITH semua_kunci AS (
    SELECT DISTINCT
        assumeNotNull(kunci) AS kunci,
        kode
    FROM (
        SELECT
            kunci_cocok(nama) AS kunci,
            kode
        FROM {{db}}.dim_negara
        WHERE kunci_cocok(nama) != ''

        UNION ALL

        SELECT
            kunci_cocok(nama_inggris) AS kunci,
            kode
        FROM {{db}}.dim_negara
        WHERE kunci_cocok(nama_inggris) != ''

        UNION ALL

        SELECT
            kunci_cocok(kode) AS kunci,
            kode
        FROM {{db}}.dim_negara
        WHERE kunci_cocok(kode) != ''

        UNION ALL

        SELECT
            kunci_cocok(coalesce(alias, '')) AS kunci,
            trimBoth(coalesce(kode, '')) AS kode
        FROM {{ref:ref_negara_alias}}
        WHERE kunci_cocok(coalesce(alias, '')) != ''
    )
    WHERE kunci != ''
)
SELECT
    kunci,
    groupArray(kode) AS daftar_kode,
    count() AS jml_kode
FROM semua_kunci
GROUP BY kunci
HAVING count() > 1;

CREATE OR REPLACE TABLE {{db}}.dim_negara_kunci
ENGINE = MergeTree
ORDER BY (kunci)
AS
WITH semua_kunci AS (
    SELECT DISTINCT
        assumeNotNull(kunci) AS kunci,
        kode
    FROM (
        SELECT
            kunci_cocok(nama) AS kunci,
            kode
        FROM {{db}}.dim_negara
        WHERE kunci_cocok(nama) != ''

        UNION ALL

        SELECT
            kunci_cocok(nama_inggris) AS kunci,
            kode
        FROM {{db}}.dim_negara
        WHERE kunci_cocok(nama_inggris) != ''

        UNION ALL

        SELECT
            kunci_cocok(kode) AS kunci,
            kode
        FROM {{db}}.dim_negara
        WHERE kunci_cocok(kode) != ''

        UNION ALL

        SELECT
            kunci_cocok(coalesce(alias, '')) AS kunci,
            trimBoth(coalesce(kode, '')) AS kode
        FROM {{ref:ref_negara_alias}}
        WHERE kunci_cocok(coalesce(alias, '')) != ''
    )
    WHERE kunci != ''
)
SELECT
    kunci,
    any(kode) AS kode
FROM semua_kunci
GROUP BY kunci
HAVING count() = 1;
