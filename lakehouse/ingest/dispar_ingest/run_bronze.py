"""Entrypoint ingestion Bronze.

    python -m dispar_ingest.run_bronze sdi            # semua dataset SDI
    python -m dispar_ingest.run_bronze sdi --limit 5  # cicipi dulu
    python -m dispar_ingest.run_bronze files          # berkas lokal
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .lake import build_table, get_catalog, safe_name, write_bronze
from .sdi import SdiClient


def _batch_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _tenant() -> str:
    return os.environ.get("TENANT", "dispar-dki")


def ingest_sdi(limit: int | None = None, only: list[str] | None = None) -> dict:
    """Tarik dataset SDI ke bronze_sdi.*. Kegagalan satu dataset tidak
    menghentikan sisanya — laporan akhir mencatat mana yang gagal."""
    client = SdiClient()
    catalog = get_catalog()
    batch = _batch_id()
    tenant = _tenant()

    print("Mengambil daftar dataset SDI...", flush=True)
    datasets = client.list_datasets()
    if only:
        datasets = [d for d in datasets if d.slug in set(only)]
    if limit:
        datasets = datasets[:limit]
    print(f"{len(datasets)} dataset akan ditarik\n", flush=True)

    ok, kosong, gagal = [], [], []
    total_rows = 0
    started = time.time()

    for i, ds in enumerate(datasets, 1):
        table_name = safe_name(ds.slug)
        prefix = f"[{i}/{len(datasets)}] {ds.slug}"
        try:
            rows = list(client.dataset_rows(ds.slug))
            data = build_table(
                rows, source_url=ds.url, batch_id=batch, tenant=tenant
            )
            if data is None:
                print(f"{prefix} — KOSONG", flush=True)
                kosong.append(ds.slug)
                continue
            n = write_bronze(catalog, "bronze_sdi", table_name, data)
            total_rows += n
            print(f"{prefix} — {n} baris", flush=True)
            ok.append(ds.slug)
        except Exception as e:  # noqa: BLE001 — satu dataset gagal tidak boleh
            # menjatuhkan seluruh batch; SDI sering 500 saat maintenance.
            print(f"{prefix} — GAGAL: {e}", flush=True)
            traceback.print_exc(limit=1)
            gagal.append({"slug": ds.slug, "error": str(e)})

    laporan = {
        "batch_id": batch,
        "tenant": tenant,
        "durasi_detik": round(time.time() - started, 1),
        "dataset_total": len(datasets),
        "berhasil": len(ok),
        "kosong": len(kosong),
        "gagal": len(gagal),
        "baris_total": total_rows,
        "daftar_kosong": kosong,
        "daftar_gagal": gagal,
    }
    print("\n" + json.dumps(laporan, indent=2, ensure_ascii=False), flush=True)
    return laporan


def ingest_files(
    root: str | os.PathLike[str] | None = None,
    tenant: str | None = None,
    catalog: Any = None,
) -> dict:
    """Tarik berkas lokal (TSV/CSV/XLSX/JSON) dari registri ke bronze_file.*.

    Hanya meng-ingest berkas yang sha256-nya berbeda dari sha256 baris 'masuk'
    terakhir di bronze_meta.ingest_log.
    """
    from .files import compute_sha256, read_file
    from .meta import append_ingest_log, get_last_success_hashes
    from .sources import _akar, load

    if catalog is None:
        catalog = get_catalog()
    batch = _batch_id()
    if tenant is None:
        tenant = _tenant()

    registry = load(root)
    base = _akar(root)
    berkas_list = [s for s in registry.sumber if s.jenis == "berkas"]
    print(f"{len(berkas_list)} berkas terdaftar di registri (akar {base})\n", flush=True)

    latest_hashes = get_last_success_hashes(catalog)

    ok, dilewati, kosong, gagal = [], [], [], []
    total_rows = 0

    for i, s in enumerate(berkas_list, 1):
        full_path = base / (s.path or "")
        prefix = f"[{i}/{len(berkas_list)}] {s.id}"
        table_name = s.tabel or safe_name(s.id)
        namespace = s.namespace or "bronze_file"

        try:
            sha = compute_sha256(full_path)
            if sha == latest_hashes.get(s.id):
                print(f"{prefix} — LEWAT (tidak berubah)", flush=True)
                dilewati.append(s.id)
                continue

            rows = read_file(str(full_path))
            data = build_table(
                rows, source_url=f"file://{s.path}", batch_id=batch, tenant=tenant
            )
            if data is None:
                print(f"{prefix} — KOSONG", flush=True)
                append_ingest_log(
                    catalog,
                    sumber_id=s.id,
                    namespace=namespace,
                    tabel=table_name,
                    sha256=sha,
                    baris=0,
                    status="kosong",
                    pesan="data kosong",
                )
                kosong.append(s.id)
                continue

            n = write_bronze(catalog, namespace, table_name, data)
            append_ingest_log(
                catalog,
                sumber_id=s.id,
                namespace=namespace,
                tabel=table_name,
                sha256=sha,
                baris=n,
                status="masuk",
            )
            total_rows += n
            print(f"{prefix} — {n} baris → {table_name}", flush=True)
            ok.append(s.id)
        except Exception as e:  # noqa: BLE001
            print(f"{prefix} — GAGAL: {e}", flush=True)
            try:
                sha = compute_sha256(full_path) if full_path.is_file() else ""
            except Exception:
                sha = ""
            try:
                append_ingest_log(
                    catalog,
                    sumber_id=s.id,
                    namespace=namespace,
                    tabel=table_name,
                    sha256=sha,
                    baris=0,
                    status="gagal",
                    pesan=str(e),
                )
            except Exception:
                pass
            gagal.append({"sumber_id": s.id, "file": s.path, "error": str(e)})

    laporan = {
        "batch_id": batch,
        "berkas_total": len(berkas_list),
        "berhasil": len(ok),
        "dilewati": len(dilewati),
        "kosong": len(kosong),
        "gagal": len(gagal),
        "baris_total": total_rows,
        "daftar_dilewati": dilewati,
        "daftar_kosong": kosong,
        "daftar_gagal": gagal,
    }
    print("\n" + json.dumps(laporan, indent=2, ensure_ascii=False), flush=True)
    return laporan


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Ingestion Bronze lakehouse Dispar")
    sub = p.add_subparsers(dest="perintah", required=True)

    p_sdi = sub.add_parser("sdi", help="tarik dataset dari Satu Data Jakarta")
    p_sdi.add_argument("--limit", type=int, default=None)
    p_sdi.add_argument("--only", nargs="*", default=None, help="slug tertentu saja")

    p_file = sub.add_parser("files", help="tarik berkas lokal")
    p_file.add_argument("--root", default=None)

    args = p.parse_args(argv)
    if args.perintah == "sdi":
        laporan = ingest_sdi(limit=args.limit, only=args.only)
        return 1 if laporan["berhasil"] == 0 else 0
    laporan = ingest_files(root=args.root)
    return 1 if laporan["gagal"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
