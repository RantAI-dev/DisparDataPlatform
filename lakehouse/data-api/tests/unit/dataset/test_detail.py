"""Detail dan kolom (E §4.2 butir 2)."""


def test_detail_sukses(klien):
    r = klien.get("/v1/dataset/wisman")
    assert r.status_code == 200
    d, meta = r.json()["data"], r.json()["meta"]
    assert d == {
        "slug": "wisman",
        "title": "Wisman per Kebangsaan",
        "description": "Deskripsi wisman",
        "sumber_data": ["BPS DKI"],
        "frekuensi": "1 Bulan Sekali",
        "satuan": "Orang",
        "periode": {"min": "2026-01-01", "max": "2026-03-01"},
        "klasifikasi": None,
        "kontak": "a@b.id",
        "author": "Dinas",
        "medallion": {"level": "silver", "table": "t_wisman"},
        "total_bronze": 5,
    }
    assert meta["total"] == 5
    g = klien.get("/v1/dataset/event").json()["data"]
    assert g["medallion"] == {
        "level": "gold",
        "table": "data_event_pariwisata_dan_kebudayaan_dki_jakarta_2011_2019",
        "mart": "mart_event",
    }
    assert g["frekuensi"] is None and g["sumber_data"] == [] and g["periode"] == {"min": "2011", "max": "2019"}


def test_slug_tidak_dikenal_404(klien):
    r = klien.get("/v1/dataset/tidak-ada")
    assert r.status_code == 404
    assert r.json()["error"] == {"code": "NOT_FOUND", "message": "Dataset belum tersedia di lakehouse", "detail": None}
    assert klien.get("/v1/dataset/tidak-ada/kolom").status_code == 404
    assert klien.get("/v1/dataset/tidak-ada/baris").status_code == 404


def test_slug_bentuk_salah_400(klien):
    r = klien.get("/v1/dataset/Huruf_Besar")
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_PARAM"


def test_metadata_ada_silver_tidak(klien):
    d = klien.get("/v1/dataset/mentah").json()
    assert d["meta"]["total"] == 0
    assert d["data"]["medallion"] == {"level": "bronze", "table": "t_mentah"}
    assert d["data"]["periode"] is None and d["data"]["total_bronze"] == 7
    b = klien.get("/v1/dataset/mentah/baris").json()
    assert b["data"]["items"] == [] and b["meta"]["total"] == 0 and b["meta"]["has_more"] is False
    assert klien.get("/v1/dataset/mentah/kolom").json()["data"]["items"] == [{"key": "a", "desc": None, "type": None}]


def test_kolom_tampil_periode_depan_ekstra_belakang(klien):
    items = klien.get("/v1/dataset/wisman/kolom").json()["data"]["items"]
    assert [c["key"] for c in items] == ["periode_data", "kebangsaan", "jumlah", "catatan"]
    assert items[0] == {"key": "periode_data", "desc": None, "type": None}
    assert items[1] == {"key": "kebangsaan", "desc": "komponen", "type": "varchar"}
