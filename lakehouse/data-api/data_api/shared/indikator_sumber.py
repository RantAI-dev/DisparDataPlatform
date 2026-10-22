"""Daftar indikator GCI/GPCI (dipakai beranda dan indikator).

Produksi membaca `lake.bronze_file.gci_gpci_indicators`. Selama salinan Bronze masih basi (sampai
plan 06 bagian A), panggung boleh memakai berkas JSON lewat env `INDIKATOR_BERKAS`; env itu ditolak
saat start bila `DATA_API_ENV=produksi` (lihat `konfigurasi.py`).

Bentuk keluaran sama dengan `data/gci-gpci-indicators.json`: kunci camelCase, `dataAvailable`
boolean, `match` list, `officialNo` int (hanya bila ada).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from . import queries
from .konteks import Konteks

TABEL = "gci_gpci_indicators"
# Bronze menyimpan nama kolom huruf kecil; kembalikan ke kunci berkas sumber.
_KUNCI = {k.lower(): k for k in ("dataAvailable", "draftReadiness", "officialNo", "officialName")}


def _dari_bronze(r: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for kol, v in r.items():
        kunci = _KUNCI.get(kol, kol)
        if kunci == "dataAvailable":
            v = str(v).lower() == "true"
        elif kunci == "match":
            v = json.loads(v) if v else []
        elif kunci == "officialNo":
            if v in (None, ""):
                continue
            v = int(float(v))
        out[kunci] = v
    return out


def daftar(k: Konteks) -> list[dict[str, Any]]:
    def buat() -> list[dict[str, Any]]:
        if k.konf.indikator_berkas:
            return json.loads(Path(k.konf.indikator_berkas).read_text(encoding="utf-8"))
        return [_dari_bronze(r) for r in queries.baris_bronze_file(k, TABEL)]

    return k.cache.ambil(("indikator", "daftar"), k.konf.cache_ttl_default, buat)


def bronze_punya_official_no(k: Konteks) -> bool:
    """Pemeriksaan start produksi: salinan Bronze sudah memuat `officialNo`."""
    return any("officialNo" in r for r in daftar(k))
