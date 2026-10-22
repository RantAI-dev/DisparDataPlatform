"""SQL fitur indikator. Baris dataset Silver dibaca lewat `shared/lake.py` (`store.rowsForRaw`); di sini
hanya berkas Bronze yang dulu dibundel di app: `gci_gpci_benchmark`, `gci_kearney_resmi`,
`target_wisman`, `seni_venue`, `artis_tampil_jakarta`."""

from __future__ import annotations

from data_api.shared import queries as sq
from data_api.shared.konteks import Konteks

Baris = list[dict]


def bronze(k: Konteks, tabel: str) -> Baris:
    return k.cache.ambil(("indikator", tabel), k.konf.cache_ttl_default, lambda: sq.baris_bronze_file(k, tabel))
