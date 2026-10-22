"""Fitur atlas (plan 05): pertunjukan, golf, suvenir, hotel dari baris Bronze = golden statis plan 01 (gate)."""

from __future__ import annotations

import pytest

from data_api.features.atlas import logika
from data_api.shared.respons import angka_js
from tests.bronze_statis import bronze, golden, tipe


def _sama(nama: str, hasil: dict) -> None:
    harap = golden(nama)["data"]
    hasil = angka_js(hasil)
    assert hasil == harap
    assert tipe(hasil) == tipe(harap)


@pytest.mark.parametrize(
    ("nama", "tahun"),
    [("atlas.pertunjukan", None), ("atlas.pertunjukan.tahun-2025", "2025"), ("atlas.pertunjukan.tahun-2026", "2026")],
)
def test_golden_pertunjukan(nama, tahun):
    hasil = logika.pertunjukan(bronze("event-pertunjukan"), tahun)
    _sama(nama, hasil)
    assert len(hasil["items"]) == golden(nama)["meta"]["total"]


def test_golden_golf_suvenir_hotel():
    _sama("atlas.golf", logika.golf(bronze("golf")))
    _sama("atlas.suvenir", logika.suvenir(bronze("souvenir")))
    _sama("atlas.hotel", logika.hotel(bronze("hotel-registri"), bronze("hotel-tpk"), bronze("hotel-los")))


@pytest.mark.parametrize(
    ("tanggal", "kunci"),
    [
        ("2026-06-11 s/d 2026-07-12", 20260611),
        ("Mei 2025", 20250500),
        ("akhir Desember 2025", 20251200),
        ("Bulan 2025", 20250000),  # bukan nama bulan → tahun saja
        ("TBA", 99999999),
    ],
)
def test_event_date_sort(tanggal, kunci):
    assert logika.event_date_sort(tanggal) == kunci


def test_tahun_dan_verifikasi_pengunjung():
    baris = [
        {
            "id": "a",
            "organizer": "",
            "name": "A",
            "date": "Mei 2026",
            "venue": "",
            "type": "",
            "visitors": "1",
            "note": "Kapasitas venue",
            "category": "Konser Musik",
            "source": None,
        },
        {
            "id": "b",
            "organizer": "",
            "name": "B",
            "date": "2025-01-02",
            "venue": "",
            "type": "",
            "visitors": "",
            "note": "",
            "category": "Seni Rupa",
            "source": "",
        },
    ]
    hasil = logika.pertunjukan(baris, "2026")
    assert [e["id"] for e in hasil["items"]] == ["a"]
    assert hasil["items"][0]["visitors_needs_verify"] is True
    assert hasil["stats"] == {"total": 1, "konser": 1, "festival": 0, "budaya": 0}
    assert [e["id"] for e in logika.pertunjukan(baris, None)["items"]] == ["b", "a"]  # urut kronologis


def test_hotel_los_dibulatkan_seperti_tofixed_dan_periode_bolong_null():
    registri = [
        {
            "nama": "H",
            "jenis_usaha": "HOTEL",
            "golongan": "BINTANG 5",
            "kamar": "10",
            "alamat": "",
            "wilayah": "JAKARTA PUSAT",
            "periode": "202301",
        }
    ]
    tpk = [
        {"periode": "202402", "bintang": "BINTANG 5", "nilai": "50"},
        {"periode": "202401", "bintang": "BINTANG 1", "nilai": "40"},
    ]
    los = [
        {"periode": "202401", "bintang": "BINTANG 4", "tamu": "WISATAWAN MANCANEGARA", "nilai": "1.005"},
        {"periode": "202401", "bintang": "BINTANG 5", "tamu": "WISATAWAN MANCANEGARA", "nilai": "1.005"},
        {"periode": "202402", "bintang": "BINTANG 5", "tamu": "WISATAWAN NUSANTARA", "nilai": "2"},
    ]
    h = logika.hotel(registri, tpk, los)
    assert h["tpk_chart"] == {
        "periods": ["202401", "202402"],
        "series": [{"name": "Bintang 1", "data": [40, None]}, {"name": "Bintang 5", "data": [None, 50]}],
    }
    # (1.005 + 1.005) / 2 = 1.005 (biner 1.00499…) → toFixed(2) "1.00"
    assert h["los_chart"]["series"] == [
        {"name": "Wisman", "data": [1.0, None]},
        {"name": "Wisnus", "data": [None, 2.0]},
    ]
    assert h["kpi"] == {
        "hotels": 1,
        "rooms": 10,
        "occupancy_latest": 50.0,
        "occupancy_period": "202402",
        "los_latest": 2.0,
        "los_period": "202402",
    }
    assert h["registry_period"] == "202301–202301"
