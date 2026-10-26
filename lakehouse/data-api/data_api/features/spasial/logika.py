"""Titik peta `/spatial` dari baris Bronze dan titik lake, port Python murni dari platform-v2.

Sumber yang diport: `lib/spatial.ts` (`SPATIAL_POINTS`, `spatialCity`, `spatialCategory`,
`hasSpatialCoordinates`), pemetaan baris di `app/api/spatial/route.ts`, dan memo `GmtiMapView`
(`points` = statis + tambahan terdedup, `cities`, `density`) serta callback fetch ibadah (`ibadahNoCoord`).
"""

from __future__ import annotations

import math
import re
from typing import Any

from data_api.shared import peta
from data_api.shared.atlas_gabungan import _SPASI_JS, Baris
from data_api.shared.atlas_gabungan import _angka as angka
from data_api.shared.atlas_gabungan import _kunci_utf16 as kunci_utf16

Titik = dict[str, Any]

# `DATA_SECTIONS.*.href` (lib/data-sections.ts).
HREF = {
    "gci": "/gci/pariwisata/restoran-gci",
    "restaurants": "/gci/pariwisata/direktori-restoran",
    "pertunjukan": "/gci/pariwisata/pertunjukan-budaya",
    "golf": "/gpci/lapangan-golf",
    "souvenir": "/gpci/toko-suvenir",
}

_KOTA_EN = {
    "central jakarta": "Jakarta Pusat",
    "south jakarta": "Jakarta Selatan",
    "north jakarta": "Jakarta Utara",
    "west jakarta": "Jakarta Barat",
    "east jakarta": "Jakarta Timur",
    "kepulauan seribu": "Kepulauan Seribu",
}


def spatial_city(value: str) -> str:
    """`spatialCity`: nama EN → ID, selain itu Title Case (`\\b\\w` JS = ASCII)."""
    city = value.strip(_SPASI_JS).lower()
    return _KOTA_EN.get(city) or re.sub(r"\b\w", lambda m: m[0].upper(), city, flags=re.ASCII)


def spatial_category(slug: str) -> str:
    """`spatialCategory`: kategori peta dari slug dataset (regex berurutan)."""
    if re.search("masjid|musala|mushalla|ibadah", slug):
        return "ibadah"
    if re.search("halal|muslim|islam", slug):
        if re.search("hotel|menginap", slug):
            return "menginap"
        if re.search("restoran|makan|kuliner|rph", slug):
            return "makan"
        if re.search("program|inovasi|event", slug):
            return "program"
        return "destinasi"
    if re.search("hotel|akomodasi", slug):
        return "hotel"
    if re.search("budaya|seni|museum|pertunjukan", slug):
        return "budaya"
    if re.search("golf", slug):
        return "golf"
    if re.search("suvenir|souvenir|oleh-oleh", slug):
        return "souvenir"
    if re.search("restoran|restaurant|kuliner", slug):
        return "restaurants"
    return "wisata"


