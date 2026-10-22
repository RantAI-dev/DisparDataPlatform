"""Data `/scraped-hotels` (KONTRAK §2.5, SPEC P5)."""

from __future__ import annotations

from data_api.shared import lake
from data_api.shared.konteks import Konteks
from data_api.shared.respons import angka_js

from . import logika

TABEL = "booking_hotel_2026_09_15"


def hotel_scraped(k: Konteks, limit: int) -> dict:
    return k.cache.ambil(
        ("hotel-scraped", limit),
        k.konf.cache_ttl_default,
        lambda: angka_js(logika.hotel_scraped(lake.baris_bronze(k, TABEL), limit)),
    )
