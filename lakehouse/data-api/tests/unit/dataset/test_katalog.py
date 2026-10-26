"""Katalog (E §4.2 butir 1): gabungan primer lake + 45 entri sekunder, medallion, urutan."""


def test_katalog_semua(klien):
    r = klien.get("/v1/katalog")
    assert r.status_code == 200
    d, meta = r.json()["data"], r.json()["meta"]
    items = d["items"]
    assert meta["total"] == len(items) == 3 + 45
    # primer diurut updated_at menurun, yang kosong paling akhir
    assert [i["id"] for i in items[:3]] == ["sdi-wisman", "sdi-event", "sdi-mentah"]
    w = items[0]
    assert w == {
        "id": "sdi-wisman",
        "title": "Wisman per Kebangsaan",
        "description": "Deskripsi wisman",
        "tags": ["Wisman", "kebangsaan"],
        "tier": "primer",
        "source": "SDI · Satu Data Jakarta",
        "size_label": "1.598 dilihat",
        "href": "/sdi/wisman",
        "external": False,
        "medallion": {"level": "silver"},
    }
    assert items[1]["medallion"] == {"level": "gold", "mart": "mart_event"}
    assert items[2]["medallion"] == {"level": "bronze"}
    assert items[2]["size_label"] == "0 dilihat" and items[2]["tags"] == []


def test_entri_sekunder_teks_app_baris_lake(klien):
    items = klien.get("/v1/katalog", params={"tier": "sekunder"}).json()["data"]["items"]
    assert len(items) == 45 and all(i["tier"] == "sekunder" for i in items)
    neg = items[0]
    # teks dari katalog_sekunder.toml (salinan lib/secondary.ts), bukan teks lake
    assert neg["title"] == "Wisman DKI Jakarta per Negara (BPS dibersihkan)"
    assert neg["size_label"] == "604 baris"  # dataset_sync.total
    assert neg["medallion"] == {"level": "silver"}
    per_id = {i["id"]: i for i in items}
    assert per_id["sec-gmti-ibadah"]["size_label"] == "8.331 baris"
    assert per_id["sec-gci-resto"]["size_label"] == "2.577 baris"
    assert per_id["sec-resto-dir"]["size_label"] == "604 baris"
    assert per_id["sec-hotel-statistik"]["size_label"] == "120 baris"
    assert per_id["sec-gci-resto"]["medallion"] == {"level": "bronze"}  # ATLAS_TABLES, tidak di Silver palsu
    assert per_id["sec-golf"]["medallion"] is None
    assert {i["source"] for i in items} == {"Dinas Pariwisata & Ekraf DKI Jakarta"}


def test_stats_dan_layer(klien):
    semua = klien.get("/v1/katalog").json()["data"]
    primer = klien.get("/v1/katalog", params={"tier": "primer"}).json()["data"]
    assert (
        semua["stats"]
        == primer["stats"]
        == {
            "total": 3,
            "tags": 3,  # Wisman/wisman dihitung sekali
            "views": 1608,
            "last_updated": "2026-10-21T03:19:38.000000Z",
        }
    )
    assert primer["layer_counts"] == {"bronze": 1, "silver": 1, "gold": 1}
    assert len(primer["items"]) == 3
    # tier=semua dan sekunder menghitung layer atas seluruh katalog (seperti CatalogView)
    assert semua["layer_counts"] == {"bronze": 3, "silver": 2, "gold": 1}


def test_halaman_dan_tier_salah(klien):
    r = klien.get("/v1/katalog", params={"page": 2, "size": 10}).json()
    assert [i["id"] for i in r["data"]["items"]][0] == "sec-tk-ekraf-provinsi" or len(r["data"]["items"]) == 10
    assert r["meta"]["total"] == 48
    e = klien.get("/v1/katalog", params={"tier": "lain"})
    assert e.status_code == 400 and e.json()["error"]["code"] == "INVALID_PARAM"


def test_urutan_stabil(klien):
    a = [i["id"] for i in klien.get("/v1/katalog").json()["data"]["items"]]
    klien.app.state.cache.kosongkan()
    assert a == [i["id"] for i in klien.get("/v1/katalog").json()["data"]["items"]]


def test_lakehouse_mati_503(klien, ch):
    ch.gagal = True
    r = klien.get("/v1/katalog")
    assert r.status_code == 503
    assert r.json() == {
        "error": {"code": "UPSTREAM_UNAVAILABLE", "message": "Lakehouse tidak dapat dibaca", "detail": "palsu"}
    }
