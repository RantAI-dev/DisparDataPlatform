"""Uji integrasi fungsi konversi Silver terhadap ClickHouse sungguhan.

Fungsi (angka_id/tanggal_id/bersih_teks) adalah UDF SQL, jadi harus diuji di
ClickHouse. Uji di-skip bila ClickHouse tidak tersedia (mis. CI tanpa stack).
Menjalankan: pastikan stack lakehouse up + fungsi sudah di-apply.

    CH_HOST=localhost CH_PORT=18123 pytest tests/test_functions.py
"""

from __future__ import annotations

import os

import pytest

clickhouse_connect = pytest.importorskip("clickhouse_connect")


@pytest.fixture(scope="module")
def ch():
    try:
        c = clickhouse_connect.get_client(
            host=os.environ.get("CH_HOST", "localhost"),
            port=int(os.environ.get("CH_PORT", "18123")),
            username=os.environ.get("CH_USER", "dispar"),
            password=os.environ.get("CH_PASSWORD", "disparch"),
        )
        # Pastikan fungsi ada.
        c.query("SELECT angka_id('1')")
        return c
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"ClickHouse/fungsi tidak tersedia: {e}")


def _val(ch, expr: str):
    return ch.query(f"SELECT {expr}").result_rows[0][0]


@pytest.mark.parametrize("inp,expected", [
    ("1.234,56", 1234.56),   # ribuan titik + desimal koma
    ("1.234", 1234.0),       # titik = ribuan
    ("1234", 1234.0),
    ("1234,5", 1234.5),      # koma = desimal
    ("-1.234", -1234.0),
    ("1.234.567", 1234567.0),
    ("2026", 2026.0),
    (" 42 ", 42.0),
])
def test_angka_id_benar(ch, inp, expected):
    assert _val(ch, f"angka_id('{inp}')") == pytest.approx(expected)


@pytest.mark.parametrize("inp", ["", "-", "n/a", "abc", "tidak ada data"])
def test_angka_id_kosong_jadi_null(ch, inp):
    assert _val(ch, f"angka_id('{inp}')") is None


@pytest.mark.parametrize("inp,expected", [
    ("-6.033", -6.033),        # 3 desimal: angka_id membacanya -6033
    ("106.733", 106.733),
    ("-5.57613", -5.57613),
    ("-6,2088", -6.2088),      # koma = desimal
    (" 106.8456 ", 106.8456),
])
def test_koordinat_id_titik_desimal(ch, inp, expected):
    assert _val(ch, f"koordinat_id('{inp}')") == pytest.approx(expected)


@pytest.mark.parametrize("inp", ["", "-6.357.216.667", "abc"])
def test_koordinat_id_rusak_jadi_null(ch, inp):
    assert _val(ch, f"koordinat_id('{inp}')") is None


@pytest.mark.parametrize("inp,expected", [
    ("2026-04-19 21:28:12", "2026-04-19"),
    ("2026-07", "2026-07-01"),
    ("31 DESEMBER 2025", "2025-12-31"),
    ("202603", "2026-03-01"),
    ("2026", "2026-01-01"),
    ("19/04/2026", "2026-04-19"),
    ("29 Februari 2024", "2024-02-29"),   # kabisat sah
])
def test_tanggal_id_benar(ch, inp, expected):
    assert str(_val(ch, f"tanggal_id('{inp}')")) == expected


@pytest.mark.parametrize("inp", [
    "2026-13",            # bulan tak sah
    "32 Januari 2026",    # hari tak sah
    "31 Februari 2026",   # 31 Feb (digulung → ditolak validasi pulang-pergi)
    "29 Februari 2025",   # bukan kabisat
    "abc", "",
])
def test_tanggal_id_tak_sah_jadi_null(ch, inp):
    assert _val(ch, f"tanggal_id('{inp}')") is None


def test_bersih_teks_samaran_null(ch):
    assert _val(ch, "bersih_teks('  ')") is None
    assert _val(ch, "bersih_teks('N/A')") is None
    assert _val(ch, "bersih_teks('  Jakarta  ')") == "Jakarta"


def test_kunci_cocok_normalisasi(ch):
    assert _val(ch, "kunci_cocok('Rep. Rakyat Tiongkok')") == "rep rakyat tiongkok"
    assert _val(ch, "kunci_cocok('CHINA')") == "china"
