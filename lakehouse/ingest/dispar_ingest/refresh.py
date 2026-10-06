"""Orkestrasi pipeline penuh sebagai fungsi yang bisa dipanggil.

Dipakai dua cara:
  - CLI: `python -m dispar_ingest.refresh all`
  - Dagster: tiap fungsi jadi satu asset (lihat orchestrate/).

Urutan mencerminkan ketergantungan nyata:
  bronze → lake_db → functions+dim → silver_auto → curated+gold
Ini juga persis bentuk graf lineage yang ditampilkan /lineage.
"""

from __future__ import annotations

import glob
import os
import re
import sys

import clickhouse_connect


def _ch():
    return clickhouse_connect.get_client(
        host=os.environ.get("CH_HOST", "lake-clickhouse"),
        port=int(os.environ.get("CH_PORT", "8123")),
        username=os.environ.get("CH_USER", "dispar"),
        password=os.environ.get("CH_PASSWORD", "disparch"),
    )


def _run_sql_file(ch, path: str) -> None:
    with open(path, "r", encoding="utf-8") as f:
        sql = f.read()
    # Pisah per pernyataan; ClickHouse HTTP tidak menerima multi-statement.
    for stmt in _split_statements(sql):
        if stmt.strip():
            ch.command(stmt, settings={"allow_insert_into_iceberg": 1})


def _split_statements(sql: str) -> list[str]:
    """Pisah SQL per ';' di akhir baris, abaikan komentar '--'."""
    out, buf = [], []
    for line in sql.splitlines():
        s = line.strip()
        if s.startswith("--") or not s:
            continue
        buf.append(line)
        if s.endswith(";"):
            out.append("\n".join(buf).rstrip(";\n "))
            buf = []
    if buf:
        out.append("\n".join(buf).rstrip(";\n "))
    return out


SQL_DIR = os.environ.get("SQL_DIR", "/repo/lakehouse/clickhouse/sql")
CATALOG_DB = os.environ.get("CH_CATALOG_DB", "lake")


def recreate_lake_db(ch=None) -> str:
    """Sambungkan ulang ClickHouse ke katalog Iceberg (hilang bila container dibuat ulang)."""
    ch = ch or _ch()
    s3 = os.environ.get("S3_ACCESS_KEY", "disparlake")
    sk = os.environ.get("S3_SECRET_KEY", "disparlakesecret")
    ep = os.environ.get("S3_STORAGE_ENDPOINT", "http://lake-rustfs:9000/lakehouse")
    cat = os.environ.get("ICEBERG_CATALOG_URI", "http://lake-catalog:8181/catalog")
    wh = os.environ.get("ICEBERG_WAREHOUSE", "dispar")
    ch.command(f"DROP DATABASE IF EXISTS {CATALOG_DB}")
    ch.command(
        f"CREATE DATABASE {CATALOG_DB} "
        f"ENGINE = DataLakeCatalog('{cat}', '{s3}', '{sk}') "
        f"SETTINGS catalog_type='rest', storage_endpoint='{ep}', warehouse='{wh}'"
    )
    n = len(ch.query(f"SHOW TABLES FROM {CATALOG_DB}").result_rows)
    return f"lake tersambung: {n} tabel Bronze"


def apply_functions_dim(ch=None) -> str:
    """Fungsi konversi + dimensi (butuh Bronze untuk dim_indikator)."""
    ch = ch or _ch()
    files = ["00-functions.sql", "10-dim.sql", "11-dim-more.sql"]
    for f in files:
        _run_sql_file(ch, os.path.join(SQL_DIR, f))
    return f"terapkan {len(files)} berkas fungsi+dimensi"


def apply_curated_gold(ch=None) -> str:
    """Silver kurasi + mart Gold (butuh view Silver otomatis lebih dulu)."""
    ch = ch or _ch()
    files = sorted(
        f for f in glob.glob(os.path.join(SQL_DIR, "2*.sql")) + glob.glob(os.path.join(SQL_DIR, "3*.sql"))
    )
    for f in files:
        _run_sql_file(ch, f)
    return f"terapkan {len(files)} berkas kurasi+gold"


