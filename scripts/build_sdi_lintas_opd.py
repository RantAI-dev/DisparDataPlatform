#!/usr/bin/env python3
"""Build dataset sekunder dari dataset Satu Data Jakarta milik OPD lain.

Ingest harian (`dispar_ingest.run_bronze.ingest_sdi`) hanya menarik dataset
organisasi Disparekraf, jadi dataset OPD lain yang relevan untuk pariwisata
(museum, ruang terbuka hijau) diambil di sini sebagai snapshot, mengikuti
preseden `scripts/build_desa_wisata.py`. Semua dataset ini terbit setahun sekali.

Memakai klien SDI yang sama dengan pipeline (`lakehouse/ingest/dispar_ingest/sdi.py`)
supaya tidak ada dua implementasi API SDI.

Cache: `scripts/sdi_lintas_opd_cache.json` — per slug SDI menyimpan status
("ok" | "gagal"), metadata, dan baris mentah. Dataset berstatus "ok" tidak
ditarik ulang kecuali dengan `--refresh`. Disimpan setelah tiap dataset.

Output per dataset: `data/sekunder/<slug>.json` + mirror `platform-v2/data/`.

Jalankan dari root repo:
    uv run --project lakehouse/ingest python scripts/build_sdi_lintas_opd.py [--refresh]
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

from dispar_ingest.sdi import SdiClient, SdiError

CACHE = Path("scripts/sdi_lintas_opd_cache.json")
OUT_DIRS = (Path("data/sekunder"), Path("platform-v2/data"))
PORTAL = "https://satudata.jakarta.go.id/open-data/detail?kategori=dataset&page_url={}&data_no=1"

# slug SDI → slug dataset sekunder kita
DATASETS = {
    "data-museum-di-provinsi-dki-jakarta": "museum-jakarta",
    "data-jalur-hijau-kota": "jalur-hijau-jakarta",
    "data-hutan-di-provinsi-dki-jakarta": "hutan-kota-jakarta",
    "data-jumlah-dan-luas-taman-menurut-jenis-dan-kabupatenkota-administrasi-di-provinsi-dki-jakarta": "taman-jakarta",
}

# Catatan mutu sumber yang perlu diketahui pembaca (tidak diperbaiki di sini:
# angka yang rusak tidak ditebak).
CATATAN = {
    "data-museum-di-provinsi-dki-jakarta": "Koordinat sebagian baris di sumber tidak valid (format desimal rusak); kolom latitude/longitude disimpan apa adanya sebagai teks.",
    "data-hutan-di-provinsi-dki-jakarta": "Koordinat di sumber tidak valid (pemisah ribuan tercampur); kolom latitude/longitude disimpan apa adanya sebagai teks.",
}

# Kolom teknis portal yang tidak bermakna untuk pembaca.
SKIP_COLS = {"id", "user_id", "tanggal_upload", "tanggal_update", "uid_upload",
             "batch_upload", "jadwal_rilis", "created_at", "updated_at"}


def fetch(client: SdiClient, sdi_slug: str) -> dict:
    d = client.dataset_detail(sdi_slug)
    rows = list(client.dataset_rows(sdi_slug))
    return {
        "status": "ok", "diambil": date.today().isoformat(),
        "title": d.title, "description": d.description, "sumber_data": d.sumber_data,
        "frekuensi": d.frekuensi, "satuan": d.satuan, "columns": d.columns, "rows": rows,
    }


def is_num(v) -> bool:
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return True
    return isinstance(v, str) and re.fullmatch(r"-?\d+(\.\d+)?", v.strip() or "x") is not None


def clean(v, numeric: bool):
    """Rapikan spasi/baris baru dari portal; nilai lain dibiarkan apa adanya."""
    if isinstance(v, str):
        v = v.strip() or None
    return float(v) if numeric and v is not None else v


def build(sdi_slug: str, slug: str, c: dict) -> dict:
    keys = [k for k in (c["rows"][0] if c["rows"] else {}) if k not in SKIP_COLS]
    desc = {col["key"]: col.get("description") for col in c["columns"]}
    columns = []
    for k in keys:
        vals = [r.get(k) for r in c["rows"] if r.get(k) not in (None, "")]
        # periode_data berupa tahun → tetap string supaya tidak dijumlahkan.
        numeric = k != "periode_data" and bool(vals) and all(is_num(v) for v in vals)
        columns.append({"key": k, "label": k.replace("_", " ").title(),
                        "type": "number" if numeric else "string", "description": desc.get(k)})
    num = {col["key"] for col in columns if col["type"] == "number"}
    rows = [{k: clean(r.get(k), k in num) for k in keys} for r in c["rows"]]
    for r in rows:  # bilangan bulat tetap bulat
        for k in num:
            if isinstance(r[k], float) and r[k].is_integer():
                r[k] = int(r[k])
    periode = sorted({str(r.get("periode_data")) for r in rows if r.get("periode_data")})
    sumber = ", ".join(c["sumber_data"]) or "OPD terkait"
    return {
        "slug": slug,
        "title": c["title"],
        "description": (
            (c["description"].strip().rstrip(".") + ". " if c["description"].strip() else "")
            + f"Sumber: Satu Data Jakarta ({sumber}), dataset '{sdi_slug}'"
            + (f", periode {', '.join(periode)}" if periode else "")
            + f"; snapshot diambil {c['diambil']}. {PORTAL.format(sdi_slug)}"
            + (f" {CATATAN[sdi_slug]}" if sdi_slug in CATATAN else "")
        ),
        "columns": columns,
        "rows": rows,
    }


def main() -> None:
    refresh = "--refresh" in sys.argv
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    client = SdiClient()
    for sdi_slug in DATASETS:
        if not refresh and cache.get(sdi_slug, {}).get("status") == "ok":
            continue
        try:
            cache[sdi_slug] = fetch(client, sdi_slug)
        except SdiError as e:
            cache[sdi_slug] = {"status": "gagal", "error": str(e)[:300]}
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0), encoding="utf-8")

    for sdi_slug, slug in DATASETS.items():
        c = cache.get(sdi_slug, {})
        if c.get("status") != "ok":
            print(f"GAGAL {sdi_slug}: {c.get('error')}")
            continue
        text = json.dumps(build(sdi_slug, slug, c), ensure_ascii=False, indent=2) + "\n"
        for d in OUT_DIRS:
            (d / f"{slug}.json").write_text(text, encoding="utf-8")
        print(f"{slug}: {len(c['rows'])} baris")


if __name__ == "__main__":
    main()
