"""Data `/gmti` (KONTRAK §2.5): ringkasan dan daftar tempat berhalaman dengan filter di server."""

from __future__ import annotations

from data_api.shared import lake
from data_api.shared.konteks import Konteks
from data_api.shared.paging import Halaman
from data_api.shared.respons import angka_js

from . import logika

TABEL = ["gmti_tempat", "gmti_kecamatan", "gmti_tipologi", "gmti_capaian", "gmti_ibadah"]


def ringkasan(k: Konteks) -> dict:
    def buat() -> dict:
        return angka_js(
            logika.ringkasan(
                lake.baris_bronze(k, "gmti_ibadah"),
                lake.baris_bronze(k, "gmti_tempat"),
                lake.baris_bronze(k, "gmti_kecamatan"),
                lake.baris_bronze(k, "gmti_tipologi"),
                lake.baris_bronze(k, "gmti_capaian"),
            )
        )

    return k.cache.ambil(("gmti", "ringkasan"), k.konf.cache_ttl_default, buat)


def _pool(k: Konteks, pilar: str) -> list[dict]:
    def buat() -> list[dict]:
        daftar = logika.pool(pilar, lake.baris_bronze(k, "gmti_ibadah"), lake.baris_bronze(k, "gmti_tempat"))
        return angka_js([{**p, "maps_url": logika.maps_url(p)} for p in daftar])

    return k.cache.ambil(("gmti", "pool", pilar), k.konf.cache_ttl_default, buat)


def tempat(k: Konteks, pilar: str, kota: str | None, jenis: str | None, q: str | None, h: Halaman):
    """(items halaman, facets, total) — facets dari pool tab sebelum filter, seperti GmtiView."""
    pool = _pool(k, pilar)
    facets = k.cache.ambil(("gmti", "facets", pilar), k.konf.cache_ttl_default, lambda: logika.facets(pool))
    hasil = logika.saring(pool, kota, jenis, q)
    return hasil[h.offset : h.offset + h.size], facets, len(hasil)
