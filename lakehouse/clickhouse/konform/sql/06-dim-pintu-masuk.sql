-- 06-dim-pintu-masuk.sql
-- Dimensi pintu masuk wisatawan mancanegara dan kamus pencocokan kuncinya.

CREATE OR REPLACE TABLE {{db}}.dim_pintu_masuk
ENGINE = MergeTree
ORDER BY (kode)
AS
SELECT
    trimBoth(kode) AS kode,
    trimBoth(nama) AS nama,
    trimBoth(moda) AS moda,
    nullIf(trimBoth(kode_provinsi), '') AS kode_provinsi
FROM {{ref:ref_pintu_masuk}};

CREATE OR REPLACE TABLE {{db}}.dim_pintu_masuk_kunci
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
        FROM {{db}}.dim_pintu_masuk

        UNION ALL

        SELECT
            kunci_cocok(kode) AS kunci,
            kode
        FROM {{db}}.dim_pintu_masuk

        UNION ALL

        SELECT
            kunci_cocok(arrayJoin(splitByChar('|', alias))) AS kunci,
            kode
        FROM {{ref:ref_pintu_masuk}}
    )
    WHERE kunci != ''
)
SELECT
    kunci,
    any(kode) AS kode
FROM semua_kunci
GROUP BY kunci;
