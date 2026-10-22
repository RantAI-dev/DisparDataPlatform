"""Data enam subhalaman atlas (KONTRAK §2.4): baca Bronze lalu jalankan logika port platform-v2."""

from __future__ import annotations

from data_api.shared import hitungan, lake
from data_api.shared.konteks import Konteks
from data_api.shared.respons import angka_js

from . import logika

GCI = hitungan.TABEL_GABUNGAN["restoran_gci"]
DIREKTORI = hitungan.TABEL_GABUNGAN["direktori_restoran"]
HOTEL = ["hotel_registri", "hotel_tpk", "hotel_los"]


def _cache(k: Konteks, kunci: tuple, buat):
    return k.cache.ambil(("atlas",) + kunci, k.konf.cache_ttl_default, lambda: angka_js(buat()))


def restoran_gci(k: Konteks) -> dict:
    return _cache(k, ("restoran-gci",), lambda: hitungan.data_gabungan(k, "restoran_gci"))


def direktori_restoran(k: Konteks) -> dict:
    return _cache(k, ("direktori",), lambda: hitungan.data_gabungan(k, "direktori_restoran"))


def pertunjukan(k: Konteks, tahun: str | None) -> dict:
    return _cache(
        k, ("pertunjukan", tahun), lambda: logika.pertunjukan(lake.baris_bronze(k, "event_pertunjukan"), tahun)
    )


def golf(k: Konteks) -> dict:
    return _cache(k, ("golf",), lambda: logika.golf(lake.baris_bronze(k, "golf")))


def suvenir(k: Konteks) -> dict:
    return _cache(k, ("suvenir",), lambda: logika.suvenir(lake.baris_bronze(k, "souvenir")))


def hotel(k: Konteks) -> dict:
    return _cache(k, ("hotel",), lambda: logika.hotel(*(lake.baris_bronze(k, t) for t in HOTEL)))