def refresh_wisman(ch=None) -> dict:
    """Segarkan hanya kurasi dan mart wisman; sumber Silver primer harus sudah ada."""
    if ch is None and not os.environ.get("CH_PASSWORD"):
        raise ValueError("CH_PASSWORD wajib diisi dari Env stack Portainer")
    ch = ch or _ch()
    source = "silver.data_jumlah_wisatawan_mancanegara_berdasarkan_kebangsaan"
    source_count, latest = ch.query(
        f"SELECT count(), max(tanggal_id(toString(periode_data))) FROM {source}"
    ).result_rows[0]
    if not source_count or latest is None:
        raise ValueError("Sumber SDI terbaru belum tersedia; ingest Bronze/Silver primer dulu")
    conflicts = ch.query(
        f"SELECT count() FROM (SELECT n.kode_iso3, periode_data "
        f"FROM {source} r INNER JOIN (SELECT * FROM silver.dim_negara FINAL) n "
        "ON n.match_key = kunci_cocok(r.kebangsaan) "
        "GROUP BY n.kode_iso3, periode_data HAVING uniqExact(jumlah_kunjungan) > 1)"
    ).result_rows[0][0]
    if conflicts:
        raise ValueError(f"{conflicts} kelompok negara/periode memiliki nilai berbeda; tinjau dulu")
    historical_duplicates = ch.query(
        "SELECT count() FROM (SELECT n.kode_iso3, tahun_dari(r.periode_data), b.nomor "
        "FROM silver.data_jumlah_kunjungan_dan_ranking_wisatawan_mancanegara_ke_provinsi_dki_jakarta_melalui_pintu_soekarno_hatta_berdasarkan_kebangsaan r "
        "INNER JOIN (SELECT * FROM silver.dim_negara FINAL) n ON n.match_key = kunci_cocok(r.kebangsaan) "
        "LEFT JOIN (SELECT match_key, nomor FROM silver.dim_bulan FINAL) b ON b.match_key = kunci_cocok(r.bulan) "
        "WHERE r.wisman IS NOT NULL GROUP BY n.kode_iso3, tahun_dari(r.periode_data), b.nomor HAVING count() > 1)"
    ).result_rows[0][0]
    if historical_duplicates:
        raise ValueError(f"{historical_duplicates} kunci historis wisman berulang; tinjau sebelum mengubah total")
    before = ch.query("SELECT count(), sum(jumlah) FROM serving.mart_wisman").result_rows[0]
    originals = [ch.query(f"SHOW CREATE TABLE {table}").result_rows[0][0]
                 for table in ("silver.wisman", "silver.wisman_karantina")]
    exchanged = False
    try:
        _run_sql_file(ch, os.path.join(SQL_DIR, "20-silver-wisman.sql"))
        unmapped = ch.query("SELECT count() FROM silver.wisman_karantina").result_rows[0][0]
        invalid = ch.query(
            "SELECT countIf(tahun IS NULL OR bulan_no IS NULL OR bulan_no NOT BETWEEN 1 AND 12 "
            "OR jumlah < 0 OR NOT isFinite(jumlah)) FROM silver.wisman"
        ).result_rows[0][0]
        expected = ch.query("SELECT count(), sum(jumlah), max(tahun * 100 + bulan_no) FROM silver.wisman").result_rows[0]
        latest_key = int(str(latest)[:7].replace("-", ""))
        if unmapped or invalid or not expected[0] or expected[0] < before[0] or expected[2] != latest_key:
            raise ValueError(f"Validasi wisman gagal: negara karantina={unmapped}, baris invalid={invalid}, baris={expected[0]}")
        with open(os.path.join(SQL_DIR, "30-gold.sql"), encoding="utf-8") as f:
            statements = _split_statements(f.read())
        if before[0] == expected[0] and abs(float(before[1]) - float(expected[1])) <= 0.001:
            insert = next(stmt for stmt in statements if stmt.startswith("INSERT INTO serving.mart_wisman_baru"))
            projection = "SELECT" + insert.split("\nSELECT", 1)[1]
            differences = ch.query(
                "SELECT count() FROM ((" + projection + " EXCEPT SELECT * FROM serving.mart_wisman) "
                "UNION ALL (SELECT * FROM serving.mart_wisman EXCEPT " + projection + "))"
            ).result_rows[0][0]
            if not differences:
                return {"source_rows": source_count, "latest_period": str(latest),
                        "before_rows": before[0], "after_rows": before[0],
                        "before_visits": before[1], "after_visits": before[1], "already_current": True}
        # Bayangan terpisah agar tidak bertabrakan dengan mart_wisman_baru
        # milik pipeline harian. Tetap jalankan saat tidak ada refresh aktif.
        shadow = "serving.mart_wisman_refresh_baru"
        # Batasi ke mart wisman meskipun kelak berkas Gold ini bertambah.
        for stmt in statements:
            if "mart_wisman" not in stmt:
                continue
            tables = set(re.findall(r"(?:serving|silver)\.[a-zA-Z0-9_]+", stmt))
            if not tables <= {"serving.mart_wisman", "serving.mart_wisman_baru", "silver.wisman"}:
                raise ValueError("SQL Gold wisman menyentuh tabel di luar cakupan")
            if exchanged:
                break  # Simpan mart lama di tabel bayangan untuk rollback.
            ch.command(stmt.replace("serving.mart_wisman_baru", shadow))
            if stmt.startswith("EXCHANGE TABLES"):
                exchanged = True
        if not exchanged:
            raise ValueError("Pernyataan EXCHANGE mart wisman tidak ditemukan")
        after = ch.query("SELECT count(), sum(jumlah) FROM serving.mart_wisman").result_rows[0]
        if after[0] != expected[0] or abs(float(after[1]) - float(expected[1])) > 0.001:
            raise ValueError("Jumlah baris/kunjungan Gold tidak sama dengan Silver")
        return {"source_rows": source_count, "latest_period": str(latest),
                "before_rows": before[0], "after_rows": after[0], "before_visits": before[1], "after_visits": after[1]}
    except Exception:
        if exchanged:
            ch.command("EXCHANGE TABLES serving.mart_wisman AND serving.mart_wisman_refresh_baru")
        for ddl in originals:
            ch.command(ddl.replace("CREATE VIEW", "CREATE OR REPLACE VIEW", 1))
        raise


def run_all() -> None:
    from .run_bronze import ingest_files, ingest_sdi

    print(">>> Bronze SDI", flush=True)
    ingest_sdi()
    print(">>> Bronze berkas", flush=True)
    ingest_files()
    ch = _ch()
    print(">>>", recreate_lake_db(ch), flush=True)
    print(">>>", apply_functions_dim(ch), flush=True)
    print(">>> Silver otomatis", flush=True)
    from .silver import generate_silver

    generate_silver()
    print(">>>", apply_curated_gold(ch), flush=True)
    print(">>> Publikasi Gold → Iceberg", flush=True)
    from .publish import publish_marts

    publish_marts()
    print(">>> SELESAI", flush=True)


if __name__ == "__main__":
    perintah = sys.argv[1] if len(sys.argv) > 1 else "all"
    if perintah == "all":
        run_all()
    elif perintah == "wisman":
        print(refresh_wisman(), flush=True)
    else:
        print(f"perintah tak dikenal: {perintah}")
        sys.exit(1)
