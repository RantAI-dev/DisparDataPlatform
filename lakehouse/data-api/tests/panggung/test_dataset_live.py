"""Uji panggung (read-only ke ClickHouse panggung, akun `dispar_app` sungguhan): Data API vs golden live.

Tidak masuk gate default (`-m panggung`). Jalankan sesaat sesudah membuat ulang golden live
(`scripts/portal_golden.tsx --live`) supaya keduanya membaca data pada menit yang sama. Kredensial
dari env `CH_URL`, `CH_USER`, `CH_PASSWORD` (hanya di shell, tidak pernah di berkas).

Satu penyimpangan yang disengaja: baris tanpa `sort` memakai urutan deterministik (SPEC §3.3),
sedangkan Next.js mengembalikan urutan simpan (E §4.4 "nondeterministic"). Untuk kasus itu yang
dibandingkan: meta, urutan kolom, dan bahwa setiap baris golden ada di dataset. Baris ber-`sort`
dibandingkan persis.
"""

from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from data_api.main import buat_app
from data_api.shared.konfigurasi import muat
from tests.conftest import TOKEN, hash_token

pytestmark = pytest.mark.panggung

LIVE = Path(__file__).resolve().parents[1] / "golden" / "live"


def _golden(nama: str) -> dict:
    return json.loads((LIVE / f"{nama}.json").read_text())


def _daftar(awalan: str) -> list[str]:
    return sorted(p.stem for p in LIVE.glob(f"{awalan}*.json"))


@pytest.fixture(autouse=True)
def gabungan_tetap():
    """Panggung memakai logika gabung sungguhan (menimpa fixture autouse conftest)."""


@pytest.fixture(scope="module")
def klien():
    if not all(os.environ.get(v) for v in ("CH_URL", "CH_USER", "CH_PASSWORD")):
        pytest.skip("CH_URL/CH_USER/CH_PASSWORD tidak di-set")
    if not LIVE.exists():
        pytest.skip("golden live belum dibuat")
    env = {**os.environ, "DATA_API_TOKENS": f"panggung:{hash_token(TOKEN)}"}
    with TestClient(buat_app(muat(env)), headers={"Authorization": f"Bearer {TOKEN}"}) as c:
        yield c


def _get(klien, g: dict):
    path = g["endpoint"].replace("{slug}", g["params"].get("slug", ""))
    params = {k: v for k, v in g["params"].items() if k != "slug"}
    return klien.get(path, params=params)


@pytest.mark.parametrize(
    "nama", ["katalog.semua", "katalog.primer", "katalog.sekunder", "katalog.sumber-crawling", "katalog.tag-halal"]
)
def test_katalog(klien, nama):
    g = _golden(nama)
    r = _get(klien, g)
    assert r.status_code == 200
    assert r.json()["data"] == g["data"]
    assert r.json()["meta"]["total"] == g["meta"]["total"]


def _golden_dataset() -> list[str]:
    return [n for n in _daftar("dataset.") if n.count(".") == 1]


@pytest.mark.parametrize("nama", _golden_dataset())
def test_detail_dan_kolom(klien, nama):
    g = _golden(nama)
    r = _get(klien, g)
    if "status" in g["data"]:
        assert r.status_code == g["data"]["status"]
        assert r.json()["error"]["message"] == g["data"]["error"]
        return
    assert r.status_code == 200, r.text
    assert r.json()["data"] == g["data"]
    assert r.json()["meta"]["total"] == g["meta"]["total"]
    gk = _golden(f"{nama}.kolom")
    assert _get(klien, gk).json()["data"] == gk["data"]


def _semua_baris(klien, slug: str) -> list[dict]:
    hasil, page = [], 1
    while True:
        r = klien.get(f"/v1/dataset/{slug}/baris", params={"page": page, "size": 200}).json()
        hasil += r["data"]["items"]
        if not r["meta"]["has_more"]:
            return hasil
        page += 1


def _kunci(baris: dict) -> str:
    return json.dumps(baris, sort_keys=False, ensure_ascii=False)


@pytest.mark.parametrize("nama", [n for n in _daftar("dataset.") if n.endswith(".baris")])
def test_baris_tanpa_sort(klien, nama):
    g = _golden(nama)
    r = _get(klien, g).json()
    assert r["meta"] | {k: None for k in ("generated_at", "source", "request_id")} == g["meta"] | {
        k: None for k in ("generated_at", "source", "request_id")
    }
    assert len(r["data"]["items"]) == len(g["data"]["items"])
    if g["data"]["items"]:
        assert list(r["data"]["items"][0]) == list(g["data"]["items"][0])  # urutan kolom
    semua = Counter(_kunci(b) for b in _semua_baris(klien, g["params"]["slug"]))
    assert sum(semua.values()) == g["meta"]["total"]
    hilang = [b for b in g["data"]["items"] if semua[_kunci(b)] == 0]
    assert hilang == []


@pytest.mark.parametrize("nama", [n for n in _daftar("dataset.") if n.endswith(".baris-filter")])
def test_baris_dengan_filter_dan_sort(klien, nama):
    g = _golden(nama)
    r = _get(klien, g)
    if "status" in g["data"]:
        assert r.status_code == g["data"]["status"]
        assert r.json()["error"]["message"] == g["data"]["error"]
        return
    assert r.status_code == 200, r.text
    assert r.json()["data"] == g["data"]
    for k, v in g["meta"].items():
        assert r.json()["meta"][k] == v


@pytest.mark.parametrize("nama", [n for n in _daftar("dataset.") if n.endswith(".facet")])
def test_facet(klien, nama):
    g = _golden(nama)
    assert _get(klien, g).json()["data"] == g["data"]


@pytest.mark.parametrize("nama", [n for n in _daftar("dataset.") if n.endswith(".agregat")])
def test_agregat(klien, nama):
    """Nilai seri di Next.js tak berurut tetap; bandingkan isi dan urutan nilai menurun."""
    g = _golden(nama)
    items = _get(klien, g).json()["data"]["items"]
    assert Counter(_kunci(i) for i in items) == Counter(_kunci(i) for i in g["data"]["items"])
    assert [i["value"] for i in items] == [i["value"] for i in g["data"]["items"]]
