"""Hitungan baris yang dipakai lebih dari satu fitur (katalog sekunder, dataset-tematik, beranda).

Sumbernya selalu lake, bukan angka tulisan tangan: `dataset_sync.total` untuk dataset katalog,
`count()` berkas Bronze, atau jumlah item hasil gabung `atlas_gabungan` untuk Restoran GCI dan
Direktori (lake tidak punya tabel yang sudah tergabung).
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from . import atlas_gabungan, lake, queries
from .konteks import Konteks

TOML_SEKUNDER = Path(__file__).with_name("katalog_sekunder.toml")


@dataclass(frozen=True)
class EntriSekunder:
    id: str
    title: str
    description: str
    tags: tuple[str, ...]
    # sdi / internal / instansi / crawling, padanan `SumberData` di lib/secondary.ts
    sumber: str
    href: str
    external: bool
    # `bronze_file:<tabel>` / `gabungan:<nama>`; kosong = dataset_sync.total slug di href
    hitung: str = ""

    @property
    def slug_lake(self) -> str | None:
        return self.href.removeprefix("/sdi/") if self.href.startswith("/sdi/") else None


@cache
def entri_sekunder() -> tuple[EntriSekunder, ...]:
    with TOML_SEKUNDER.open("rb") as f:
        return tuple(EntriSekunder(**{**e, "tags": tuple(e["tags"])}) for e in tomllib.load(f)["entri"])


def total_sync(k: Konteks) -> dict[str, int]:
    """slug → `dataset_sync.total` (primer + sekunder); `Number(x) || 0` seperti Next.js."""

    def buat() -> dict[str, int]:
        hasil: dict[str, int] = {}
        for r in queries.total_sync(k):
            try:
                hasil[r["slug"]] = int(r["total"])
            except (TypeError, ValueError):
                hasil[r["slug"]] = 0
        return hasil

    return k.cache.ambil(("hitungan", "total_sync"), k.konf.cache_ttl_default, buat)


TABEL_GABUNGAN = {
    "restoran_gci": [
        "gci_venue_kurasi",
        "gci_venue_osm",
        "gci_venue_rating",
        "gci_venue_alamat",
        "gci_venue_harga",
        "gci_resto_hotel",
    ],
    "direktori_restoran": ["restoran_kurasi", "restoran_osm"],
}


def data_gabungan(k: Konteks, nama: str) -> dict:
    """Hasil gabung Restoran GCI / Direktori (di-cache); dipakai hitungan, atlas, dan spasial."""
    if nama not in TABEL_GABUNGAN:
        raise ValueError(f"gabungan tidak dikenal: {nama}")
    fungsi = atlas_gabungan.restoran_gci if nama == "restoran_gci" else atlas_gabungan.direktori_restoran

    def buat() -> dict:
        return fungsi(*(lake.baris_bronze(k, t) for t in TABEL_GABUNGAN[nama]))

    return k.cache.ambil(("gabungan", nama), k.konf.cache_ttl_default, buat)


def _gabungan(k: Konteks, nama: str) -> int:
    return len(data_gabungan(k, nama)["items"])


def baris_entri(k: Konteks, e: EntriSekunder) -> int:
    """Jumlah baris satu entri katalog sekunder."""
    if e.slug_lake is not None:
        return total_sync(k).get(e.slug_lake, 0)
    jenis, _, nama = e.hitung.partition(":")
    kunci = ("hitungan", e.hitung)
    if jenis == "bronze_file":
        return k.cache.ambil(kunci, k.konf.cache_ttl_default, lambda: queries.jumlah_bronze_file(k, nama))
    if jenis == "gabungan":
        return k.cache.ambil(kunci, k.konf.cache_ttl_default, lambda: _gabungan(k, nama))
    raise ValueError(f"entri {e.id}: `hitung` tidak dikenal: {e.hitung!r}")


def baris_sekunder(k: Konteks) -> list[tuple[EntriSekunder, int]]:
    return [(e, baris_entri(k, e)) for e in entri_sekunder()]
