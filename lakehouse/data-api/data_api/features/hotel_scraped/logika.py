"""`/scraped-hotels` dari `bronze_file.booking_hotel_2026_09_15`, port `app/api/hotels/scraped/route.ts`.

SPEC P5: sumber diganti dari `serving.mart_hotel_scraped_booking` (kini kosong) ke snapshot Bronze, dan
statistik dihitung atas seluruh snapshot (tanpa jendela `scraped_at > now() - INTERVAL 7 DAY`, yang selalu
0 untuk data lama). Tiga query route ditiru di Python atas baris Bronze yang ditipekan ulang mengikuti
skema mart (`scripts/scrapers/booking-jakarta/src/schema.ts`). Histogram harga memindah memo
`priceHistogram` halaman ke server.
"""

from __future__ import annotations

import json
from typing import Any

from data_api.shared.atlas_gabungan import Baris
from data_api.shared.atlas_gabungan import _angka as angka

SOURCE = "booking.com-poc"
NOTE = "Sandbox table from research-grade POC scraper. Exit-strategy → Booking Demand API."
# Kolom bertipe angka di mart (Nullable(Float64/Float32/UIntN), UInt8); sisanya String/Date/DateTime.
_ANGKA = (
    "latitude",
    "longitude",
    "distance_km",
    "star_rating",
    "review_score",
    "review_count",
    "price_idr",
    "rooms_left",
    "total_room_types",
    "is_available",
    "adults",
)
_EMBER = [
    ("<500K", 0, 500_000),
    ("500K-1M", 500_000, 1_000_000),
    ("1M-2M", 1_000_000, 2_000_000),
    ("2M-5M", 2_000_000, 5_000_000),
    ("5M+", 5_000_000, float("inf")),
]


def _tipe(b: Baris) -> dict[str, Any]:
    return {c: (angka(v) if c in _ANGKA else v) for c, v in b.items()}


def _kamar(s: str | None) -> list:
    """`safeParseRooms`."""
    if not s:
        return []
    try:
        hasil = json.loads(s)
    except ValueError:
        return []
    return hasil if isinstance(hasil, list) else []


def _rata(nilai: list[float]) -> float | None:
    return sum(nilai) / len(nilai) if nilai else None


def hotel_scraped(bronze: list[Baris], limit: int) -> dict[str, Any]:
    rows = [_tipe(b) for b in bronze]

    # Snapshot terakhir per (checkin, hotel_id), urut skor ulasan turun lalu harga naik (NULL di akhir).
    terakhir: dict[tuple, str] = {}
    for r in rows:
        k = (r["checkin"], r["hotel_id"])
        if k not in terakhir or r["scraped_at"] > terakhir[k]:
            terakhir[k] = r["scraped_at"]
    pilih = [r for r in rows if r["scraped_at"] == terakhir[(r["checkin"], r["hotel_id"])]]
    pilih.sort(key=lambda r: (r["price_idr"] is None, r["price_idr"] or 0))
    pilih.sort(key=lambda r: (r["review_score"] is None, -(r["review_score"] or 0)))
    hasil = [{**r, "room_types": _kamar(r["room_types_json"])} for r in pilih[:limit]]

    harga = [r["price_idr"] for r in rows if r["price_idr"] is not None]
    rata = _rata(harga)
    per_hotel: dict[str, int] = {}
    for r in rows:  # anyLast(total_room_types): nilai non-NULL terakhir per hotel
        if r["total_room_types"] is not None:
            per_hotel[r["hotel_id"]] = r["total_room_types"]
    kamar = list(per_hotel.values())
    rata_kamar = _rata(kamar)
    stats = {
        "total": len(rows),
        "with_coords": sum(1 for r in rows if r["latitude"] is not None and r["longitude"] is not None),
        "with_address": sum(1 for r in rows if r["address"] != ""),
        "with_rooms_left": sum(1 for r in rows if r["rooms_left"] is not None),
        "with_rooms": sum(1 for r in rows if len((r["room_types_json"] or "").encode()) > 2),
        "avg_price": round(rata) if rata is not None else None,
        "min_price": min(harga) if harga else None,
        "max_price": max(harga) if harga else None,
        "distinct_cities": len({r["city"] for r in rows}),
        "total_room_types": sum(kamar) if kamar else None,
        "avg_room_types_per_hotel": round(rata_kamar, 1) if rata_kamar is not None else None,
    }

    histogram = [{"bucket": nama, "count": 0} for nama, _, _ in _EMBER]
    for r in hasil:
        if r["price_idr"] is None:
            continue
        i = next((i for i, (_, lo, hi) in enumerate(_EMBER) if lo <= r["price_idr"] < hi), None)
        if i is not None:
            histogram[i]["count"] += 1

    return {
        "rows": hasil,
        "stats": stats,
        "price_histogram": histogram,
        "last_checkin": hasil[0]["checkin"] if hasil else None,
        "source": SOURCE,
        "note": NOTE,
    }
