"""Baris `lake.bronze_file.*` dari berkas `data/statis/*.json`, dibentuk persis seperti ingest.

Konversi sama dengan `lakehouse/ingest/dispar_ingest/lake.py`: `safe_name` untuk nama kolom, `to_text` untuk
nilai, union kolom dengan `None` untuk kolom yang tak dimiliki baris. Dipakai tes unit/kontrak fitur atlas,
GMTI, spasial, dan hotel-scraped (urutan baris = urutan berkas, sama dengan pindaian Bronze).
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_DATA_API = Path(__file__).resolve().parents[1]
_DATA = _DATA_API.parents[1] / "data"
_GOLDEN = _DATA_API / "tests" / "golden"

# ── konversi ingest (tiruan lake.safe_name / lake.to_text / lake.build_table) ──

_SLUG_RE = re.compile(r"[^a-z0-9_]+")


def _safe_name(raw: str) -> str:
    name = _SLUG_RE.sub("_", str(raw).strip().lower()).strip("_")
    if not name:
        name = "kolom"
    if name[0].isdigit():
        name = f"k_{name}"
    return name[:200]


def _to_text(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, str):
        return v
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False, default=str)
    return str(v)


def ke_bronze(rows: list[dict[str, Any]]) -> list[dict[str, str | None]]:
    keys: list[str] = []
    for r in rows:
        for k in r:
            if _safe_name(k) not in keys:
                keys.append(_safe_name(k))
    hasil = []
    for r in rows:
        normal = {_safe_name(k): _to_text(v) for k, v in r.items()}
        hasil.append({k: normal.get(k) for k in keys})
    return hasil


def bronze(nama: str, folder: str = "statis") -> list[dict[str, str | None]]:
    return ke_bronze(json.loads((_DATA / folder / f"{nama}.json").read_text(encoding="utf-8")))


def golden(nama: str) -> dict:
    return json.loads((_GOLDEN / f"{nama}.json").read_text(encoding="utf-8"))


def tipe(x: Any) -> Any:
    """Struktur yang sama dengan nilai daun diganti nama tipenya (bedakan int/float/bool)."""
    if isinstance(x, dict):
        return {k: tipe(v) for k, v in x.items()}
    if isinstance(x, list):
        return [tipe(v) for v in x]
    return type(x).__name__
