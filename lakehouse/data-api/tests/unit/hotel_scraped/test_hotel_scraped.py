"""Fitur hotel-scraped (plan 05, SPEC P5): statistik tanpa jendela 7 hari atas snapshot Bronze.

Angka harapan = inventaris D §4.11 (dihitung dari `data/crawl/booking-hotel-2026-09-15.json` dengan logika SQL
route); uji panggung membandingkannya lagi dengan SQL route yang dijalankan ClickHouse atas Bronze.
"""

from __future__ import annotations

from data_api.features.hotel_scraped import logika
from tests.bronze_statis import bronze

BRONZE = bronze("booking-hotel-2026-09-15", "crawl")


def test_statistik_dan_histogram_snapshot_bronze():
    h = logika.hotel_scraped(BRONZE, 100)
    s = h["stats"]
    assert (s["total"], s["with_coords"], s["with_address"], s["with_rooms_left"], s["with_rooms"]) == (
        72,
        54,
        50,
        0,
        36,
    )
    assert (s["avg_price"], s["min_price"], s["max_price"], s["distinct_cities"]) == (1229127, 209274, 4053500, 1)
    assert len(h["rows"]) == 34  # snapshot terakhir per (checkin, hotel)
    assert [e["count"] for e in h["price_histogram"]] == [10, 12, 7, 5, 0]
    assert h["last_checkin"] == "2026-09-29"


def test_urutan_skor_turun_harga_naik_null_di_akhir_dan_tipe_mart():
    rows = logika.hotel_scraped(BRONZE, 500)["rows"]
    skor = [r["review_score"] for r in rows]
    ada = [x for x in skor if x is not None]
    assert ada == sorted(ada, reverse=True) and skor[len(ada) :] == [None] * (len(skor) - len(ada))
    r = next(r for r in rows if r["latitude"] is not None)
    assert isinstance(r["latitude"], float) and isinstance(r["price_idr"], int) and isinstance(r["adults"], int)
    assert isinstance(r["room_types"], list)


def test_limit_dan_room_types_rusak():
    assert len(logika.hotel_scraped(BRONZE, 5)["rows"]) == 5
    baris = [{**BRONZE[0], "room_types_json": "{bukan json"}]
    assert logika.hotel_scraped(baris, 10)["rows"][0]["room_types"] == []
