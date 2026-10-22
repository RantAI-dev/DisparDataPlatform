"""Metadata dan baris dataset lake yang dipakai lebih dari satu fitur (dataset, indikator).

Port fungsi `platform-v2/lib/ch/store.ts` (`tableFor`, `silverAda`, `columns`, `columnKeys`,
`tiers`, `rowsForRaw`). Daftar tabel Silver di-cache 10 menit (bukan sampai restart, E §4.4).
"""

from __future__ import annotations

from typing import Any

from . import queries
from .konteks import Konteks

TTL_DAFTAR_TABEL = 600


def silver_ada(k: Konteks) -> set[str]:
    return k.cache.ambil(("tabel", "silver"), TTL_DAFTAR_TABEL, lambda: queries.daftar_tabel(k, "silver"))


def tabel_untuk(k: Konteks, slug: str) -> str | None:
    return k.cache.ambil(("tabel_untuk", slug), k.konf.cache_ttl_default, lambda: queries.tabel_untuk(k, slug))


def kolom_dataset(k: Konteks, slug: str) -> list[dict[str, Any]]:
    return queries.kolom_dataset(k, slug)


def kunci_kolom(k: Konteks, slugs: list[str]) -> dict[str, set[str]]:
    hasil: dict[str, set[str]] = {}
    if not slugs:
        return hasil
    for r in queries.kunci_kolom(k, slugs):
        hasil.setdefault(r["slug"], set()).add(r["key_asli"])
    return hasil


def tier_dataset(k: Konteks, slugs: list[str]) -> dict[str, str]:
    if not slugs:
        return {}
    return {r["slug"]: r["tier"] for r in queries.tier_dataset(k, slugs)}


def baris_dataset(k: Konteks, slug: str) -> list[dict[str, Any]]:
    """Seluruh baris Silver sebuah slug; kosong bila slug belum punya tabel Silver."""
    tabel = tabel_untuk(k, slug)
    if not tabel or tabel not in silver_ada(k):
        return []
    return queries.baris_silver(k, tabel)
