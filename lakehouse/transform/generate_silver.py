"""Pembangkit lapisan Silver otomatis.

Untuk setiap tabel Bronze, sampel nilai tiap kolom, tebak tipe (angka / tanggal
/ teks) berdasarkan tingkat keberhasilan konversi, lalu hasilkan view Silver
ClickHouse yang bertipe.

Prinsip yang menjaga kejujuran data (spec §9): kolom hanya dipromosikan ke
angka/tanggal bila >= AMBANG_TIPE (95%) nilai non-kosongnya bisa dikonversi.
Di bawah itu kolom tetap String — lebih baik mentah daripada salah diam-diam.
Setiap keputusan dicatat ke tabel _silver_meta.kolom_tipe untuk audit.

Silver = VIEW, bukan tabel: transformasinya murni dan Bronze sudah jadi salinan
tetap, jadi tidak ada gunanya menggandakan data. Gold yang nanti dimaterialisasi.
"""

from __future__ import annotations

import os
import re
import sys

import clickhouse_connect

AMBANG_TIPE = float(os.environ.get("AMBANG_TIPE", "0.95"))
SAMPEL = int(os.environ.get("SAMPEL", "2000"))

# Kolom internal SDI yang tidak bermakna bagi pengguna akhir — disembunyikan di
# Silver (tetap ada di Bronze). Kolom audit _* dipertahankan.
KOLOM_BUANG = {
    "id", "user_id", "uid_upload", "batch_upload", "created_at", "updated_at",
    "tanggal_upload", "tanggal_update", "jadwal_rilis", "kode_provinsi",
    "kode_kabupaten_kota",
}

AUDIT = ("_ingested_at", "_source_url", "_batch_id", "_row_hash", "_tenant")

# Kolom kode yang isinya kebetulan angka tetapi bukan besaran: tetap teks (varchar),
# supaya tidak bisa dijumlah/dirata-rata dan nol di depan (KBLI 01111) tidak hilang.
KOLOM_TEKS = {"kbli"}

# Kolom lintang/bujur: titik selalu desimal (koordinat_id). angka_id akan membaca
# '-6.033' sebagai -6033 karena polanya sama dengan ribuan format Indonesia.
KOLOM_KOORDINAT = {"lat", "lon", "lng", "latitude", "longitude"}


def client():
    return clickhouse_connect.get_client(
        host=os.environ.get("CH_HOST", "lake-clickhouse"),
        port=int(os.environ.get("CH_PORT", "8123")),
        username=os.environ.get("CH_USER", "dispar"),
        password=os.environ.get("CH_PASSWORD", "disparch"),
    )


def bronze_tables(ch, db_katalog="lake") -> list[tuple[str, str, str]]:
    """(namespace, tabel, nama_iceberg) untuk tiap tabel Bronze."""
    out = []
    for (nama,) in ch.query(f"SHOW TABLES FROM {db_katalog}").result_rows:
        if "." not in nama:
            continue
        ns, _, tbl = nama.partition(".")
        out.append((ns, tbl, nama))
    return sorted(out)


def kolom_tabel(ch, db_katalog, nama_iceberg) -> list[str]:
    # system.columns tidak memuat tabel DataLakeCatalog (lazy-load); DESCRIBE bisa.
    rows = ch.query(f"DESCRIBE TABLE {db_katalog}.`{nama_iceberg}`").result_rows
    return [r[0] for r in rows]


def tebak_tipe(ch, src_ref, kolom) -> tuple[str, float]:
    """Kembalikan (tipe, rasio_sukses) untuk satu kolom.

    tipe ∈ {'angka', 'tanggal', 'teks'}.
    """
    col = f"`{kolom}`"
    # Ukur dengan fungsi yang sama dengan yang dipakai view (lihat KOLOM_KOORDINAT).
    konversi = "koordinat_id" if kolom in KOLOM_KOORDINAT else "angka_id"
    # Sampel SAMPEL baris cukup untuk deteksi tipe pada ambang 95% — jauh lebih
    # cepat daripada men-scan Parquet penuh dari object storage per kolom.
    # tgl_struktural = tanggal yang PUNYA struktur tanggal: ada pemisah (-,/),
    # YYYYMM 6-digit, atau nama bulan. Tahun polos 4-digit ("2026") TIDAK masuk
    # sini — ia ambigu (valid angka & tanggal) tapi lebih berguna sebagai angka
    # (mis. kolom `tahun`). Kalau dijadikan Date, "2026"→2026-01-01 merusak
    # logika yearOf di halaman.
    q = f"""
        SELECT
            countIf(bersih_teks({col}) IS NOT NULL) AS non_kosong,
            countIf({konversi}({col}) IS NOT NULL) AS bisa_angka,
            countIf(tanggal_id({col}) IS NOT NULL) AS bisa_tanggal,
            countIf(tanggal_id({col}) IS NOT NULL AND (
                match(bersih_teks({col}), '[-/]')
                OR match(bersih_teks({col}), '^(19|20)[0-9]{{2}}(0[1-9]|1[0-2])$')
                OR match(lower(bersih_teks({col})),
                    'januari|februari|pebruari|maret|april|mei|juni|juli|agustus|september|oktober|november|nopember|desember')
            )) AS tgl_struktural
        FROM (SELECT {col} FROM {src_ref} LIMIT {SAMPEL})
    """
    non_kosong, bisa_angka, bisa_tanggal, tgl_struktural = ch.query(q).result_rows[0]
    if not non_kosong:
        return "teks", 0.0
    r_angka = bisa_angka / non_kosong
    r_tanggal = bisa_tanggal / non_kosong
    r_struktural = tgl_struktural / non_kosong
    # Tanggal menang hanya bila strukturnya tanggal; kalau tidak, angka dulu.
    if r_struktural >= AMBANG_TIPE:
        return "tanggal", r_tanggal
    if r_angka >= AMBANG_TIPE:
        return "angka", r_angka
    if r_tanggal >= AMBANG_TIPE:
        return "tanggal", r_tanggal
    return "teks", max(r_angka, r_tanggal)


