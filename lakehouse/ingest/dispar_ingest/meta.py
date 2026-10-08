"""Tangkap metadata dataset SDI ke lake (namespace bronze_meta).

App asli membaca metadata kaya dari Postgres (tabel dataset/datasetSync/
datasetColumn): judul, deskripsi, sumber, frekuensi, satuan, definisi kolom.
Bronze baris mentah tidak memuat ini. Modul ini memanggil /search + /detail SDI
dan menyimpan metadata sebagai 3 tabel Iceberg, supaya app v2 bisa 1:1 tanpa
Postgres.

Tabel:
  bronze_meta.dataset_catalog  — dari /search (judul, tag, views, updated_at, tier)
  bronze_meta.dataset_sync     — dari /detail (frekuensi, satuan, sumber, total, table_name)
  bronze_meta.dataset_column   — dari /detail (key_asli, key_safe, tipe, deskripsi, ord)
  bronze_meta.ingest_log       — riwayat append-only penarikan tiap sumber raw

key_safe = safe_name(key_asli): menjodohkan definisi kolom ke nama kolom di
tabel Bronze (yang di-snake_case). key_asli dipertahankan untuk header 1:1.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import pyarrow as pa

from .lake import get_catalog, safe_name
from .sdi import SdiClient

class MetadataShrinkageError(RuntimeError):
    pass


INGEST_LOG_SCHEMA = pa.schema([
    ("sumber_id", pa.string()),
    ("namespace", pa.string()),
    ("tabel", pa.string()),
    ("sha256", pa.string()),
    ("baris", pa.int64()),
    ("status", pa.string()),
    ("pesan", pa.string()),
    ("ingested_at", pa.timestamp("us", tz="UTC")),
])


def append_ingest_log(
    catalog,
    *,
    sumber_id: str,
    namespace: str,
    tabel: str,
    sha256: str,
    baris: int,
    status: str,
    pesan: str = "",
    ingested_at: datetime | None = None,
) -> None:
    """Catat satu entri penarikan ke bronze_meta.ingest_log (append-only)."""
    if status not in {"masuk", "kosong", "gagal"}:
        raise ValueError(f"status {status!r} tidak valid; harus masuk | kosong | gagal")
    if ingested_at is None:
        ingested_at = datetime.now(timezone.utc)

    catalog.create_namespace_if_not_exists("bronze_meta")
    ident = ("bronze_meta", "ingest_log")

    tbl_data = pa.table({
        "sumber_id": pa.array([sumber_id], pa.string()),
        "namespace": pa.array([namespace], pa.string()),
        "tabel": pa.array([tabel], pa.string()),
        "sha256": pa.array([sha256], pa.string()),
        "baris": pa.array([int(baris)], pa.int64()),
        "status": pa.array([status], pa.string()),
        "pesan": pa.array([pesan], pa.string()),
        "ingested_at": pa.array([ingested_at], pa.timestamp("us", tz="UTC")),
    }, schema=INGEST_LOG_SCHEMA)

    if catalog.table_exists(ident):
        tbl = catalog.load_table(ident)
    else:
        tbl = catalog.create_table(ident, schema=INGEST_LOG_SCHEMA)
    tbl.append(tbl_data)


def get_last_success_hashes(catalog) -> dict[str, str]:
    """Ambil pemetaan {sumber_id: sha256} baris 'masuk' terakhir tiap sumber."""
    ident = ("bronze_meta", "ingest_log")
    if not catalog.table_exists(ident):
        return {}
    tbl = catalog.load_table(ident)
    arrow = tbl.scan(selected_fields=("sumber_id", "status", "sha256", "ingested_at")).to_arrow()
    if arrow.num_rows == 0:
        return {}

    s_ids = arrow.column("sumber_id").to_pylist()
    stats = arrow.column("status").to_pylist()
    shas = arrow.column("sha256").to_pylist()
    tss = arrow.column("ingested_at").to_pylist()

    latest_ts: dict[str, Any] = {}
    latest_sha: dict[str, str] = {}

    for s_id, st, sha, ts in zip(s_ids, stats, shas, tss):
        if st == "masuk":
            if s_id not in latest_ts or ts >= latest_ts[s_id]:
                latest_ts[s_id] = ts
                latest_sha[s_id] = sha

    return latest_sha


def _replace_table(catalog, namespace: str, name: str, table: pa.Table) -> int:
    catalog.create_namespace_if_not_exists(namespace)
    ident = (namespace, name)
    if catalog.table_exists(ident):
        catalog.drop_table(ident)
    t = catalog.create_table(ident, schema=table.schema)
    t.append(table)
    return table.num_rows


def capture_metadata(
    limit: int | None = None,
    tenant: str = "dispar-dki",
    client: SdiClient | None = None,
    catalog: Any = None,
) -> dict:
    if client is None:
        client = SdiClient()
    if catalog is None:
        catalog = get_catalog()
    now = datetime.now(timezone.utc)

    print("Mengambil katalog dataset SDI...", flush=True)
    datasets = client.list_datasets()
    if limit:
        datasets = datasets[:limit]

    # Pengaman penyusutan: jika tabel dataset_catalog sudah ada dan baris baru < 90% dari yang ada,
    # jangan ganti tabel mana pun; aset gagal dengan menyebut kedua angka.
    ident_cat = ("bronze_meta", "dataset_catalog")
    if catalog.table_exists(ident_cat):
        existing_tbl = catalog.load_table(ident_cat)
        existing_count = existing_tbl.scan().to_arrow().num_rows
        if existing_count > 0:
            new_count = len(datasets)
            if new_count < 0.9 * existing_count:
                raise MetadataShrinkageError(
                    f"Penyusutan metadata terdeteksi: jumlah dataset baru ({new_count}) "
                    f"< 90% dari jumlah yang ada ({existing_count}). Penggantian tabel dibatalkan."
                )

    # ── dataset_catalog ──────────────────────────────────────────────────
    cat_rows = {
        "slug": [], "title": [], "description": [], "tags": [], "views": [],
        "updated_at": [], "tier": [], "table_name": [],
    }
    for d in datasets:
        cat_rows["slug"].append(d.slug)
        cat_rows["title"].append(d.title)
        cat_rows["description"].append(d.description or "")
        cat_rows["tags"].append(json.dumps(d.tags, ensure_ascii=False))
        cat_rows["views"].append(int(d.views))
        cat_rows["updated_at"].append(d.updated_at or "")
        cat_rows["tier"].append("primer")
        cat_rows["table_name"].append(safe_name(d.slug))
    catalog_tbl = pa.table({
        "slug": pa.array(cat_rows["slug"], pa.string()),
        "title": pa.array(cat_rows["title"], pa.string()),
        "description": pa.array(cat_rows["description"], pa.string()),
        "tags": pa.array(cat_rows["tags"], pa.string()),
        "views": pa.array(cat_rows["views"], pa.int64()),
        "updated_at": pa.array(cat_rows["updated_at"], pa.string()),
        "tier": pa.array(cat_rows["tier"], pa.string()),
        "table_name": pa.array(cat_rows["table_name"], pa.string()),
    })
    n_cat = _replace_table(catalog, "bronze_meta", "dataset_catalog", catalog_tbl)
    print(f"  dataset_catalog: {n_cat} baris", flush=True)

    # ── dataset_sync + dataset_column (per dataset via /detail) ─────────────
    sync_cols: dict[str, list] = {k: [] for k in [
        "slug", "title", "description", "sumber_data", "frekuensi", "satuan",
        "klasifikasi", "kontak", "author", "total", "table_name", "synced_at"]}
    col_cols: dict[str, list] = {k: [] for k in [
        "slug", "ord", "key_asli", "key_safe", "tipe", "deskripsi"]}

    gagal = []
    for i, d in enumerate(datasets, 1):
        try:
            det = client.dataset_detail(d.slug)
        except Exception as e:  # noqa: BLE001
            gagal.append({"slug": d.slug, "error": str(e)})
            continue
        sync_cols["slug"].append(d.slug)
        sync_cols["title"].append(det.title)
        sync_cols["description"].append(det.description or "")
        sync_cols["sumber_data"].append(json.dumps(det.sumber_data, ensure_ascii=False))
        sync_cols["frekuensi"].append(det.frekuensi or "")
        sync_cols["satuan"].append(det.satuan or "")
        sync_cols["klasifikasi"].append(det.klasifikasi or "")
        sync_cols["kontak"].append(det.kontak or "")
        sync_cols["author"].append(det.author or "")
        sync_cols["total"].append(0)  # diisi belakangan dari count Bronze
        sync_cols["table_name"].append(safe_name(d.slug))
        sync_cols["synced_at"].append(now)
        for ord_, c in enumerate(det.columns):
            key_asli = str(c.get("key") or "")
            if not key_asli:
                continue
            col_cols["slug"].append(d.slug)
            col_cols["ord"].append(ord_)
            col_cols["key_asli"].append(key_asli)
            col_cols["key_safe"].append(safe_name(key_asli))
            col_cols["tipe"].append(str(c.get("type") or ""))
            col_cols["deskripsi"].append(str(c.get("description") or ""))
        if i % 30 == 0:
            print(f"  ...detail {i}/{len(datasets)}", flush=True)

    sync_tbl = pa.table({
        "slug": pa.array(sync_cols["slug"], pa.string()),
        "title": pa.array(sync_cols["title"], pa.string()),
        "description": pa.array(sync_cols["description"], pa.string()),
        "sumber_data": pa.array(sync_cols["sumber_data"], pa.string()),
        "frekuensi": pa.array(sync_cols["frekuensi"], pa.string()),
        "satuan": pa.array(sync_cols["satuan"], pa.string()),
        "klasifikasi": pa.array(sync_cols["klasifikasi"], pa.string()),
        "kontak": pa.array(sync_cols["kontak"], pa.string()),
        "author": pa.array(sync_cols["author"], pa.string()),
        "total": pa.array(sync_cols["total"], pa.int64()),
        "table_name": pa.array(sync_cols["table_name"], pa.string()),
        "synced_at": pa.array(sync_cols["synced_at"], pa.timestamp("us", tz="UTC")),
    })
    col_tbl = pa.table({
        "slug": pa.array(col_cols["slug"], pa.string()),
        "ord": pa.array(col_cols["ord"], pa.int64()),
        "key_asli": pa.array(col_cols["key_asli"], pa.string()),
        "key_safe": pa.array(col_cols["key_safe"], pa.string()),
        "tipe": pa.array(col_cols["tipe"], pa.string()),
        "deskripsi": pa.array(col_cols["deskripsi"], pa.string()),
    })
    n_sync = _replace_table(catalog, "bronze_meta", "dataset_sync", sync_tbl)
    n_col = _replace_table(catalog, "bronze_meta", "dataset_column", col_tbl)
    print(f"  dataset_sync: {n_sync} baris | dataset_column: {n_col} baris", flush=True)

    laporan = {"katalog": n_cat, "sync": n_sync, "kolom": n_col, "gagal": len(gagal)}
    print("\n" + json.dumps(laporan, ensure_ascii=False), flush=True)
    return laporan


def fill_totals(catalog: Any = None, ch_client: Any = None) -> int:
    """Isi kolom total di bronze_meta.dataset_sync dari count baris Bronze.

    Dijalankan SETELAH Bronze + lake_db siap. Membaca sync, menghitung tiap
    tabel bronze_sdi.<table_name> via ClickHouse, lalu menulis ulang tabel sync
    dengan total terisi. Butuh env CH_HOST + katalog lake sudah tersambung.
    """
    import os

    if catalog is None:
        catalog = get_catalog()
    if ch_client is None:
        import clickhouse_connect

        try:
            ch_client = clickhouse_connect.get_client(
                host=os.environ.get("CH_HOST", "lake-clickhouse"),
                port=int(os.environ.get("CH_PORT", "8123")),
                username=os.environ.get("CH_USER", "dispar"),
                password=os.environ.get("CH_PASSWORD", "disparch"),
            )
        except Exception as e:
            print(f"  Peringatan: koneksi ClickHouse gagal ({e}), total diisi 0")
            ch_client = None

    tbl = catalog.load_table(("bronze_meta", "dataset_sync"))
    arrow = tbl.scan().to_arrow()
    tnames = arrow.column("table_name").to_pylist()

    ada = set()
    if ch_client is not None:
        try:
            ada = {n.split(".", 1)[1] for n in
                   (r[0] for r in ch_client.query("SHOW TABLES FROM lake").result_rows)
                   if n.startswith("bronze_sdi.")}
        except Exception as e:
            print(f"  Peringatan: tidak dapat membaca lake ClickHouse ({e}), total diisi 0")

    totals = []
    for tn in tnames:
        if ch_client is not None and tn in ada:
            try:
                totals.append(int(ch_client.query(f"SELECT count() FROM lake.`bronze_sdi.{tn}`").result_rows[0][0]))
            except Exception:  # noqa: BLE001
                totals.append(0)
        else:
            totals.append(0)

    new = arrow.set_column(arrow.schema.get_field_index("total"),
                           "total", pa.array(totals, pa.int64()))
    _replace_table(catalog, "bronze_meta", "dataset_sync", new)
    terisi = sum(1 for t in totals if t > 0)
    print(f"  total terisi untuk {terisi}/{len(totals)} dataset", flush=True)
    return terisi


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "totals":
        fill_totals()
        sys.exit(0)
    lim = int(sys.argv[1]) if len(sys.argv) > 1 else None
    capture_metadata(limit=lim)
    sys.exit(0)
