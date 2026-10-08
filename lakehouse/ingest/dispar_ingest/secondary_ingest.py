"""Ingest dataset SEKUNDER (data olahan/kurasi) ke lake.

Dataset sekunder adalah JSON {slug,title,description,columns,rows} di
data/sekunder/ — wisman bersih per negara/bulan/pintu, TripAdvisor, halal,
artis chart, dll. Ini DATA PROCESSED (sudah dibersihkan), yang memang mau
ditampilkan app 1:1.

Menulis:
  bronze_sec.<safe(slug)>              — baris (all-string)
  bronze_meta_sec.dataset_catalog      — slug/title/tags/tier=sekunder
  bronze_meta_sec.dataset_sync         — metadata + total
  bronze_meta_sec.dataset_column       — key_asli/key_safe/tipe/deskripsi

Store meng-UNION meta primer+sekunder; generate_silver mengetik bronze_sec
juga (silver.<safe(slug)>), sehingga tampilan memakai data processed.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pyarrow as pa

from .lake import build_table, get_catalog, safe_name, write_bronze
from .meta import _replace_table

# File tanpa slug embedded → slug/title dari secondary.ts.
OVERRIDE = {
    "event-visitors-2026.json": (
        "jumlah-pengunjung-event-2026", "Jumlah Pengunjung Event 2026",
        "Estimasi jumlah pengunjung event pariwisata & kebudayaan DKI Jakarta 2026.",
        ["event", "pengunjung", "2026", "sekunder"],
    ),
    "souvenir-tripadvisor-2026.json": (
        "toko-suvenir-tripadvisor-2026", "Toko Suvenir TripAdvisor 2026",
        "Toko suvenir DKI Jakarta bersumber TripAdvisor untuk indikator GCI.",
        ["souvenir", "tripadvisor", "gci", "sekunder"],
    ),
}

TAGS = {  # tag per slug (dari secondary.ts) untuk yg tak jelas dari file
    "wisman-jakarta-per-negara": ["wisman", "mancanegara", "negara", "sekunder"],
    "wisman-jakarta-per-bulan": ["wisman", "mancanegara", "bulanan", "sekunder"],
    "wisman-jakarta-per-pintu-masuk": ["wisman", "pintu-masuk", "sekunder"],
}


def _load(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    fname = os.path.basename(path)
    slug = d.get("slug")
    title = d.get("title")
    desc = d.get("description") or ""
    tags = ["sekunder"]
    if fname in OVERRIDE:
        slug, title, desc, tags = OVERRIDE[fname]
    if not slug:
        slug = safe_name(fname.replace(".json", ""))
    if slug in TAGS:
        tags = TAGS[slug]
    return {
        "slug": slug,
        "title": title or slug,
        "description": desc,
        "tags": tags,
        "columns": d.get("columns") or [],
        "rows": d.get("rows") or [],
    }


def ingest_secondary(
    root: str | os.PathLike[str] | None = None,
    tenant: str = "dispar-dki",
    catalog: Any = None,
) -> dict[str, Any]:
    """Tarik dataset sekunder dari registri ke bronze_sec.* dan perbarui meta sekunder.

    - Hanya menulis ulang Bronze untuk berkas yang sha256-nya berubah atau belum ada
      di log 'masuk'.
    - Membangun ketiga tabel bronze_meta_sec.* dari SEMUA dataset sekunder di registri.
    - Bila ada satu pun berkas terdaftar yang hilang atau gagal dibaca, melempar error
      dan ketiga tabel meta tidak disentuh.
    """
    from .files import compute_sha256
    from .meta import append_ingest_log, get_last_success_hashes
    from .sources import _akar, load

    if catalog is None:
        catalog = get_catalog()
    now = datetime.now(timezone.utc)
    batch = now.strftime("%Y%m%dT%H%M%SZ")

    registry = load(root)
    base = _akar(root)
    sekunder_list = [s for s in registry.sumber if s.jenis == "sekunder"]
    print(f"{len(sekunder_list)} dataset sekunder di registri (akar {base})\n", flush=True)

    # 1. Pastikan SEMUA berkas terdaftar terbaca dengan baik.
    # Jika ada berkas hilang/rusak, hentikan proses sebelum mengubah Bronze/meta.
    loaded: list[tuple[Any, Path, dict[str, Any]]] = []
    for s in sekunder_list:
        full_path = base / (s.path or "")
        if not full_path.is_file():
            raise FileNotFoundError(f"Berkas sekunder tidak ditemukan: {full_path}")
        try:
            ds = _load(str(full_path))
        except Exception as exc:
            raise RuntimeError(f"Gagal membaca berkas sekunder {full_path}: {exc}") from exc
        loaded.append((s, full_path, ds))

    latest_hashes = get_last_success_hashes(catalog)

    cat: dict[str, list[Any]] = {
        k: [] for k in ["slug", "title", "description", "tags", "views", "updated_at", "tier", "table_name"]
    }
    syn: dict[str, list[Any]] = {
        k: [] for k in [
            "slug", "title", "description", "sumber_data", "frekuensi", "satuan",
            "klasifikasi", "kontak", "author", "total", "table_name", "synced_at"
        ]
    }
    col: dict[str, list[Any]] = {
        k: [] for k in ["slug", "ord", "key_asli", "key_safe", "tipe", "deskripsi"]
    }

    ok = 0
    dilewati = 0

    for s, full_path, ds in loaded:
        slug = ds["slug"]
        table = s.tabel or safe_name(ds["slug"])
        rows = ds["rows"]
        sha = compute_sha256(full_path)

        if sha == latest_hashes.get(s.id):
            print(f"  {slug}: LEWAT (tidak berubah)", flush=True)
            n = len(rows)
            dilewati += 1
        else:
            data = build_table(
                rows, source_url=f"file://{s.path}", batch_id=batch, tenant=tenant
            )
            if data is None:
                print(f"  {slug}: KOSONG", flush=True)
                append_ingest_log(
                    catalog,
                    sumber_id=s.id,
                    namespace=s.namespace,
                    tabel=table,
                    sha256=sha,
                    baris=0,
                    status="kosong",
                    pesan="data kosong",
                )
                n = 0
            else:
                n = write_bronze(catalog, s.namespace, table, data)
                append_ingest_log(
                    catalog,
                    sumber_id=s.id,
                    namespace=s.namespace,
                    tabel=table,
                    sha256=sha,
                    baris=n,
                    status="masuk",
                )
            print(f"  {slug} — {n} baris, {len(ds['columns'])} kolom", flush=True)
            ok += 1

        cat["slug"].append(slug)
        cat["title"].append(ds["title"])
        cat["description"].append(ds["description"])
        cat["tags"].append(json.dumps(ds["tags"], ensure_ascii=False))
        cat["views"].append(0)
        cat["updated_at"].append(now.strftime("%Y-%m-%d"))
        cat["tier"].append("sekunder")
        cat["table_name"].append(table)

        syn["slug"].append(slug)
        syn["title"].append(ds["title"])
        syn["description"].append(ds["description"])
        syn["sumber_data"].append(json.dumps([], ensure_ascii=False))
        syn["frekuensi"].append("")
        syn["satuan"].append("")
        syn["klasifikasi"].append("")
        syn["kontak"].append("")
        syn["author"].append("Dinas Pariwisata & Ekonomi Kreatif DKI Jakarta")
        syn["total"].append(int(n))
        syn["table_name"].append(table)
        syn["synced_at"].append(now)

        for ord_, c in enumerate(ds["columns"]):
            key = str(c.get("key") or "")
            if not key:
                continue
            col["slug"].append(slug)
            col["ord"].append(ord_)
            col["key_asli"].append(key)
            col["key_safe"].append(safe_name(key))
            col["tipe"].append(str(c.get("type") or ""))
            col["deskripsi"].append(str(c.get("description") or c.get("label") or ""))

    _replace_table(catalog, "bronze_meta_sec", "dataset_catalog", pa.table({
        "slug": pa.array(cat["slug"], pa.string()),
        "title": pa.array(cat["title"], pa.string()),
        "description": pa.array(cat["description"], pa.string()),
        "tags": pa.array(cat["tags"], pa.string()),
        "views": pa.array(cat["views"], pa.int64()),
        "updated_at": pa.array(cat["updated_at"], pa.string()),
        "tier": pa.array(cat["tier"], pa.string()),
        "table_name": pa.array(cat["table_name"], pa.string()),
    }))
    _replace_table(catalog, "bronze_meta_sec", "dataset_sync", pa.table({
        "slug": pa.array(syn["slug"], pa.string()),
        "title": pa.array(syn["title"], pa.string()),
        "description": pa.array(syn["description"], pa.string()),
        "sumber_data": pa.array(syn["sumber_data"], pa.string()),
        "frekuensi": pa.array(syn["frekuensi"], pa.string()),
        "satuan": pa.array(syn["satuan"], pa.string()),
        "klasifikasi": pa.array(syn["klasifikasi"], pa.string()),
        "kontak": pa.array(syn["kontak"], pa.string()),
        "author": pa.array(syn["author"], pa.string()),
        "total": pa.array(syn["total"], pa.int64()),
        "table_name": pa.array(syn["table_name"], pa.string()),
        "synced_at": pa.array(syn["synced_at"], pa.timestamp("us", tz="UTC")),
    }))
    _replace_table(catalog, "bronze_meta_sec", "dataset_column", pa.table({
        "slug": pa.array(col["slug"], pa.string()),
        "ord": pa.array(col["ord"], pa.int64()),
        "key_asli": pa.array(col["key_asli"], pa.string()),
        "key_safe": pa.array(col["key_safe"], pa.string()),
        "tipe": pa.array(col["tipe"], pa.string()),
        "deskripsi": pa.array(col["deskripsi"], pa.string()),
    }))
    laporan = {
        "dataset": ok + dilewati,
        "diperbarui": ok,
        "dilewati": dilewati,
        "katalog": len(cat["slug"]),
        "kolom": len(col["slug"]),
    }
    print("\n" + json.dumps(laporan, ensure_ascii=False), flush=True)
    return laporan


if __name__ == "__main__":
    import sys
    ingest_secondary(root=sys.argv[1] if len(sys.argv) > 1 else None)
    sys.exit(0)