EKSPR = {
    "angka": lambda c: f"angka_id(`{c}`)",
    "tanggal": lambda c: f"tanggal_id(`{c}`)",
    "teks": lambda c: f"bersih_teks(`{c}`)",
}


def generate_silver() -> int:
    ch = client()
    db_katalog = os.environ.get("CH_CATALOG_DB", "lake")

    ch.command("CREATE DATABASE IF NOT EXISTS silver")
    ch.command("CREATE DATABASE IF NOT EXISTS _silver_meta")
    ch.command(
        """
        CREATE TABLE IF NOT EXISTS _silver_meta.kolom_tipe (
            tabel String, kolom String, tipe String, rasio_sukses Float64,
            dipromosikan UInt8, dibuat_pada DateTime DEFAULT now()
        ) ENGINE = MergeTree ORDER BY (tabel, kolom)
        """
    )
    ch.command("TRUNCATE TABLE _silver_meta.kolom_tipe")

    tabel = bronze_tables(ch, db_katalog)
    print(f"{len(tabel)} tabel Bronze → Silver (ambang tipe {AMBANG_TIPE:.0%})\n", flush=True)

    dibuat = 0
    meta_rows = []
    for ns, tbl, nama_iceberg in tabel:
        # Proses hanya namespace dataset (bronze_sdi/bronze_file/bronze_sec).
        # bronze_meta* = tabel metadata (punya kolom Int64), bukan untuk di-Silver-kan.
        if not ns.startswith("bronze") or ns.startswith("bronze_meta"):
            continue
        src_ref = f"{db_katalog}.`{nama_iceberg}`"
        try:
            kolom = kolom_tabel(ch, db_katalog, nama_iceberg)
        except Exception as e:  # noqa: BLE001
            print(f"  {tbl}: GAGAL baca kolom: {e}", flush=True)
            continue

        proyeksi = []
        for c in kolom:
            if c in AUDIT:
                proyeksi.append(f"`{c}`")
                continue
            if c in KOLOM_BUANG:
                continue
            tipe, rasio = ("teks", 0.0) if c in KOLOM_TEKS else tebak_tipe(ch, src_ref, c)
            ekspr = f"koordinat_id(`{c}`)" if tipe == "angka" and c in KOLOM_KOORDINAT else EKSPR[tipe](c)
            proyeksi.append(f"{ekspr} AS `{c}`")
            meta_rows.append([tbl, c, tipe, round(rasio, 4), 1 if tipe != "teks" else 0])

        if not proyeksi:
            continue

        ddl = f"CREATE OR REPLACE VIEW silver.{tbl} AS SELECT\n  " + ",\n  ".join(proyeksi) + f"\nFROM {src_ref}"
        try:
            ch.command(ddl)
            dibuat += 1
        except Exception as e:  # noqa: BLE001
            print(f"  {tbl}: GAGAL buat view: {e}", flush=True)

    if meta_rows:
        # dibuat_pada diisi oleh DEFAULT now() — jangan kirim None ke kolom DateTime.
        ch.insert(
            "_silver_meta.kolom_tipe",
            meta_rows,
            column_names=["tabel", "kolom", "tipe", "rasio_sukses", "dipromosikan"],
        )

    dipromosikan = sum(1 for r in meta_rows if r[4])
    print(f"\nView Silver dibuat: {dibuat}")
    print(f"Kolom total: {len(meta_rows)}, dipromosikan (angka/tanggal): {dipromosikan}")
    return 0 if dibuat else 1


def main() -> int:
    return generate_silver()


if __name__ == "__main__":
    sys.exit(main())
