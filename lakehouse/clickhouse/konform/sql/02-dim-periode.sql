-- 02-dim-periode.sql: Tabel dimensi periode 5-tingkat (1990-2035)

CREATE OR REPLACE TABLE {{db}}.dim_periode
ENGINE = MergeTree
ORDER BY (tingkat, tahun, periode_id)
AS
SELECT
    periode_id,
    tingkat,
    tahun,
    semester,
    triwulan,
    bulan_no,
    tanggal_awal,
    tanggal_akhir,
    label
FROM (
    -- Tingkat 1: tahun (46 baris)
    SELECT
        toString(y) AS periode_id,
        'tahun' AS tingkat,
        toUInt16(y) AS tahun,
        CAST(NULL, 'Nullable(UInt8)') AS semester,
        CAST(NULL, 'Nullable(UInt8)') AS triwulan,
        CAST(NULL, 'Nullable(UInt8)') AS bulan_no,
        toDate(concat(toString(y), '-01-01')) AS tanggal_awal,
        toDate(concat(toString(y), '-12-31')) AS tanggal_akhir,
        toString(y) AS label
    FROM (SELECT toUInt16(1990 + number) AS y FROM numbers(46)) AS t_tahun

    UNION ALL

    -- Tingkat 2: semester (92 baris)
    SELECT
        concat(toString(y), '-S', toString(s)) AS periode_id,
        'semester' AS tingkat,
        toUInt16(y) AS tahun,
        toUInt8(s) AS semester,
        CAST(NULL, 'Nullable(UInt8)') AS triwulan,
        CAST(NULL, 'Nullable(UInt8)') AS bulan_no,
        if(s = 1, toDate(concat(toString(y), '-01-01')), toDate(concat(toString(y), '-07-01'))) AS tanggal_awal,
        if(s = 1, toDate(concat(toString(y), '-06-30')), toDate(concat(toString(y), '-12-31'))) AS tanggal_akhir,
        concat('Semester ', toString(s), ' ', toString(y)) AS label
    FROM (SELECT toUInt16(1990 + number) AS y FROM numbers(46)) AS t_th
    CROSS JOIN (SELECT toUInt8(number + 1) AS s FROM numbers(2)) AS t_sm

    UNION ALL

    -- Tingkat 3: triwulan (184 baris)
    SELECT
        concat(toString(y), '-T', toString(t)) AS periode_id,
        'triwulan' AS tingkat,
        toUInt16(y) AS tahun,
        toUInt8(if(t <= 2, 1, 2)) AS semester,
        toUInt8(t) AS triwulan,
        CAST(NULL, 'Nullable(UInt8)') AS bulan_no,
        multiIf(
            t = 1, toDate(concat(toString(y), '-01-01')),
            t = 2, toDate(concat(toString(y), '-04-01')),
            t = 3, toDate(concat(toString(y), '-07-01')),
            toDate(concat(toString(y), '-10-01'))
        ) AS tanggal_awal,
        multiIf(
            t = 1, toDate(concat(toString(y), '-03-31')),
            t = 2, toDate(concat(toString(y), '-06-30')),
            t = 3, toDate(concat(toString(y), '-09-30')),
            toDate(concat(toString(y), '-12-31'))
        ) AS tanggal_akhir,
        concat('Triwulan ', toString(t), ' ', toString(y)) AS label
    FROM (SELECT toUInt16(1990 + number) AS y FROM numbers(46)) AS t_th2
    CROSS JOIN (SELECT toUInt8(number + 1) AS t FROM numbers(4)) AS t_tw

    UNION ALL

    -- Tingkat 4: bulan (552 baris)
    SELECT
        concat(toString(y), '-', leftPad(toString(m), 2, '0')) AS periode_id,
        'bulan' AS tingkat,
        toUInt16(y) AS tahun,
        toUInt8(if(m <= 6, 1, 2)) AS semester,
        toUInt8(intDiv(m - 1, 3) + 1) AS triwulan,
        toUInt8(m) AS bulan_no,
        toStartOfMonth(toDate(concat(toString(y), '-', leftPad(toString(m), 2, '0'), '-01'))) AS tanggal_awal,
        toLastDayOfMonth(toDate(concat(toString(y), '-', leftPad(toString(m), 2, '0'), '-01'))) AS tanggal_akhir,
        concat(['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][m], ' ', toString(y)) AS label
    FROM (SELECT toUInt16(1990 + number) AS y FROM numbers(46)) AS t_th3
    CROSS JOIN (SELECT toUInt8(number + 1) AS m FROM numbers(12)) AS t_bl

    UNION ALL

    -- Tingkat 5: hari (16801 baris)
    SELECT
        toString(d) AS periode_id,
        'hari' AS tingkat,
        toYear(d) AS tahun,
        toUInt8(if(toMonth(d) <= 6, 1, 2)) AS semester,
        toUInt8(intDiv(toMonth(d) - 1, 3) + 1) AS triwulan,
        toUInt8(toMonth(d)) AS bulan_no,
        d AS tanggal_awal,
        d AS tanggal_akhir,
        concat(toString(toDayOfMonth(d)), ' ', ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][toMonth(d)], ' ', toString(toYear(d))) AS label
    FROM (SELECT toDate('1990-01-01') + number AS d FROM numbers(16801)) AS t_hr
);
