-- 01-fungsi-periode.sql: Fungsi SQL global konform untuk dimensi periode (awalan kf_)

-- 1. Helper konversi bulan ke nomor 1..12
CREATE OR REPLACE FUNCTION kf_bulan_no AS (b) ->
  multiIf(
    b IS NULL, NULL,
    -- Nomor 1..12 baik sebagai String, Int, atau Float (misal '7', 7, 7.0, '07')
    match(trim(toString(b)), '^[0-9]+(\\.0+)?$')
      AND toInt32OrNull(toString(round(toFloat64OrNull(trim(toString(b)))))) BETWEEN 1 AND 12,
      toUInt8(round(toFloat64(trim(toString(b))))),
    -- Nama-nama bulan Indonesia dan singkatan umum
    lower(trim(toString(b))) IN ('januari', 'jan'), 1,
    lower(trim(toString(b))) IN ('februari', 'pebruari', 'feb'), 2,
    lower(trim(toString(b))) IN ('maret', 'mar'), 3,
    lower(trim(toString(b))) IN ('april', 'apr'), 4,
    lower(trim(toString(b))) IN ('mei', 'may'), 5,
    lower(trim(toString(b))) IN ('juni', 'jun'), 6,
    lower(trim(toString(b))) IN ('juli', 'jul'), 7,
    lower(trim(toString(b))) IN ('agustus', 'agt', 'agu', 'ags', 'aug'), 8,
    lower(trim(toString(b))) IN ('september', 'sep'), 9,
    lower(trim(toString(b))) IN ('oktober', 'okt', 'oct'), 10,
    lower(trim(toString(b))) IN ('november', 'nopember', 'nov', 'nop'), 11,
    lower(trim(toString(b))) IN ('desember', 'des', 'dec'), 12,
    NULL
  );

-- 2. Fungsi kf_periode_tahun(x)
-- Dari angka atau teks tahun 4 digit, atau dari Date/DateTime.
-- Nilai di luar 1990–2035, 'KOSONG', '2062026', dan teks tak dikenal -> NULL.
CREATE OR REPLACE FUNCTION kf_periode_tahun AS (x) ->
  multiIf(
    x IS NULL, NULL,
    -- Date atau DateTime (YYYY-MM-DD...)
    match(toString(x), '^[0-9]{4}-[0-9]{2}-[0-9]{2}'),
      if(toYear(toDateOrNull(substring(toString(x), 1, 10))) BETWEEN 1990 AND 2035,
         toString(toYear(toDateOrNull(substring(toString(x), 1, 10)))),
         NULL),
    -- Angka tahun 4 digit bulat (baik String, Int, atau Float seperti 2025.0)
    match(trim(toString(x)), '^[0-9]{4}(\\.0+)?$')
      AND toInt32OrNull(toString(round(toFloat64OrNull(trim(toString(x)))))) BETWEEN 1990 AND 2035,
      toString(toInt32(round(toFloat64(trim(toString(x)))))),
    NULL
  );

-- 3. Fungsi kf_periode_bulan(tahun, bulan)
-- Menghasilkan 'YYYY-MM' atau NULL jika tahun/bulan tidak sah.
CREATE OR REPLACE FUNCTION kf_periode_bulan AS (tahun, bulan) ->
  if(kf_periode_tahun(tahun) IS NULL OR kf_bulan_no(bulan) IS NULL,
     NULL,
     concat(kf_periode_tahun(tahun), '-', leftPad(toString(kf_bulan_no(bulan)), 2, '0')));

-- 4. Helper konversi semester ke nomor 1..2
CREATE OR REPLACE FUNCTION kf_semester_no AS (s) ->
  multiIf(
    s IS NULL, NULL,
    match(trim(toString(s)), '^[0-9]+(\\.0+)?$')
      AND toInt32OrNull(toString(round(toFloat64OrNull(trim(toString(s)))))) IN (1, 2),
      toUInt8(round(toFloat64(trim(toString(s))))),
    lower(trim(toString(s))) IN ('1', '01', 's1', 'semester 1', 'sem 1', 'semester i', 'sem i'), 1,
    lower(trim(toString(s))) IN ('2', '02', 's2', 'semester 2', 'sem 2', 'semester ii', 'sem ii'), 2,
    NULL
  );

-- 5. Fungsi kf_periode_semester(tahun, n)
-- Menghasilkan 'YYYY-S1' / 'YYYY-S2' atau NULL jika tidak sah.
CREATE OR REPLACE FUNCTION kf_periode_semester AS (tahun, n) ->
  if(kf_periode_tahun(tahun) IS NULL OR kf_semester_no(n) IS NULL,
     NULL,
     concat(kf_periode_tahun(tahun), '-S', toString(kf_semester_no(n))));

-- 6. Helper konversi triwulan ke nomor 1..4
CREATE OR REPLACE FUNCTION kf_triwulan_no AS (t) ->
  multiIf(
    t IS NULL, NULL,
    match(trim(toString(t)), '^[0-9]+(\\.0+)?$')
      AND toInt32OrNull(toString(round(toFloat64OrNull(trim(toString(t)))))) BETWEEN 1 AND 4,
      toUInt8(round(toFloat64(trim(toString(t))))),
    lower(trim(toString(t))) IN ('1', '01', 't1', 'q1', 'triwulan 1', 'triwulan i', 'tw 1', 'tw i'), 1,
    lower(trim(toString(t))) IN ('2', '02', 't2', 'q2', 'triwulan 2', 'triwulan ii', 'tw 2', 'tw ii'), 2,
    lower(trim(toString(t))) IN ('3', '03', 't3', 'q3', 'triwulan 3', 'triwulan iii', 'tw 3', 'tw iii'), 3,
    lower(trim(toString(t))) IN ('4', '04', 't4', 'q4', 'triwulan 4', 'triwulan iv', 'tw 4', 'tw iv'), 4,
    NULL
  );

-- 7. Fungsi kf_periode_triwulan(tahun, n)
-- Menghasilkan 'YYYY-T1'..'YYYY-T4' atau NULL jika tidak sah.
CREATE OR REPLACE FUNCTION kf_periode_triwulan AS (tahun, n) ->
  if(kf_periode_tahun(tahun) IS NULL OR kf_triwulan_no(n) IS NULL,
     NULL,
     concat(kf_periode_tahun(tahun), '-T', toString(kf_triwulan_no(n))));

-- 8. Fungsi kf_periode_hari(d)
-- Menghasilkan 'YYYY-MM-DD' atau NULL jika di luar 1990-01-01 s/d 2035-12-31,
-- atau jika tanggal tidak sah / tergulung (round-trip check).
CREATE OR REPLACE FUNCTION kf_periode_hari AS (d) ->
  multiIf(
    d IS NULL, NULL,
    toDateOrNull(substring(toString(d), 1, 10)) IS NOT NULL
      AND toString(toDate(toDateOrNull(substring(toString(d), 1, 10)))) = substring(toString(d), 1, 10)
      AND toDate(toDateOrNull(substring(toString(d), 1, 10))) >= toDate('1990-01-01')
      AND toDate(toDateOrNull(substring(toString(d), 1, 10))) <= toDate('2035-12-31'),
      substring(toString(d), 1, 10),
    NULL
  );
