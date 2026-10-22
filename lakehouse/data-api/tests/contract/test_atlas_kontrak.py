"""Setiap endpoint atlas, GMTI, spasial, dan hotel-scraped (plan 05) divalidasi terhadap `openapi.yaml`.

Bronze palsu = berkas `data/statis` (dan snapshot crawl Booking) dalam bentuk ingest; titik lake `/v1/spasial`
palsu (satu titik), karena penemuan Silver diuji sendiri di `tests/unit/spasial`.
"""

import pytest

from tests.bronze_statis import bronze
from tests.kontrak import SPEC, validasi

KASUS = [
    ("/v1/atlas/restoran-gci", "/v1/atlas/restoran-gci", {}),
    ("/v1/atlas/direktori-restoran", "/v1/atlas/direktori-restoran", {}),
    ("/v1/atlas/pertunjukan", "/v1/atlas/pertunjukan", {}),
    ("/v1/atlas/pertunjukan", "/v1/atlas/pertunjukan", {"tahun": "2026"}),
    ("/v1/atlas/golf", "/v1/atlas/golf", {}),
    ("/v1/atlas/suvenir", "/v1/atlas/suvenir", {}),
    ("/v1/atlas/hotel", "/v1/atlas/hotel", {}),
    ("/v1/gmti/ringkasan", "/v1/gmti/ringkasan", {}),
    ("/v1/gmti/tempat", "/v1/gmti/tempat", {}),
    ("/v1/gmti/tempat", "/v1/gmti/tempat", {"pilar": "makan", "q": "sushi", "page": "2", "size": "10"}),
    ("/v1/spasial", "/v1/spasial", {}),
    ("/v1/spasial/titik/{id}", "/v1/spasial/titik/gci-osm-w-370539428", {}),
    ("/v1/spasial/titik/{id}", "/v1/spasial/titik/lake-uji-0", {}),
    ("/v1/hotel-scraped", "/v1/hotel-scraped", {}),
    ("/v1/hotel-scraped", "/v1/hotel-scraped", {"limit": "5"}),
]
PATH_PLAN05 = {
    p for p in SPEC["paths"] if p.startswith(("/v1/atlas/", "/v1/gmti/", "/v1/spasial", "/v1/hotel-scraped"))
}
LAKE = {
    "points": [
        {
            "id": "lake-uji-0",
            "name": "Titik uji",
            "category": "wisata",
            "city": "Jakarta Pusat",
            "address": "",
            "lat": -6.18,
            "lng": 106.82,
            "href": "/sdi/uji",
            "kind": None,
            "cert": None,
            "source": "Uji",
        }
    ],
    "inventory": [{"slug": "uji", "coordinates": 1}],
    "failed": [],
    "complete": True,
}


@pytest.fixture
def bronze_palsu(monkeypatch):
    from data_api.features.spasial import queries
    from data_api.shared import lake

    def baca(k, tabel):
        if tabel == "booking_hotel_2026_09_15":
            return bronze("booking-hotel-2026-09-15", "crawl")
        return bronze(tabel.replace("_", "-"))

    monkeypatch.setattr(lake, "baris_bronze", baca)
    monkeypatch.setattr(queries, "titik_lake", lambda k: LAKE)


@pytest.mark.parametrize(("path", "url", "params"), KASUS)
def test_respons_sesuai_kontrak(klien, bronze_palsu, path, url, params):
    r = klien.get(url, params=params)
    assert r.status_code == 200, r.text
    validasi(path, "get", 200, r.json())
    assert sorted(r.json()["meta"]["source"]) == sorted(SPEC["paths"][path]["get"]["x-sumber"])


def test_halaman_gmti_dan_has_more(klien, bronze_palsu):
    m = klien.get("/v1/gmti/tempat", params={"pilar": "ibadah", "page": "42", "size": "200"}).json()["meta"]
    assert (m["total"], m["page"], m["size"], m["has_more"]) == (8331, 42, 200, False)
    assert klien.get("/v1/gmti/tempat", params={"page": "41"}).json()["meta"]["has_more"] is True


@pytest.mark.parametrize(
    ("url", "params", "status", "path"),
    [
        ("/v1/spasial/titik/tidak-ada", {}, 404, "/v1/spasial/titik/{id}"),
        ("/v1/atlas/pertunjukan", {"tahun": "25"}, 400, "/v1/atlas/pertunjukan"),
        ("/v1/gmti/tempat", {"size": "201"}, 400, "/v1/gmti/tempat"),
        ("/v1/gmti/tempat", {"pilar": "lain"}, 400, "/v1/gmti/tempat"),
        ("/v1/hotel-scraped", {"limit": "501"}, 400, "/v1/hotel-scraped"),
    ],
)
def test_galat_sesuai_kontrak(klien, bronze_palsu, url, params, status, path):
    r = klien.get(url, params=params)
    assert r.status_code == status, r.text
    validasi(path, "get", status, r.json())


def test_semua_endpoint_plan05_diuji():
    assert {p for p, _, _ in KASUS} == PATH_PLAN05
