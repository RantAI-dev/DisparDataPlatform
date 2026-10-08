"""Backup & restore lakehouse — mirror bucket RustFS (Iceberg) via s3fs.

Base lakehouse tanpa backup = satu disk mati, semua Bronze hilang (dan Bronze
sumber rekonstruksi seluruh lapisan). Modul ini menyalin SELURUH objek bucket
lake (Iceberg Parquet + metadata) ke bucket backup terpisah lewat S3 API —
inkremental (hanya objek baru/berubah), murah dijalankan harian.

Memakai **s3fs** (sudah ada via pyiceberg[s3fs]) — TIDAK menambah dependency
(boto3 bikin pip resolution-too-deep di dep tree dlt+pyiceberg).

Target:
  - default: bucket `lakehouse-backup` di RustFS yang sama (proteksi salah-hapus;
    TIDAK melindungi dari disk mati).
  - offsite: set BACKUP_S3_ENDPOINT/KEY/SECRET ke object storage lain
    (server/region beda) → proteksi disk/host mati. Inilah yang dianjurkan.
"""

from __future__ import annotations

import json
import os
import random
import sys
import time

import s3fs


def _fs(endpoint: str, key: str, secret: str) -> s3fs.S3FileSystem:
    return s3fs.S3FileSystem(
        key=key,
        secret=secret,
        client_kwargs={"endpoint_url": endpoint, "region_name": os.environ.get("S3_REGION", "local-01")},
        config_kwargs={"s3": {"addressing_style": "path"}},
    )


def _ensure_bucket(fs: s3fs.S3FileSystem, bucket: str) -> None:
    try:
        if not fs.exists(bucket):
            fs.mkdir(bucket)
    except Exception:  # noqa: BLE001 — mkdir bisa gagal kalau sudah ada (race), abaikan
        pass


def _retry_s3(fn, *args, max_attempts: int = 4, base_delay: float = 0.5, **kwargs):
    """Jalankan operasi S3 dengan retry otomatis saat terjadi error transien (503, SlowDown, timeout)."""
    for attempt in range(1, max_attempts + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            err_msg = str(e).lower()
            is_transient = (
                isinstance(e, (OSError, TimeoutError, ConnectionError))
                or "slowdown" in err_msg
                or "unavailable" in err_msg
                or "reduce your request rate" in err_msg
                or "retry" in err_msg
                or "timeout" in err_msg
            )
            if attempt == max_attempts or not is_transient:
                raise
            delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0, 0.1)
            time.sleep(delay)


def run_backup(tanggal: str = "latest") -> dict:
    src_endpoint = os.environ.get("S3_ENDPOINT", "http://lake-rustfs:9000")
    src_key = os.environ.get("S3_ACCESS_KEY", "disparlake")
    src_secret = os.environ.get("S3_SECRET_KEY", "disparlakesecret")
    src_bucket = os.environ.get("LAKE_BUCKET", "lakehouse")

    dst_endpoint = os.environ.get("BACKUP_S3_ENDPOINT") or src_endpoint
    dst_key = os.environ.get("BACKUP_S3_ACCESS_KEY") or src_key
    dst_secret = os.environ.get("BACKUP_S3_SECRET_KEY") or src_secret
    dst_bucket = os.environ.get("BACKUP_BUCKET", "lakehouse-backup")

    offsite = (os.environ.get("BACKUP_S3_ENDPOINT") or "") not in ("", src_endpoint)
    src = _fs(src_endpoint, src_key, src_secret)
    dst = _fs(dst_endpoint, dst_key, dst_secret)
    _ensure_bucket(dst, dst_bucket)

    prefix = f"{dst_bucket}/{tanggal}"
    # Indeks size objek tujuan (inkremental).
    existing: dict[str, int] = {}
    try:
        for info in dst.find(prefix, detail=True).values():
            existing[info["Key"] if "Key" in info else info["name"]] = info.get("size", -1)
    except Exception:  # noqa: BLE001
        existing = {}

    disalin = dilewati = total_bytes = 0
    for info in src.find(src_bucket, detail=True).values():
        key = info["name"]  # "lakehouse/dispar-dki/bronze_sdi/..."
        rel = key[len(src_bucket) + 1:]
        dst_path = f"{prefix}/{rel}"
        size = info.get("size", -1)
        if existing.get(dst_path) == size and size >= 0:
            dilewati += 1
            continue
        data = _retry_s3(src.cat_file, key)
        _retry_s3(dst.pipe_file, dst_path, data)
        disalin += 1
        total_bytes += len(data)

    laporan = {
        "tanggal": tanggal,
        "offsite": offsite,
        "dst": f"{dst_endpoint}/{prefix}",
        "objek_disalin": disalin,
        "objek_dilewati_sama": dilewati,
        "bytes_disalin": total_bytes,
    }
    _retry_s3(dst.pipe_file, f"{prefix}/_manifest.json", json.dumps(laporan, ensure_ascii=False).encode())
    print(json.dumps(laporan, indent=2, ensure_ascii=False), flush=True)
    if not offsite:
        print(
            "PERINGATAN: backup ke RustFS yang SAMA (belum offsite). Set "
            "BACKUP_S3_ENDPOINT ke storage lain untuk proteksi disk/host mati.",
            flush=True,
        )
    return laporan


def run_restore(tanggal: str = "latest", target_bucket: str | None = None) -> dict:
    """Pulihkan objek dari backup <tanggal> ke bucket lake (atau target lain).
    Backup tak teruji restore = tak bisa diandalkan; jalankan ke bucket uji dulu.
    """
    dst_endpoint = os.environ.get("BACKUP_S3_ENDPOINT") or os.environ.get("S3_ENDPOINT", "http://lake-rustfs:9000")
    dst_key = os.environ.get("BACKUP_S3_ACCESS_KEY") or os.environ.get("S3_ACCESS_KEY", "disparlake")
    dst_secret = os.environ.get("BACKUP_S3_SECRET_KEY") or os.environ.get("S3_SECRET_KEY", "disparlakesecret")
    dst_bucket = os.environ.get("BACKUP_BUCKET", "lakehouse-backup")

    lake_endpoint = os.environ.get("S3_ENDPOINT", "http://lake-rustfs:9000")
    lake_key = os.environ.get("S3_ACCESS_KEY", "disparlake")
    lake_secret = os.environ.get("S3_SECRET_KEY", "disparlakesecret")
    into = target_bucket or os.environ.get("RESTORE_BUCKET", "lakehouse")

    bk = _fs(dst_endpoint, dst_key, dst_secret)
    lake = _fs(lake_endpoint, lake_key, lake_secret)
    _ensure_bucket(lake, into)

    prefix = f"{dst_bucket}/{tanggal}"
    dipulihkan = 0
    for info in bk.find(prefix, detail=True).values():
        key = info["name"]
        if key.endswith("_manifest.json"):
            continue
        rel = key[len(prefix) + 1:]
        data = _retry_s3(bk.cat_file, key)
        _retry_s3(lake.pipe_file, f"{into}/{rel}", data)
        dipulihkan += 1
    laporan = {"tanggal": tanggal, "ke_bucket": into, "objek_dipulihkan": dipulihkan}
    print(json.dumps(laporan, indent=2, ensure_ascii=False), flush=True)
    return laporan


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "restore":
        run_restore(sys.argv[2] if len(sys.argv) > 2 else "latest",
                    sys.argv[3] if len(sys.argv) > 3 else None)
    else:
        run_backup(sys.argv[1] if len(sys.argv) > 1 else "latest")
    sys.exit(0)
