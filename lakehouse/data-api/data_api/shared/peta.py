"""Peta dasar kecamatan DKI (`dki-jakarta.geojson`, salinan `platform-v2/public/geo/`) dan uji titik-dalam-poligon.

Aset peta, bukan data: sengaja tidak diekspor ke Bronze (inventaris D §4.12). Dipakai dua fitur: agregat
kepadatan `/v1/spasial` dan `kecamatan_tanpa_poligon` GMTI.
"""

from __future__ import annotations

import json
import math
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


# Toleransi jarak ke poligon daratan: GeoJSON belum memuat lahan reklamasi (PIK, Ancol) dan punya celah
# tipis di batas kota. Bandara Soekarno-Hatta (±3 km dari batas) sudah di luar toleransi ini.
TOLERANSI_KM = 2.5
# Gugusan Kepulauan Seribu (lat_min, lat_max, lng_min, lng_max); GeoJSON hanya memuat daratan Jakarta.
SERIBU = (-6.07, -5.1, 106.3, 106.85)


def _jarak_ke_ring_km(x: float, y: float, ring: Ring) -> float:
    """`jarakKeRingKm`: jarak ke tepi ring terdekat, proyeksi ekuirektangular."""
    k = math.cos(y * math.pi / 180)
    px = x * k
    terkecil = math.inf
    for i in range(len(ring) - 1):
        ax, ay, bx, by = ring[i][0] * k, ring[i][1], ring[i + 1][0] * k, ring[i + 1][1]
        dx, dy = bx - ax, by - ay
        t = 0 if dx == 0 and dy == 0 else max(0, min(1, ((px - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
        terkecil = min(terkecil, math.hypot(px - (ax + t * dx), y - (ay + t * dy)))
    return terkecil * 111.32


def kota_dki(lng: float, lat: float) -> str | None:
    """`wilayahDki`: kota administrasi DKI tempat titik berada, atau None bila di luar DKI."""
    for _, nama, polys in kecamatan():
        if any(in_poly(lng, lat, p) for p in polys):
            return nama
    if SERIBU[0] < lat < SERIBU[1] and SERIBU[2] < lng < SERIBU[3]:
        return "Kepulauan Seribu"
    terdekat: tuple[float, str] | None = None
    for _, nama, polys in kecamatan():
        for _, rings in polys:
            km = _jarak_ke_ring_km(lng, lat, rings[0])
            if terdekat is None or km < terdekat[0]:
                terdekat = (km, nama)
    return terdekat[1] if terdekat and terdekat[0] <= TOLERANSI_KM else None


def kecamatan_titik(lng: float, lat: float) -> str | None:
    """geo_key kecamatan pertama yang memuat titik (`polys.find(...)`), atau None."""
    for kunci, _, polys in kecamatan():
        if any(in_poly(lng, lat, p) for p in polys):
            return kunci
    return None
