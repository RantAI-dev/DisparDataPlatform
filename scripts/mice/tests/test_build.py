"""Tes untuk builder dataset MICE (`scripts/mice/build.py`).

Jalankan dari root:
    uv run --no-project --with pytest python -m pytest scripts/mice/tests -q

Aturan yang dites:
  1. Teks tanggal data izin ('6 - 8 FEBRUARI 2026', '04 & 05 JULI 2026', …)
     terbaca jadi tanggal ISO; yang rusak dikosongkan.
  2. `nama_mirip`: varian judul acara yang sama dianggap mirip, acara lain tidak.
  3. `kota`: kota administrasi DKI dibakukan, wilayah luar DKI tetap utuh.
  4. Dataset hasil build: tidak ada acara ganda (venue sama, nama mirip,
     selisih mulai ≤ 14 hari), venue khusus yang merupakan hotel dan hotel
     anak tidak dihitung dua kali, dan lokasi berganda tidak dipetakan ke venue.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build  # noqa: E402


@pytest.mark.parametrize("teks,hasil", [
    ("20 JANUARI 2026", ("2026-01-20", "2026-01-20")),
    ("6 - 8 FEBRUARI 2026", ("2026-02-06", "2026-02-08")),
    ("30 JANUARI - 1 FEBRUARI 2026", ("2026-01-30", "2026-02-01")),
    ("04 & 05 JULI 2026", ("2026-07-04", "2026-07-05")),
    ("20 DAN 27 FEBRUARI 2026", ("2026-02-20", "2026-02-27")),
    ("15 - 17 MEI 202", ("", "")),
    ("", ("", "")),
])
def test_tanggal_izin(teks, hasil):
    assert build.tanggal_izin(teks) == hasil


@pytest.mark.parametrize("a,b,mirip", [
    ('BRYAN ADAMS "ROLL WITH THE PUNCHES"', "Bryan Adams - Roll with the Punches (special guest Ari Lasso)", True),
    ("Indonesia International Motor Show 2026", "INDONESIA INTERNATIONAL MOTOR SHOW (IIMS)", True),
    ("Wedding Market Fair", "Wedding Market Fair", True),
    ("Indonesia International Motor Show", "Indonesia International Book Fair", False),
    ("Jakarta Fair", "Jakarta Fair Kemayoran 2026", False),  # < 3 token: harus sama persis
])
def test_nama_mirip(a, b, mirip):
    assert build.nama_mirip(a, b) is mirip


@pytest.mark.parametrize("masuk,keluar", [
    ("JAKARTA SELATAN", "Jakarta Selatan"),
    ("Kota Jakarta Selatan", "Jakarta Selatan"),
    ("KOTA ADMINISTRASI JAKARTA BARAT", "Jakarta Barat"),
    ("Kab. Tangerang", "Kab. Tangerang"),
    ("Kota Tangerang Selatan", "Kota Tangerang Selatan"),
    (None, ""),
])
def test_kota(masuk, keluar):
    assert build.kota(masuk) == keluar


@pytest.fixture(scope="module")
def events():
    return build.build_events()


@pytest.fixture(scope="module")
def venues():
    return build.build_venue()


def test_tidak_ada_acara_ganda(events):
    for i, a in enumerate(events):
        for b in events[i + 1:]:
            if a["venue"] != b["venue"] or not build.nama_mirip(a["nama_acara"], b["nama_acara"]):
                continue
            beda = build.selisih_hari(a["tanggal_mulai"], b["tanggal_mulai"])
            assert beda is None or beda > 14, (a["nama_acara"], b["nama_acara"], a["venue"])


def test_acara_berulang_tetap_terpisah(events):
    wmf = [e for e in events if build.norm(e["nama_acara"]) == "wedding market fair"]
    assert len(wmf) >= 2


def test_lokasi_berganda_dilewati(events):
    assert not [e for e in events if "(" in e["lokasi_detail"] and "," in e["lokasi_detail"]
                and e["sumber_data"].startswith("Data izin")]


def test_venue_tidak_dobel(venues):
    ids = {v["id"] for v in venues}
    assert "N052" not in ids and "N051" in ids
    assert not [v for v in venues if v["kategori"] == "Venue khusus" and v["nama_venue"].startswith("The Sultan Hotel")]
    names = [build.norm(v["nama_venue"]) for v in venues]
    assert len(names) == len(set(names))
