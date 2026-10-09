"""Penulis tabel Bronze ke Iceberg lewat katalog REST (Lakekeeper).

Bronze bersifat mentah dan tak ditafsirkan: SEMUA kolom bertipe string, persis
seperti yang dikirim sumber. Penafsiran tipe adalah pekerjaan lapisan Silver.
Alasannya: tebakan tipe yang salah menghasilkan angka keliru yang tampak wajar,
dan kalau itu terjadi di Bronze, kesalahannya permanen — tidak ada lagi salinan
mentah untuk dibandingkan.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Iterable

import pyarrow as pa
from pyiceberg.catalog.rest import RestCatalog
from pyiceberg.io import load_file_io

AUDIT_COLUMNS = ("_ingested_at", "_source_url", "_batch_id", "_row_hash", "_tenant")

# Kolom internal SDI yang tidak bermakna bagi pengguna, tapi tetap disimpan di
# Bronze — Bronze menyimpan apa adanya. Penyaringan terjadi di Silver.
_SLUG_RE = re.compile(r"[^a-z0-9_]+")


def safe_name(raw: str) -> str:
    """Ubah slug/nama kolom jadi identifier yang aman untuk tabel Iceberg."""
    name = _SLUG_RE.sub("_", str(raw).strip().lower()).strip("_")
    if not name:
        name = "kolom"
    if name[0].isdigit():
        name = f"k_{name}"
    return name[:200]


def row_hash(row: dict[str, Any]) -> str:
    """Hash stabil atas isi baris — dipakai untuk dedup di Silver."""
    payload = json.dumps(row, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]


def to_text(v: Any) -> str | None:
    """Semua nilai jadi string. None tetap None supaya NULL terjaga."""
    if v is None:
        return None
    if isinstance(v, str):
        return v
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False, default=str)
    return str(v)


def properti_io_statis(properties: dict[str, str], statis: dict[str, str]) -> dict[str, str]:
    """Properti FileIO tanpa remote signing, dengan kredensial S3 statis.

    Lakekeeper menyisipkan `s3.signer*` di konfigurasi tiap tabel, sehingga
    pyiceberg menandatangani setiap request S3 lewat katalog, per tabel. Begitu
    satu proses menulis ke lebih dari satu tabel berselang-seling (dataset lalu
    `ingest_log`), sebagian request ditolak 403 secara acak. Terukur di
    produksi 9 Okt 2026: 10 dari 50 penulisan gagal lewat signer, 0 dari 120
    dengan kredensial statis. Pipeline ini berjalan in-network dan sudah
    memegang kunci RustFS, jadi signer tidak dibutuhkan.
    """
    bersih = {k: v for k, v in properties.items() if "sign" not in k}
    return {**bersih, **statis}


class KatalogStatis(RestCatalog):
    """RestCatalog yang selalu membuat FileIO berkredensial statis."""

    _s3_statis: dict[str, str] = {}

    def _load_file_io(self, properties=None, location=None):  # type: ignore[override]
        gabung = properti_io_statis({**self.properties, **(properties or {})}, self._s3_statis)
        return load_file_io(gabung, location)


def get_catalog() -> RestCatalog:
    """Katalog Iceberg REST. Konfigurasi dari environment."""
    s3_statis = {
        "s3.endpoint": os.environ.get("S3_ENDPOINT", "http://lake-rustfs:9000"),
        "s3.access-key-id": os.environ.get("S3_ACCESS_KEY", "disparlake"),
        "s3.secret-access-key": os.environ.get("S3_SECRET_KEY", "disparlakesecret"),
        "s3.path-style-access": "true",
        "s3.region": os.environ.get("S3_REGION", "local-01"),
    }
    catalog = KatalogStatis(
        os.environ.get("ICEBERG_CATALOG_NAME", "dispar"),
        uri=os.environ.get("ICEBERG_CATALOG_URI", "http://lake-catalog:8181/catalog"),
        warehouse=os.environ.get("ICEBERG_WAREHOUSE", "dispar"),
        **s3_statis,
    )
    catalog._s3_statis = s3_statis
    return catalog


def build_table(
    rows: Iterable[dict[str, Any]],
    *,
    source_url: str,
    batch_id: str,
    tenant: str,
) -> pa.Table | None:
    """Susun tabel Arrow all-string + kolom audit. None kalau tidak ada baris."""
    materialized = list(rows)
    if not materialized:
        return None

    # Union seluruh kunci: baris SDI tidak selalu punya kolom yang sama.
    keys: list[str] = []
    seen: set[str] = set()
    for r in materialized:
        for k in r:
            safe = safe_name(k)
            if safe not in seen and safe not in AUDIT_COLUMNS:
                seen.add(safe)
                keys.append(safe)

    # Peta nama asli → nama aman, dipertahankan per baris.
    columns: dict[str, list[str | None]] = {k: [] for k in keys}
    ingested_at = datetime.now(timezone.utc)

    hashes: list[str] = []
    for r in materialized:
        normalized = {safe_name(k): to_text(v) for k, v in r.items()}
        for k in keys:
            columns[k].append(normalized.get(k))
        hashes.append(row_hash(normalized))

    n = len(materialized)
    arrays = {k: pa.array(v, pa.string()) for k, v in columns.items()}
    arrays["_ingested_at"] = pa.array([ingested_at] * n, pa.timestamp("us", tz="UTC"))
    arrays["_source_url"] = pa.array([source_url] * n, pa.string())
    arrays["_batch_id"] = pa.array([batch_id] * n, pa.string())
    arrays["_row_hash"] = pa.array(hashes, pa.string())
    arrays["_tenant"] = pa.array([tenant] * n, pa.string())

    return pa.table(arrays)


def write_bronze(
    catalog: RestCatalog,
    namespace: str,
    table_name: str,
    data: pa.Table,
) -> int:
    """Tulis satu tabel Bronze (overwrite penuh per batch).

    Overwrite dipilih, bukan append: SDI menerbitkan ulang seluruh dataset tiap
    pembaruan tanpa kunci yang andal, jadi append akan menggandakan baris.
    Riwayatnya tidak hilang — snapshot Iceberg menyimpan versi sebelumnya.
    """
    catalog.create_namespace_if_not_exists(namespace)
    ident = (namespace, table_name)

    if catalog.table_exists(ident):
        tbl = catalog.load_table(ident)
        # Skema bisa berubah saat SDI menambah kolom; buat ulang bila berbeda.
        if tbl.schema().as_arrow() != data.schema:
            catalog.drop_table(ident)
            tbl = catalog.create_table(ident, schema=data.schema)
        tbl.overwrite(data)
    else:
        tbl = catalog.create_table(ident, schema=data.schema)
        tbl.append(data)

    return data.num_rows
