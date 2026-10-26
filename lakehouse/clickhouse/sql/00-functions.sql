-- Fungsi konversi untuk lapisan Silver.
-- Dipasang lewat scripts/apply-sql.sh (bukan lewat /docker-entrypoint-initdb.d,
-- karena itu hanya jalan sekali saat volume masih kosong).

-- Nilai "kosong" di data SDI datang dalam banyak samaran.
CREATE OR REPLACE FUNCTION bersih_teks AS (s) ->
  if(s IS NULL, NULL,
    if(lower(trim(s)) IN ('', '-', '--', 'n/a', 'na', 'null', 'nil', 'tad', '.',
                          '#n/a', 'tidak ada data', 'tidak ada', 'belum ada data'),
       NULL, trim(s)));

-- Angka format Indonesia: '1.234,56' → 1234.56, '1.234' → 1234 (titik = ribuan).
-- Titik diperlakukan sebagai pemisah ribuan HANYA bila polanya benar-benar
-- berkelompok tiga; kalau tidak, dibiarkan apa adanya supaya '1.5' tetap 1.5.
CREATE OR REPLACE FUNCTION angka_id AS (s) ->
  toFloat64OrNull(
    replaceAll(
      if(match(bersih_teks(s), '^-?[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$'),
         replaceAll(bersih_teks(s), '.', ''),
         bersih_teks(s)),
      ',', '.'));

-- Koordinat (lintang/bujur): titik SELALU desimal, koma juga desimal. angka_id
-- membaca '-6.033' sebagai -6033 karena polanya mirip ribuan; koordinat tidak
-- pernah memakai pemisah ribuan. Nilai rusak ('-6.357.216.667') jadi NULL.
CREATE OR REPLACE FUNCTION koordinat_id AS (s) ->
  toFloat64OrNull(replaceAll(bersih_teks(s), ',', '.'));

CREATE OR REPLACE FUNCTION bilangan_id AS (s) -> toInt64OrNull(toString(round(angka_id(s))));

CREATE OR REPLACE FUNCTION bulan_id AS (b) ->
  indexOf(['januari','februari','maret','april','mei','juni','juli','agustus',
           'september','oktober','november','desember'], lower(b));

-- Tanggal mentah: hasil bisa di luar jangkauan wajar, dijaga oleh tanggal_id.
CREATE OR REPLACE FUNCTION tanggal_id_raw AS (s) ->
  multiIf(
    bersih_teks(s) IS NULL, NULL,
    match(bersih_teks(s), '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'),
      toDateOrNull(substring(bersih_teks(s), 1, 10)),
    match(bersih_teks(s), '^[0-9]{4}-(0?[1-9]|1[0-2])$'),
      toDateOrNull(concat(splitByChar('-', bersih_teks(s))[1], '-',
                          leftPad(splitByChar('-', bersih_teks(s))[2], 2, '0'), '-01')),
    match(lower(bersih_teks(s)), '^(0?[1-9]|[12][0-9]|3[01]) [a-z]+ [0-9]{4}$')
      AND bulan_id(splitByChar(' ', bersih_teks(s))[2]) > 0,
      toDateOrNull(concat(
        splitByChar(' ', bersih_teks(s))[3], '-',
        leftPad(toString(bulan_id(splitByChar(' ', bersih_teks(s))[2])), 2, '0'), '-',
        leftPad(splitByChar(' ', bersih_teks(s))[1], 2, '0'))),
    match(bersih_teks(s), '^(19|20)[0-9]{2}(0[1-9]|1[0-2])$'),
      toDateOrNull(concat(substring(bersih_teks(s),1,4), '-', substring(bersih_teks(s),5,2), '-01')),
    match(bersih_teks(s), '^(19|20)[0-9]{2}$'),
      toDateOrNull(concat(bersih_teks(s), '-01-01')),
    match(bersih_teks(s), '^[0-9]{1,2}[/-](0?[1-9]|1[0-2])[/-][0-9]{4}$'),
      toDateOrNull(concat(
        splitByRegexp('[/-]', bersih_teks(s))[3], '-',
        leftPad(splitByRegexp('[/-]', bersih_teks(s))[2], 2, '0'), '-',
        leftPad(splitByRegexp('[/-]', bersih_teks(s))[1], 2, '0'))),
    NULL);

-- Pengaman ganda. ClickHouse memetakan tanggal tak sah (mis. '2026-01-32',
-- '31 Februari') ke 1970-01-01 alih-alih gagal — hasilnya tampil sebagai data
-- sah padahal salah urai, jenis kesalahan paling berbahaya di pipeline ini.
-- Maka 1970-01-01 diperlakukan sebagai penanda gagal, KECUALI input memang
-- menyebut tahun 1970.
-- Hari yang DITULIS di input (0 bila input tidak menyebut hari).
CREATE OR REPLACE FUNCTION hari_ditulis AS (s) ->
  multiIf(
    match(bersih_teks(s), '^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}'),
      toInt32OrZero(splitByChar('-', substring(bersih_teks(s), 1, 10))[3]),
    match(lower(bersih_teks(s)), '^[0-9]{1,2} [a-z]+ [0-9]{4}$'),
      toInt32OrZero(splitByChar(' ', bersih_teks(s))[1]),
    match(bersih_teks(s), '^[0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{4}$'),
      toInt32OrZero(splitByRegexp('[/-]', bersih_teks(s))[1]),
    0);

CREATE OR REPLACE FUNCTION tanggal_id AS (s) ->
  multiIf(
    tanggal_id_raw(s) IS NULL, NULL,
    tanggal_id_raw(s) NOT BETWEEN toDate('1900-01-01') AND toDate('2100-01-01'), NULL,
    tanggal_id_raw(s) = toDate('1970-01-01')
      AND position(coalesce(bersih_teks(s), ''), '1970') = 0, NULL,
    -- Validasi pulang-pergi: '31 Februari' digulung ClickHouse jadi 3 Maret.
    -- Kalau hari hasil urai tidak sama dengan hari yang ditulis, itu bukan
    -- tanggal yang sah.
    hari_ditulis(s) > 0 AND toDayOfMonth(tanggal_id_raw(s)) != hari_ditulis(s), NULL,
    tanggal_id_raw(s));

-- Ekstrak TAHUN dari periode_data yang tipenya bisa berbeda antar tabel:
-- Date ('2026-04-01'), tahun-polos (Float64 2014, hasil auto-typer), atau
-- YYYYMM. toString → tanggal_id menormalkan semuanya jadi Date, lalu toYear.
-- Menghindari 'Illegal type Float64 of toYear' saat periode_data berupa angka.
CREATE OR REPLACE FUNCTION tahun_dari AS (x) -> toYear(tanggal_id(toString(x)));

-- Normalisasi teks untuk pencocokan dimensi: huruf kecil, tanpa tanda baca,
-- spasi tunggal. Dipakai menjodohkan nama negara/pintu masuk yang ejaannya kacau.
CREATE OR REPLACE FUNCTION kunci_cocok AS (s) ->
  trimBoth(replaceRegexpAll(lower(coalesce(bersih_teks(s), '')), '[^a-z0-9]+', ' '));
