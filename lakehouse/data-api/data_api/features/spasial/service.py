"""Data `/spatial` (KONTRAK §2.5): titik statis + lake + ibadah, didedup dan dihitung per kecamatan di server."""

from __future__ import annotations

from typing import Any

from data_api.shared import hitungan, lake
from data_api.shared.konteks import Konteks
from data_api.shared.respons import angka_js

from . import logika, queries

CATATAN = (
    "kepadatan_berkoordinat = titik berkoordinat per kecamatan (point-in-polygon) per kategori; "
    "kepadatan_tanpa_koordinat = fasilitas ibadah SIMAS tanpa koordinat per geo_key kecamatan, "
    "ditambahkan klien ke kategori ibadah saat kategori itu aktif. Detail titik: /v1/spasial/titik/{id}."
)


def _gabungan(k: Konteks) -> dict[str, Any]:
    def buat() -> dict[str, Any]:
        statis = logika.titik_statis(
            hitungan.data_gabungan(k, "restoran_gci")["items"],
            hitungan.data_gabungan(k, "direktori_restoran")["items"],
            lake.baris_bronze(k, "golf"),
            lake.baris_bronze(k, "souvenir"),
            lake.baris_bronze(k, "seni_venue"),
            lake.baris_bronze(k, "gmti_tempat"),
        )
        dari_lake = queries.titik_lake(k)
        ibadah = lake.baris_bronze(k, "gmti_ibadah")
        # Urutan tambahan = hasil `/api/spatial` lalu ibadah (urutan golden; di klien bergantung
        # mana fetch yang selesai dulu).
        points = logika.gabung(statis, [*dari_lake["points"], *logika.titik_ibadah(ibadah)])
        return angka_js(
            {
                "points": points,
                "per_id": {p["id"]: p for p in points},
                "cities": logika.kota(points),
                "kepadatan_berkoordinat": logika.kepadatan(points),
                "kepadatan_tanpa_koordinat": logika.ibadah_tanpa_koordinat(ibadah),
                "inventory": dari_lake["inventory"],
                "failed": dari_lake["failed"],
                "complete": dari_lake["complete"],
            }
        )

    return k.cache.ambil(("spasial",), k.konf.cache_ttl_default, buat)


def spasial(k: Konteks) -> tuple[dict[str, Any], dict[str, int]]:
    g = _gabungan(k)
    # Alamat ikut di titik ringkas: pencarian peta /spatial mencocokkan nama + alamat + wilayah
    # seperti GmtiMapView v2. Sertifikat tetap hanya di detail /v1/spasial/titik/{id}.
    ringkas = ("id", "name", "category", "city", "address", "lat", "lng", "href", "kind", "source")
    per_kategori: dict[str, int] = {}
    for p in g["points"]:
        per_kategori[p["category"]] = per_kategori.get(p["category"], 0) + 1
    data = {
        "points": [{c: p[c] for c in ringkas} for p in g["points"]],
        **{c: g[c] for c in ("cities", "kepadatan_berkoordinat", "kepadatan_tanpa_koordinat", "inventory")},
        **{c: g[c] for c in ("failed", "complete")},
        "catatan": CATATAN,
    }
    return data, per_kategori


def titik(k: Konteks, id: str) -> dict[str, Any] | None:
    return _gabungan(k)["per_id"].get(id)