def _angka_js(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def punya_koordinat(p: Titik) -> bool:
    """`hasSpatialCoordinates`."""
    lat, lng = p["lat"], p["lng"]
    return (
        _angka_js(lat)
        and _angka_js(lng)
        and math.isfinite(lat)
        and math.isfinite(lng)
        and abs(lat) <= 90
        and abs(lng) <= 180
        and not (lat == 0 and lng == 0)
    )


def string_js(v: float) -> str:
    """`String(number)` untuk koordinat: bilangan bulat tanpa ".0"."""
    return str(int(v)) if isinstance(v, float) and v.is_integer() else repr(v) if isinstance(v, float) else str(v)


def _titik(id: str, name: str, cat: str, city: str, address: str, lat, lng, href: str, **lain) -> Titik:
    return {
        "id": id,
        "name": name,
        "category": cat,
        "city": city,
        "address": address,
        "lat": lat,
        "lng": lng,
        "href": href,
        "kind": lain.get("kind"),
        "cert": lain.get("cert"),
        "source": lain.get("source"),
    }


def _atau(v, ganti):
    """`v ?? ganti`."""
    return ganti if v is None else v


def titik_statis(
    gci: list[dict], restoran: list[dict], golf: list[Baris], suvenir: list[Baris], seni: list[Baris], gmti: list[Baris]
) -> list[Titik]:
    """`SPATIAL_POINTS.filter(hasSpatialCoordinates)`.

    `gci`/`restoran` = item hasil gabung `atlas_gabungan` (bukan baris Bronze); sisanya baris Bronze.
    """
    semua: list[Titik] = []
    for kat, daftar in (("gci", gci), ("restaurants", restoran)):
        for r in daftar:
            alamat = _atau(r["address"], r["area"])
            semua.append(
                _titik(
                    f"{kat}-{r['id']}", r["name"], kat, spatial_city(r["city"]), alamat, r["lat"], r["lng"], HREF[kat]
                )
            )
    for r in golf:
        semua.append(
            _titik(
                f"golf-{r['id']}",
                r["name"],
                "golf",
                spatial_city(r["city"]),
                _atau(r.get("address"), r["area"]),
                angka(r["lat"]),
                angka(r["lng"]),
                HREF["golf"],
            )
        )
    for r in suvenir:
        semua.append(
            _titik(
                f"souvenir-{r['id']}",
                r["name"],
                "souvenir",
                spatial_city(_atau(r.get("city"), "")),
                _atau(r.get("address"), ""),
                angka(r.get("lat")),
                angka(r.get("lng")),
                HREF["souvenir"],
            )
        )
    for i, r in enumerate(seni):
        semua.append(
            _titik(
                f"budaya-{i}",
                r["venue"],
                "budaya",
                spatial_city(r["wilayah"]),
                r["address"],
                angka(r.get("lat")),
                angka(r.get("lon")),
                HREF["pertunjukan"],
            )
        )
    for r in gmti:
        semua.append(
            _titik(
                f"gmti-{r['id']}",
                r["name"],
                r["pillar"],
                spatial_city(_atau(r.get("city"), "")),
                _atau(r.get("address"), ""),
                angka(r.get("lat")),
                angka(r.get("lon")),
                _atau(r.get("href"), "/gmti"),
                kind=r["kind"],
                cert=r.get("cert"),
            )
        )
    return [p for p in semua if punya_koordinat(p)]


def titik_lake(sumber: dict[str, str], offset: int, baris: list[dict]) -> list[Titik]:
    """Baris query `/api/spatial` satu halaman → titik (yang tanpa koordinat sah dibuang)."""
    hasil = []
    for i, r in enumerate(baris):
        p = _titik(
            f"lake-{sumber['slug']}-{offset + i}",
            r["name"] or sumber["title"],
            spatial_category(sumber["slug"]),
            spatial_city(r["city"] or ""),
            r["address"] or "",
            r["lat"],
            r["lng"],
            sumber["href"],
            source=sumber["title"],
        )
        if punya_koordinat(p):
            hasil.append(p)
    return hasil


def titik_ibadah(ibadah: list[Baris]) -> list[Titik]:
    """Callback fetch ibadah GmtiMapView: semua baris SIMAS sebagai kategori `ibadah`."""
    return [
        _titik(
            f"simas-{r['id']}",
            r["name"],
            "ibadah",
            spatial_city(r.get("kota") or ""),
            r.get("address") or "",
            angka(r.get("lat")),
            angka(r.get("lon")),
            "/gmti",
        )
        for r in ibadah
    ]


def ibadah_tanpa_koordinat(ibadah: list[Baris]) -> dict[str, int]:
    """`ibadahNoCoord`: fasilitas ibadah tanpa koordinat per geo_key kecamatan."""
    hasil: dict[str, int] = {}
    for r in ibadah:
        if (r.get("lat") is not None and r.get("lon") is not None) or not r.get("kecamatan"):
            continue
        k = peta.geo_key(r["kecamatan"])
        hasil[k] = hasil.get(k, 0) + 1
    return hasil


def _kunci_dedup(p: Titik) -> str:
    return f"{p['category']}|{p['name'].lower().strip(_SPASI_JS)}|{string_js(p['lat'])}|{string_js(p['lng'])}"


def gabung(statis: list[Titik], tambahan: list[Titik]) -> list[Titik]:
    """Memo `points`: statis menang; tambahan berkoordinat masuk bila kuncinya belum ada."""
    seen = {_kunci_dedup(p) for p in statis}
    hasil = list(statis)
    for p in tambahan:
        if not punya_koordinat(p):
            continue
        k = _kunci_dedup(p)
        if k in seen:
            continue
        seen.add(k)
        hasil.append(p)
    return hasil


def kota(points: list[Titik]) -> list[str]:
    """Memo `cities`: kota unik (tidak kosong), sort bawaan JS."""
    return sorted({p["city"] for p in points if p["city"]}, key=kunci_utf16)


def kepadatan(points: list[Titik]) -> dict[str, dict]:
    """Memo `density` dengan semua kategori aktif, tanpa ibadah tanpa koordinat (dikirim terpisah)."""
    m: dict[str, dict] = {}
    for p in points:
        k = peta.kecamatan_titik(p["lng"], p["lat"])
        if k is None:
            continue
        c = m.setdefault(k, {"total": 0, "byCat": {}})
        c["total"] += 1
        c["byCat"][p["category"]] = c["byCat"].get(p["category"], 0) + 1
    return m
