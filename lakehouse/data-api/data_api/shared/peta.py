"""Peta dasar kecamatan DKI (`dki-jakarta.geojson`, salinan `platform-v2/public/geo/`) dan uji titik-dalam-poligon.

Aset peta, bukan data: sengaja tidak diekspor ke Bronze (inventaris D §4.12). Dipakai dua fitur: agregat
kepadatan `/v1/spasial` dan `kecamatan_tanpa_poligon` GMTI.
"""

from __future__ import annotations

import json
import re
from functools import cache
from pathlib import Path

GEOJSON = Path(__file__).with_name("dki-jakarta.geojson")

Ring = list[list[float]]


def geo_key(s: str) -> str:
    """`geoKey`: huruf kecil tanpa selain a–z (mencocokkan nama kecamatan SIMAS ↔ GeoJSON)."""
    return re.sub("[^a-z]", "", s.lower())


def _poligon(g: dict) -> list[tuple[tuple[float, float, float, float], list[Ring]]]:
    """`toPolys`: Polygon/MultiPolygon → (bbox ring luar, ring)."""
    daftar = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"] if g["type"] == "MultiPolygon" else []
    hasil = []
    for rings in daftar:
        a = b = float("inf")
        c = d = float("-inf")
        for x, y in rings[0] if rings else []:
            a, b, c, d = min(a, x), min(b, y), max(c, x), max(d, y)
        hasil.append(((a, b, c, d), rings))
    return hasil


@cache
def kecamatan() -> tuple[tuple[str, str, tuple], ...]:
    """(geo_key, nama kota GeoJSON, poligon) per fitur, urutan berkas."""
    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    return tuple(
        (geo_key(f["properties"]["kecamatan"]), f["properties"]["name"], tuple(_poligon(f["geometry"])))
        for f in geo["features"]
    )


def in_ring(x: float, y: float, ring: Ring) -> bool:
    """`inRing`: ray casting, urutan operasi floating point sama dengan JS."""
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < ((xj - xi) * (y - yi)) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_poly(x: float, y: float, poly: tuple) -> bool:
    """`inPoly`: bbox lalu ring luar; lubang (ring ke-2 dst) dikecualikan."""
    (a, b, c, d), rings = poly
    if x < a or x > c or y < b or y > d:
        return False
    if not in_ring(x, y, rings[0]):
        return False
    return not any(in_ring(x, y, r) for r in rings[1:])


def kecamatan_titik(lng: float, lat: float) -> str | None:
    """geo_key kecamatan pertama yang memuat titik (`polys.find(...)`), atau None."""
    for kunci, _, polys in kecamatan():
        if any(in_poly(lng, lat, p) for p in polys):
            return kunci
    return None
