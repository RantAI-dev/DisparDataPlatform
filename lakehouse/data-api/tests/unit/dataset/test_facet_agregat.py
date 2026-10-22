"""Facet (E §4.2 butir 4) dan agregat (butir 5)."""

from data_api.features.dataset import service


def test_facet(klien):
    items = klien.get("/v1/dataset/wisman/facet").json()["data"]["items"]
    per = {i["key"]: i for i in items}
    assert [i["key"] for i in items] == ["periode_data", "kebangsaan", "jumlah", "catatan"]
    assert per["periode_data"] == {"key": "periode_data", "kind": "tanggal", "min": "2026-01-01", "max": "2026-03-01"}
    assert per["jumlah"]["kind"] == "angka"
    # urut jumlah menurun lalu kolasi id (Ä setara A, sebelum J)
    assert per["kebangsaan"] == {
        "key": "kebangsaan",
        "kind": "kategori",
        "values": [{"v": "JEPANG", "n": 2}, {"v": "Ägypten", "n": 1}, {"v": "MALAYSIA", "n": 1}],
    }


def test_facet_teks_banyak_jadi_none(klien, monkeypatch):
    monkeypatch.setattr(service, "FACET_MAX_VALUES", 2)
    per = {i["key"]: i for i in klien.get("/v1/dataset/wisman/facet").json()["data"]["items"]}
    assert per["kebangsaan"] == {"key": "kebangsaan", "kind": "none"}


def test_facet_slug_tidak_dikenal_kosong(klien):
    r = klien.get("/v1/dataset/tidak-ada/facet")
    assert r.status_code == 200 and r.json()["data"]["items"] == []


def test_agregat_count_tanpa_y_dan_label_kosong(klien):
    r = klien.get("/v1/dataset/wisman/agregat", params={"x": "kebangsaan", "agg": "count"})
    assert r.json()["data"]["items"] == [
        {"name": "JEPANG", "value": 2},
        {"name": "MALAYSIA", "value": 1},
        {"name": "Ägypten", "value": 1},
        {"name": "—", "value": 1},
    ]


def test_agregat_sum_dan_semua_agg(klien, ch):
    r = klien.get("/v1/dataset/wisman/agregat", params={"x": "kebangsaan", "y": "jumlah", "agg": "sum"})
    assert r.json()["data"]["items"][0] == {"name": "JEPANG", "value": 300}
    for agg in ("avg", "max", "min"):
        assert (
            klien.get("/v1/dataset/wisman/agregat", params={"x": "kebangsaan", "y": "jumlah", "agg": agg}).status_code
            == 200
        )
        assert f"{agg}(toFloat64OrNull" in ch.log[-1][0] and "HAVING count(" in ch.log[-1][0]


def test_agregat_tidak_valid(klien):
    for params, pesan in (
        ({"x": "kebangsaan", "agg": "median"}, "Parameter grafik tidak valid"),
        ({"agg": "count"}, "Parameter grafik tidak valid"),
        ({"x": "tidakada", "agg": "count"}, "Kolom grafik tidak dikenal"),
        ({"x": "kebangsaan", "y": "tidakada", "agg": "sum"}, "Kolom grafik tidak dikenal"),
    ):
        r = klien.get("/v1/dataset/wisman/agregat", params=params)
        assert r.status_code == 400 and r.json()["error"]["message"] == pesan
