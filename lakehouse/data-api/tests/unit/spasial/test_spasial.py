"""Fitur spasial (plan 05): titik statis = golden statis plan 01 (gate), plus aturan port `/api/spatial`
dan `GmtiMapView` (kota, kategori, dedup, point-in-polygon, tebakan kolom, penemuan titik lake)."""

from __future__ import annotations

import pytest

from data_api.features.spasial import logika, queries
from data_api.shared import atlas_gabungan as ag
from data_api.shared import peta
from data_api.shared.errors import Upstream
from data_api.shared.respons import angka_js
from tests.bronze_statis import bronze, golden, tipe


def _statis() -> list[dict]:
    gci = ag.restoran_gci(
        *(
            bronze(n)
            for n in (
                "gci-venue-kurasi",
                "gci-venue-osm",
                "gci-venue-rating",
                "gci-venue-alamat",
                "gci-venue-harga",
                "gci-resto-hotel",
            )
        )
    )
    restoran = ag.direktori_restoran(bronze("restoran-kurasi"), bronze("restoran-osm"))
    return logika.titik_statis(
        gci["items"], restoran["items"], bronze("golf"), bronze("souvenir"), bronze("seni-venue"), bronze("gmti-tempat")
    )


def test_golden_titik_statis_lengkap_dengan_alamat():
    harap = golden("spasial.statis")["data"]["points_statis"]
    hasil = angka_js(_statis())
    assert len(hasil) == 4217
    assert hasil == harap
    assert tipe(hasil) == tipe(harap)


@pytest.mark.parametrize(
    ("masuk", "keluar"),
    [
        ("South Jakarta", "Jakarta Selatan"),
        ("  KEPULAUAN SERIBU ", "Kepulauan Seribu"),
        ("Kota Adm. Jakarta Barat", "Kota Adm. Jakarta Barat"),
        ("nusa dua, badung, bali", "Nusa Dua, Badung, Bali"),
        ("kebon jeruk-utara", "Kebon Jeruk-Utara"),
        ("", ""),
    ],
)
def test_spatial_city(masuk, keluar):
    assert logika.spatial_city(masuk) == keluar


@pytest.mark.parametrize(
    ("slug", "kategori"),
    [
        ("masjid-bersejarah", "ibadah"),
        ("hotel-ramah-muslim", "menginap"),
        ("restoran-halal-jakarta", "makan"),
        ("inovasi-wisata-ramah-muslim-jakarta", "program"),
        ("mall-fasilitas-halal", "destinasi"),
        ("hotel-transit", "hotel"),
        ("museum-jakarta", "budaya"),
        ("toko-suvenir-tripadvisor-2026", "souvenir"),
        ("restoran-tripadvisor-jakarta", "restaurants"),
        ("hutan-kota", "wisata"),
    ],
)
def test_spatial_category(slug, kategori):
    assert logika.spatial_category(slug) == kategori


def _p(**isi) -> dict:
    dasar = {
        "id": "x",
        "name": "A",
        "category": "wisata",
        "city": "",
        "address": "",
        "lat": -6.2,
        "lng": 106.8,
        "href": "/",
        "kind": None,
        "cert": None,
        "source": None,
    }
    return dasar | isi


def test_koordinat_sah():
    assert logika.punya_koordinat(_p())
    assert not logika.punya_koordinat(_p(lat=None))
    assert not logika.punya_koordinat(_p(lat=0, lng=0))
    assert not logika.punya_koordinat(_p(lat=91.0))
    assert not logika.punya_koordinat(_p(lng=float("nan")))


def test_dedup_statis_menang_dan_kunci_seperti_js():
    statis = [_p(id="s", name="Masjid A ", category="ibadah", lat=-6.0, lng=106.5)]
    tambahan = [
        _p(id="l1", name="masjid a", category="ibadah", lat=-6, lng=106.5),  # String(-6.0) = "-6"
        _p(id="l2", name="Masjid A", category="makan", lat=-6.0, lng=106.5),  # kategori lain
        _p(id="l3", name="B", lat=None),  # tanpa koordinat
        _p(id="l4", name="B"),
        _p(id="l5", name="b"),  # dobel antar-tambahan
    ]
    assert [p["id"] for p in logika.gabung(statis, tambahan)] == ["s", "l2", "l4"]


