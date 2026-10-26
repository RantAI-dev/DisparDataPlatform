"""Tata bahasa filter (E §4.2 butir 3): port `lib/ch/query-filter.ts`."""

import pytest

from data_api.shared.errors import InvalidFilter
from data_api.shared.filters import build_clauses, is_filtered, kind_of, parse_row_query

SKEMA = {
    "negara": "Nullable(String)",
    "jumlah": "Nullable(Int64)",
    "tgl": "Date",
    "n": "LowCardinality(Nullable(Float64))",
}


@pytest.mark.parametrize(
    ("tipe", "jenis"),
    [
        ("Nullable(Int64)", "angka"),
        ("LowCardinality(Nullable(String))", "teks"),
        ("Decimal(10, 2)", "angka"),
        ("Nullable(Date32)", "tanggal"),
        ("DateTime64(6, 'UTC')", "tanggal"),
        ("FixedString(3)", "teks"),
        ("Array(String)", "lain"),
    ],
)
def test_kind_of(tipe, jenis):
    assert kind_of(tipe) == jenis


def test_cari_dipangkas_dan_dibatasi():
    rq = parse_row_query("  jepang  " + "x" * 600, [], None)
    assert rq.search.startswith("jepang") and len(rq.search) == 500
    k = build_clauses(rq, SKEMA)
    assert "positionCaseInsensitive(toString(tuple(*)), {q:String}) > 0" in k.where
    assert k.params["q"] == rq.search


def test_filter_in_digabung_per_kolom():
    rq = parse_row_query(None, ["negara:in:JEPANG", "negara:in:MALAYSIA", "negara:in:JEPANG"], None)
    k = build_clauses(rq, SKEMA)
    assert k.where == "WHERE toString(`negara`) IN {f0:Array(String)}"
    assert k.params == {"f0": ["JEPANG", "MALAYSIA"]}
    assert is_filtered(rq)


def test_nilai_boleh_mengandung_titik_dua():
    rq = parse_row_query(None, ["negara:in:a:b"], None)
    assert rq.filters[0].values == ["a:b"]


def test_rentang_angka_dan_ujung_terbuka():
    k = build_clauses(parse_row_query(None, ["jumlah:range:10..", "n:range:..1e3"], None), SKEMA)
    assert k.where == "WHERE `jumlah` >= {f0lo:Float64} AND `n` <= {f1hi:Float64}"
    assert k.params == {"f0lo": 10.0, "f1hi": 1000.0}


def test_rentang_tanggal():
    k = build_clauses(parse_row_query(None, ["tgl:range:2024-01-01..2024-12-31"], None), SKEMA)
    assert k.where == "WHERE toDate(`tgl`) >= {f0lo:Date} AND toDate(`tgl`) <= {f0hi:Date}"


@pytest.mark.parametrize(
    ("f", "pesan"),
    [
        (["negara"], "Format filter tidak valid: negara"),
        ([":in:x"], "Format filter tidak valid: :in:x"),
        (["negara:like:x"], "Operator tidak dikenal: like"),
        (["jumlah:range:5"], "Rentang tidak valid: 5"),
        (["jumlah:range:.."], "Rentang kosong untuk kolom jumlah"),
        (["jumlah:range:1..2", "jumlah:range:3..4"], "Filter ganda untuk kolom jumlah"),
        (["jumlah:range:1..2", "jumlah:in:3"], "Filter ganda untuk kolom jumlah"),
        (["negara:in:" + "x" * 501], "Nilai filter terlalu panjang"),
        ([f"negara:in:{i}" for i in range(101)], "Terlalu banyak nilai untuk kolom negara"),
        ([f"k{i}:in:x" for i in range(21)], "Terlalu banyak filter"),
    ],
)
def test_parse_tidak_valid(f, pesan):
    with pytest.raises(InvalidFilter, match=pesan.replace(".", r"\.")):
        parse_row_query(None, f, None)


@pytest.mark.parametrize(
    ("f", "pesan"),
    [
        (["tidakada:in:x"], "Kolom tidak dikenal: tidakada"),
        (["negara:range:a..b"], "Kolom negara tidak mendukung filter rentang"),
        (["jumlah:range:1,5.."], "Angka tidak valid: 1,5"),
        (["tgl:range:2024/01/01.."], "Tanggal tidak valid: 2024/01/01"),
    ],
)
def test_klausa_tidak_valid(f, pesan):
    with pytest.raises(InvalidFilter, match=pesan):
        build_clauses(parse_row_query(None, f, None), SKEMA)


def test_sort_dan_pengurut_cadangan():
    asc = build_clauses(parse_row_query(None, [], "jumlah:asc"), SKEMA)
    assert asc.order_by == "ORDER BY `jumlah` ASC NULLS LAST, cityHash64(toString(tuple(*)))"
    desc = build_clauses(parse_row_query(None, [], "a:b:desc"), {"a:b": "String"})
    assert desc.order_by.startswith("ORDER BY `a:b` DESC")
    assert not is_filtered(parse_row_query(None, [], "jumlah:asc"))


@pytest.mark.parametrize("s", ["jumlah", "jumlah:naik", ":asc"])
def test_sort_tidak_valid(s):
    with pytest.raises(InvalidFilter, match="Sort tidak valid"):
        parse_row_query(None, [], s)


def test_sort_kolom_tidak_dikenal():
    with pytest.raises(InvalidFilter, match="Kolom tidak dikenal: x"):
        build_clauses(parse_row_query(None, [], "x:asc"), SKEMA)


def test_backtick_ditolak():
    with pytest.raises(InvalidFilter):
        build_clauses(parse_row_query(None, ["a`b:in:x"], None), {"a`b": "String"})
