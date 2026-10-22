"""Konfigurasi, autentikasi, halaman, format, cache, dan klien ClickHouse."""

import httpx
import pytest

from data_api.shared.auth import nama_klien
from data_api.shared.cache import Cache
from data_api.shared.ch import ClickHouse
from data_api.shared.errors import Unauthorized, Upstream
from data_api.shared.format import angka_id, angka_json, teks_sel
from data_api.shared.konfigurasi import KonfigurasiError, muat
from data_api.shared.paging import halaman
from tests.conftest import hash_token

TOKENS = f"portal:{hash_token('a')}"


def test_tanpa_token_menolak_start():
    with pytest.raises(KonfigurasiError, match="DATA_API_TOKENS kosong"):
        muat({})


def test_token_bentuk_salah():
    with pytest.raises(KonfigurasiError):
        muat({"DATA_API_TOKENS": "portal:pendek"})


def test_indikator_berkas_ditolak_di_produksi():
    with pytest.raises(KonfigurasiError, match="INDIKATOR_BERKAS"):
        muat({"DATA_API_TOKENS": TOKENS, "DATA_API_ENV": "produksi", "INDIKATOR_BERKAS": "/x.json"})
    assert muat({"DATA_API_TOKENS": TOKENS, "INDIKATOR_BERKAS": "/x.json"}).indikator_berkas == "/x.json"


def test_nama_klien():
    token = {"portal": hash_token("a"), "dagster": hash_token("b")}
    assert nama_klien("Bearer b", token) == "dagster"
    for salah in (None, "", "Basic a", "Bearer c"):
        with pytest.raises(Unauthorized):
            nama_klien(salah, token)


@pytest.mark.parametrize(
    ("page", "size", "hasil"),
    [
        (None, None, (1, 50, 0)),
        ("3", "20", (3, 20, 40)),
        ("0", "500", (1, 200, 0)),
        ("-2", "-5", (1, 1, 0)),
        ("2abc", "x", (2, 50, 50)),
    ],
)
def test_halaman_dijepit(page, size, hasil):
    h = halaman(page, size, 50, 200)
    assert (h.page, h.size, h.offset) == hasil


def test_format():
    assert angka_id(2577) == "2.577" and angka_id(19428) == "19.428" and angka_id(7) == "7"
    assert angka_json("31") == 31 and angka_json("2.5") == 2.5 and angka_json("nan") is None
    assert [teks_sel(v) for v in (None, True, [1, None, "a"], 3.0, 13.16, "x")] == [
        "",
        "true",
        "1,,a",
        "3",
        "13.16",
        "x",
    ]


def test_cache_ttl_dan_kosongkan():
    jam = [0.0]
    c = Cache(lambda: jam[0])
    n = [0]

    def buat():
        n[0] += 1
        return n[0]

    assert c.ambil("k", 10, buat) == 1 and c.ambil("k", 10, buat) == 1
    jam[0] = 11
    assert c.ambil("k", 10, buat) == 2
    assert c.kosongkan() == 1 and c.ambil("k", 10, buat) == 3


def test_ch_parameter_terikat_dan_penanda():
    terima = {}

    def tangani(req: httpx.Request) -> httpx.Response:
        terima["sql"] = req.content.decode()
        terima["params"] = dict(req.url.params)
        return httpx.Response(200, text='{"a":"1"}\n{"a":"2"}\n')

    ch = ClickHouse("http://ch:8123", "u", "p", transport=httpx.MockTransport(tangani))
    rows = ch.query("SELECT a FROM t WHERE b IN {b:Array(String)}", {"b": ["x'y", "z"], "n": 5}, rid="abc-1")
    assert rows == [{"a": "1"}, {"a": "2"}]
    assert terima["sql"].startswith("/* rid=abc-1 */ SELECT a")
    assert terima["sql"].endswith("FORMAT JSONEachRow")
    assert terima["params"] == {"param_b": "['x\\'y','z']", "param_n": "5"}
    # rid yang bisa menutup komentar tidak pernah masuk SQL
    ch.query("SELECT 1", rid="x */ DROP")
    assert terima["sql"].startswith("SELECT 1")


def test_ch_error_jadi_upstream():
    ch = ClickHouse(
        "http://ch:8123",
        "u",
        "p",
        transport=httpx.MockTransport(lambda r: httpx.Response(500, text="Code: 60. tabel\nlagi")),
    )
    with pytest.raises(Upstream) as e:
        ch.query("SELECT 1")
    assert e.value.detail == "Code: 60. tabel"


def test_ch_coba_ulang_sekali_saat_timeout():
    n = [0]

    def tangani(req: httpx.Request) -> httpx.Response:
        n[0] += 1
        if n[0] == 1:
            raise httpx.ReadTimeout("macet", request=req)
        return httpx.Response(200, text='{"a":"1"}\n')

    ch = ClickHouse("http://ch:8123", "u", "p", transport=httpx.MockTransport(tangani))
    assert ch.query("SELECT 1") == [{"a": "1"}] and n[0] == 2

    selalu = ClickHouse(
        "http://ch:8123",
        "u",
        "p",
        transport=httpx.MockTransport(lambda r: (_ for _ in ()).throw(httpx.ConnectError("x"))),
    )
    with pytest.raises(Upstream) as e:
        selalu.query("SELECT 1")
    assert e.value.detail == "ConnectError"


def test_ch_escape_seperti_clickhouse_client():
    terima = {}

    def tangani(req: httpx.Request) -> httpx.Response:
        terima.update(req.url.params)
        return httpx.Response(200, text="")

    ch = ClickHouse("http://ch:8123", "u", "p", transport=httpx.MockTransport(tangani))
    ch.query("SELECT 1", {"q": "C:\\data\tx\n'y'", "f0": ["a\\b", "c\td"]})
    assert terima["param_q"] == "C:\\\\data\\tx\\n\\'y\\'"
    assert terima["param_f0"] == "['a\\\\b','c\\td']"


def test_cache_dibatasi():
    jam = [0.0]
    c = Cache(lambda: jam[0], batas=3)
    for i in range(3):
        c.ambil(i, 10, lambda i=i: i)
    jam[0] = 20  # semua basi → dibuang saat penuh
    c.ambil("baru", 10, lambda: 1)
    assert len(c._isi) == 1
    for i in range(5):
        c.ambil(("x", i), 10, lambda i=i: i)
    assert len(c._isi) <= 3