def test_titik_dalam_poligon_tepi_dan_lubang():
    persegi = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    lubang = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]
    poly = ((0, 0, 10, 10), [persegi, lubang])
    # Ray casting JS: tepi bawah/kiri masuk, tepi atas/kanan tidak; lubang dikecualikan; luar bbox cepat ditolak.
    assert peta.in_poly(5, 0, poly) and peta.in_poly(0, 5, poly)
    assert not peta.in_poly(5, 10, poly) and not peta.in_poly(10, 5, poly)
    assert not peta.in_poly(5, 5, poly) and peta.in_poly(2, 2, poly)
    assert not peta.in_poly(11, 5, poly)


def test_kecamatan_titik_dan_ibadah_tanpa_koordinat():
    assert peta.kecamatan_titik(106.8272, -6.1754) == "gambir"  # Monas
    assert peta.kecamatan_titik(115.2, -8.7) is None  # Bali: titik tetap ikut, tanpa kecamatan
    tanpa = logika.ibadah_tanpa_koordinat(bronze("gmti-ibadah"))
    assert sum(tanpa.values()) == 8331 - 770 and tanpa["tanjungpriok"] == 507


def test_tebakan_kolom_lat_lon_berurutan_dan_huruf_kecil():
    kolom = ["Nama_Usaha", "Longitude", "lat", "Latitude", "kota", "bad-name", "Alamat"]
    assert queries._pilih(kolom, queries.LAT) == "lat"
    assert queries._pilih(kolom, queries.LNG) == "Longitude"
    assert queries._pilih(kolom, queries.NAMA) == "Nama_Usaha"
    assert queries._pilih(["bad-name"], ["bad-name"]) is None  # bukan identifier sah
    assert queries._pilih(kolom, queries.KOTA) == "kota"


class _K:
    """Konteks palsu: katalog, SHOW TABLES, DESCRIBE, dan query titik."""

    def __init__(self):
        self.katalog = [
            {"slug": "museum-jakarta", "title": "Museum", "table_name": "museum"},
            {"slug": "museum-salin", "title": "Museum 2", "table_name": "museum"},  # tabel dobel → dilewati
            {"slug": "tanpa-lat", "title": "T", "table_name": "tanpa_lat"},
            {"slug": "rusak", "title": "R", "table_name": "rusak"},
            {"slug": "hilang", "title": "H", "table_name": "hilang"},  # tidak ada di silver
            {"slug": "aneh", "title": "A", "table_name": "x-y"},  # nama tidak sah
        ]
        self.log: list[str] = []

    def q(self, sql: str, params=None):
        self.log.append(sql)
        if "UNION ALL" in sql:
            return self.katalog
        if sql.startswith("SHOW TABLES FROM silver"):
            return [{"name": n} for n in ("museum", "tanpa_lat", "rusak")]
        if sql.startswith("SHOW TABLES FROM serving"):
            return [{"name": "mart_hotel_scraped_booking"}]
        if sql.startswith("DESCRIBE TABLE silver.`rusak`"):
            raise Upstream("Lakehouse tidak dapat dibaca", "palsu")
        if sql.startswith("DESCRIBE TABLE silver.`tanpa_lat`"):
            return [{"name": "nama"}]
        if sql.startswith("DESCRIBE"):
            return [{"name": c} for c in ("nama", "lat", "lon", "alamat", "latitude", "longitude", "hotel_name")]
        if "silver.`museum`" in sql:
            n = 2000 if params["offset"] == 0 else 1
            return [
                {"name": "" if i == 0 else f"M{i}", "city": "", "address": "", "lat": -6.2, "lng": 106.8 + i * 1e-6}
                for i in range(n)
            ]
        return []


def test_penemuan_titik_lake_berhalaman_dan_urut_sumber():
    k = _K()
    hasil = queries.titik_lake(k)
    assert hasil["inventory"] == [
        {"slug": "museum-jakarta", "coordinates": 2001},
        {"slug": "hotel-poc", "coordinates": 0},
    ]
    assert hasil["failed"] == ["rusak"] and hasil["complete"] is False
    p = hasil["points"]
    assert p[0]["name"] == "Museum" and p[0]["href"] == "/sdi/museum-jakarta" and p[0]["category"] == "budaya"
    assert p[-1]["id"] == "lake-museum-jakarta-2000" and p[-1]["source"] == "Museum"
    assert not any("hilang" in s or "x-y" in s for s in k.log)
