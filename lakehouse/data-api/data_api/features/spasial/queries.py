"""Penemuan titik berkoordinat di lake, port `app/api/spatial/route.ts` (SQL disalin apa adanya)."""

from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from data_api.shared import queries as sq
from data_api.shared.atlas_gabungan import _uri as uri
from data_api.shared.errors import Upstream
from data_api.shared.konteks import Konteks

from . import logika

IDENTIFIER = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")
PAGE = 2000
PARALEL = 8
LAT = ["lat", "latitude", "lintang"]
LNG = ["lon", "lng", "longitude", "bujur", "long"]
NAMA = ["nama", "name", "nama_usaha", "nama_dagang", "nama_tempat", "nama_hotel", "hotel_name", "venue", "nama_masjid"]
KOTA = ["kota", "city", "wilayah", "kabupaten_kota", "kota_administrasi"]
ALAMAT = ["alamat", "address", "formatted_address"]


def sumber(k: Konteks) -> list[dict[str, str]]:
    """Dataset katalog bertabel sah → `silver.<table_name>`, ditambah mart Hotel POC."""
    hasil = [
        {
            "database": "silver",
            "table": d["table_name"],
            "slug": d["slug"],
            "title": d["title"],
            "href": f"/sdi/{uri(d['slug'])}",
        }
        for d in sq.katalog(k)
        if isinstance(d.get("table_name"), str) and IDENTIFIER.match(d["table_name"])
    ]
    hasil.append(
        {
            "database": "serving",
            "table": "mart_hotel_scraped_booking",
            "slug": "hotel-poc",
            "title": "Hotel POC",
            "href": "/scraped-hotels",
        }
    )
    return hasil


def kolom(k: Konteks, database: str, tabel: str) -> list[str]:
    return [c["name"] for c in k.q(f"DESCRIBE TABLE {database}.`{tabel}`")]


def _pilih(columns: list[str], nama: list[str]) -> str | None:
    for n in nama:
        c = next((c for c in columns if c.lower() == n and IDENTIFIER.match(c)), None)
        if c:
            return c
    return None


def baris_titik(k: Konteks, s: dict[str, str], columns: list[str]) -> list[logika.Titik] | None:
    """Semua titik satu tabel (per halaman 2.000); None bila tabel tak punya kolom lat/lng."""
    lat, lng = _pilih(columns, LAT), _pilih(columns, LNG)
    if not lat or not lng:
        return None

    def field(c: str | None) -> str:
        return f"toString(`{c}`)" if c else "''"

    sql = f"""SELECT DISTINCT name, city, address, lat, lng FROM (
             SELECT {field(_pilih(columns, NAMA))} AS name, {field(_pilih(columns, KOTA))} AS city, {field(_pilih(columns, ALAMAT))} AS address,
             toFloat64OrNull(toString(`{lat}`)) AS lat, toFloat64OrNull(toString(`{lng}`)) AS lng
             FROM {s["database"]}.`{s["table"]}`)
             WHERE isNotNull(lat) AND isNotNull(lng)
             ORDER BY lat, lng, name, city, address LIMIT {{limit:UInt32}} OFFSET {{offset:UInt32}}"""
    titik: list[logika.Titik] = []
    offset = 0
    while True:
        rows = k.q(sql, {"limit": PAGE, "offset": offset})
        titik += logika.titik_lake(s, offset, rows)
        if len(rows) < PAGE:
            return titik
        offset += PAGE


def _satu_sumber(k: Konteks, s: dict[str, str]) -> list[logika.Titik] | None:
    """Titik satu sumber; None = tanpa kolom lat/lng; `Upstream` = gagal (DESCRIBE atau query)."""
    return baris_titik(k, s, kolom(k, s["database"], s["table"]))


def titik_lake(k: Konteks) -> dict[str, Any]:
    """`GET /api/spatial`: titik, inventaris per slug, slug yang gagal, `complete`.

    Tabel yang tidak ada dilewati diam-diam seperti kode galat 60 di route Next.js; keberadaannya dicek
    lewat `SHOW TABLES` agar tidak bergantung pada teks galat. Ratusan tabel dibaca paralel (DESCRIBE
    berurutan saja ±20 detik); hasil digabung dalam urutan sumber, sama dengan loop berurutan Next.js.
    """
    ada = {db: sq.daftar_tabel(k, db) for db in ("silver", "serving")}
    dipakai: list[dict[str, str]] = []
    seen: set[str] = set()
    for s in sumber(k):
        ref = f"{s['database']}.{s['table']}"
        if ref in seen:
            continue
        seen.add(ref)
        if s["table"] in ada[s["database"]]:
            dipakai.append(s)

    def jalankan(s: dict[str, str]) -> list[logika.Titik] | None | Upstream:
        try:
            return _satu_sumber(k, s)
        except Upstream as e:
            return e

    with ThreadPoolExecutor(max_workers=PARALEL) as ex:
        hasil = list(ex.map(jalankan, dipakai))

    points: list[logika.Titik] = []
    failed: list[str] = []
    inventory: list[dict[str, Any]] = []
    for s, titik in zip(dipakai, hasil, strict=True):
        if isinstance(titik, Upstream):
            failed.append(s["slug"])
        elif titik is not None:
            points += titik
            inventory.append({"slug": s["slug"], "coordinates": len(titik)})
    return {"points": points, "inventory": inventory, "failed": failed, "complete": not failed}
