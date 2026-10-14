"""Uji fungsi global kf_periode_* di ClickHouse.

Menguji fungsi kf_periode_tahun, kf_periode_bulan, kf_periode_semester,
kf_periode_triwulan, dan kf_periode_hari sesuai kriteria Plan 02:
- Memiliki kasus sah dan kasus NULL
- Mencakup nopember, '7', 7.0, KOSONG, 2062026, tahun 1989
"""

from __future__ import annotations

import pytest

clickhouse_connect = pytest.importorskip("clickhouse_connect")


@pytest.fixture(scope="module")
def ch():
    try:
        from dispar_ingest.konform import _ch
        client = _ch()
        client.query("SELECT kf_periode_tahun(2025)")
        return client
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"ClickHouse / fungsi kf_ tidak tersedia: {e}")


def _val(ch, expr: str):
    return ch.query(f"SELECT {expr}").result_rows[0][0]


# --- kf_periode_tahun ---

@pytest.mark.parametrize("expr,expected", [
    ("kf_periode_tahun(2025)", "2025"),
    ("kf_periode_tahun('2025')", "2025"),
    ("kf_periode_tahun(2025.0)", "2025"),
    ("kf_periode_tahun(' 2025 ')", "2025"),
    ("kf_periode_tahun(toDate('2025-03-14'))", "2025"),
    ("kf_periode_tahun(1990)", "1990"),
    ("kf_periode_tahun(2035)", "2035"),
])
def test_kf_periode_tahun_sah(ch, expr, expected):
    assert _val(ch, expr) == expected


@pytest.mark.parametrize("expr", [
    "kf_periode_tahun(1989)",        # Di bawah batas 1990
    "kf_periode_tahun(2036)",        # Di atas batas 2035
    "kf_periode_tahun(2062026)",     # Data rusak di sumber (7 digit)
    "kf_periode_tahun('2062026')",
    "kf_periode_tahun(202606)",      # 6 digit YYYYMM (bukan tahun murni)
    "kf_periode_tahun('KOSONG')",
    "kf_periode_tahun('abc')",
    "kf_periode_tahun('')",
    "kf_periode_tahun(NULL)",
])
def test_kf_periode_tahun_null(ch, expr):
    assert _val(ch, expr) is None


# --- kf_periode_bulan ---

@pytest.mark.parametrize("expr,expected", [
    ("kf_periode_bulan(2025, 'nopember')", "2025-11"),  # Variasi ejaan nopember
    ("kf_periode_bulan(2025, 'pebruari')", "2025-02"),  # Variasi ejaan pebruari
    ("kf_periode_bulan(2025, '7')", "2025-07"),         # Teks angka '7'
    ("kf_periode_bulan(2025, 7.0)", "2025-07"),         # Float 7.0
    ("kf_periode_bulan(2025, 7)", "2025-07"),           # Int 7
    ("kf_periode_bulan(2025, 'Maret')", "2025-03"),
    ("kf_periode_bulan(2025, 'jan')", "2025-01"),
    ("kf_periode_bulan(2025, 'Desember')", "2025-12"),
    ("kf_periode_bulan(1990, 1)", "1990-01"),
    ("kf_periode_bulan(2035, 12)", "2035-12"),
])
def test_kf_periode_bulan_sah(ch, expr, expected):
    assert _val(ch, expr) == expected


@pytest.mark.parametrize("expr", [
    "kf_periode_bulan(2025, 'KOSONG')",
    "kf_periode_bulan(2025, 0)",
    "kf_periode_bulan(2025, 13)",
    "kf_periode_bulan(2025, -1)",
    "kf_periode_bulan(1989, 'januari')",      # Tahun 1989 tak sah
    "kf_periode_bulan(2036, 'januari')",      # Tahun 2036 tak sah
    "kf_periode_bulan('2062026', 'januari')", # Tahun 2062026 tak sah
    "kf_periode_bulan(2025, 'tidak ada data')",
    "kf_periode_bulan(NULL, 5)",
    "kf_periode_bulan(2025, NULL)",
])
def test_kf_periode_bulan_null(ch, expr):
    assert _val(ch, expr) is None


# --- kf_periode_semester ---

@pytest.mark.parametrize("expr,expected", [
    ("kf_periode_semester(2025, 1)", "2025-S1"),
    ("kf_periode_semester(2025, 2)", "2025-S2"),
    ("kf_periode_semester(2025, 'S1')", "2025-S1"),
    ("kf_periode_semester(2025, 's2')", "2025-S2"),
    ("kf_periode_semester(2025, 'Semester 1')", "2025-S1"),
    ("kf_periode_semester(2025, 2.0)", "2025-S2"),
])
def test_kf_periode_semester_sah(ch, expr, expected):
    assert _val(ch, expr) == expected


@pytest.mark.parametrize("expr", [
    "kf_periode_semester(2025, 0)",
    "kf_periode_semester(2025, 3)",
    "kf_periode_semester(2025, 'KOSONG')",
    "kf_periode_semester(1989, 1)",
    "kf_periode_semester(2036, 1)",
    "kf_periode_semester(2025, NULL)",
])
def test_kf_periode_semester_null(ch, expr):
    assert _val(ch, expr) is None


# --- kf_periode_triwulan ---

@pytest.mark.parametrize("expr,expected", [
    ("kf_periode_triwulan(2025, 1)", "2025-T1"),
    ("kf_periode_triwulan(2025, 'T2')", "2025-T2"),
    ("kf_periode_triwulan(2025, 'Q3')", "2025-T3"),
    ("kf_periode_triwulan(2025, 'Triwulan 4')", "2025-T4"),
    ("kf_periode_triwulan(2025, 3.0)", "2025-T3"),
])
def test_kf_periode_triwulan_sah(ch, expr, expected):
    assert _val(ch, expr) == expected


@pytest.mark.parametrize("expr", [
    "kf_periode_triwulan(2025, 0)",
    "kf_periode_triwulan(2025, 5)",
    "kf_periode_triwulan(2025, 'KOSONG')",
    "kf_periode_triwulan(1989, 1)",
    "kf_periode_triwulan(2036, 1)",
    "kf_periode_triwulan(2025, NULL)",
])
def test_kf_periode_triwulan_null(ch, expr):
    assert _val(ch, expr) is None


# --- kf_periode_hari ---

@pytest.mark.parametrize("expr,expected", [
    ("kf_periode_hari(toDate('2025-03-14'))", "2025-03-14"),
    ("kf_periode_hari('2025-03-14')", "2025-03-14"),
    ("kf_periode_hari('1990-01-01')", "1990-01-01"),
    ("kf_periode_hari('2035-12-31')", "2035-12-31"),
])
def test_kf_periode_hari_sah(ch, expr, expected):
    assert _val(ch, expr) == expected


@pytest.mark.parametrize("expr", [
    "kf_periode_hari('1989-12-31')",
    "kf_periode_hari('2036-01-01')",
    "kf_periode_hari('2025-02-29')",  # Bukan tahun kabisat
    "kf_periode_hari('2025-13-01')",  # Bulan tak sah
    "kf_periode_hari('KOSONG')",
    "kf_periode_hari('abc')",
    "kf_periode_hari('')",
    "kf_periode_hari(NULL)",
])
def test_kf_periode_hari_null(ch, expr):
    assert _val(ch, expr) is None
