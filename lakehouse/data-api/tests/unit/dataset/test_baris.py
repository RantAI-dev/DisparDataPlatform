"""Baris (E §4.2 butir 3): halaman, cari, filter, urut, kolom audit."""

from data_api.shared.queries import AUDIT


def test_halaman_bawaan(klien, ch):
    r = klien.get("/v1/dataset/wisman/baris").json()
    assert r["meta"] | {"generated_at": None} == {
        "generated_at": None,
        "source": ["silver.<tabel>"],
        "request_id": r["meta"]["request_id"],
        "total": 5,
        "page": 1,
        "size": 50,
        "has_more": False,
    }
    assert len(r["data"]["items"]) == 5
    sql, params = next((s, p) for s, p in ch.log if s.startswith("SELECT * FROM silver"))
    # tanpa sort tetap deterministik (SPEC §3.3)
    assert "ORDER BY cityHash64(toString(tuple(*)))" in sql
    assert params == {"limit": 50, "offset": 0}


def test_kolom_audit_tidak_keluar(klien):
    for r in klien.get("/v1/dataset/wisman/baris").json()["data"]["items"]:
        assert not set(r) & set(AUDIT)


def test_size_dijepit_dan_halaman(klien, ch):
    r = klien.get("/v1/dataset/wisman/baris", params={"size": 999, "page": -1}).json()["meta"]
    assert (r["page"], r["size"]) == (1, 200)
    r = klien.get("/v1/dataset/wisman/baris", params={"size": 2, "page": 2}).json()
    assert len(r["data"]["items"]) == 2 and r["meta"]["has_more"] is True
    assert ch.log[-2][1] == {"limit": 2, "offset": 2}


def test_cari_cocok_dan_tidak(klien):
    assert klien.get("/v1/dataset/wisman/baris", params={"q": "malaysia"}).json()["meta"]["total"] == 1
    assert klien.get("/v1/dataset/wisman/baris", params={"q": "zzz"}).json()["data"]["items"] == []


def test_filter_dan_sort(klien, ch):
    r = klien.get(
        "/v1/dataset/wisman/baris",
        params=[
            ("f", "kebangsaan:in:JEPANG"),
            ("f", "jumlah:range:10.."),
            ("f", "periode_data:range:..2026-02-01"),
            ("sort", "jumlah:desc"),
        ],
    )
    assert r.status_code == 200 and r.json()["meta"]["total"] == 2
    sql, params = next((s, p) for s, p in ch.log if s.startswith("SELECT * FROM silver"))
    assert "toString(`kebangsaan`) IN {f0:Array(String)}" in sql
    assert "`jumlah` >= {f1lo:Float64}" in sql and "toDate(`periode_data`) <= {f2hi:Date}" in sql
    assert "ORDER BY `jumlah` DESC NULLS LAST, cityHash64" in sql
    assert params["f0"] == ["JEPANG"] and params["f1lo"] == 10.0 and params["f2hi"] == "2026-02-01"


def test_filter_tidak_valid_400(klien):
    for params in (
        {"f": "kebangsaan"},
        {"f": "tidakada:in:x"},
        {"f": "kebangsaan:range:a..b"},
        {"sort": "tidakada:asc"},
        {"sort": "jumlah:naik"},
    ):
        r = klien.get("/v1/dataset/wisman/baris", params=params)
        assert r.status_code == 400, params
        assert r.json()["error"]["code"] == "INVALID_FILTER"
    r = klien.get("/v1/dataset/wisman/baris", params=[("f", f"k{i}:in:x") for i in range(21)])
    assert r.json()["error"]["message"] == "Terlalu banyak filter"
    r = klien.get("/v1/dataset/wisman/baris", params=[("f", f"kebangsaan:in:{i}") for i in range(101)])
    assert r.json()["error"]["message"] == "Terlalu banyak nilai untuk kolom kebangsaan"
