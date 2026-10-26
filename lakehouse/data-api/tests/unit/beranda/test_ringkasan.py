"""Ringkasan beranda: angka hidup dari lake (P4)."""

import json


def test_ringkasan(klien):
    r = klien.get("/v1/beranda/ringkasan")
    assert r.status_code == 200
    assert r.json()["data"] == {
        "dataset_primer": 3,
        "dataset_sekunder": 45,
        # 604 (sync) + 8.331 + 308 + 14 + 67 + 120 (bronze_file) + 2.577 + 604 (gabungan); slug lain 0 di data palsu
        "baris_sekunder": 604 + 8331 + 308 + 14 + 67 + 120 + 2577 + 604,
        "indikator": {"gci": 8, "gpci": 20, "total": 28},
        "indeks_global": 2,
    }


def test_indikator_dari_berkas(ch, env, tmp_path):
    from fastapi.testclient import TestClient

    from data_api.main import buat_app
    from data_api.shared.konfigurasi import muat
    from tests.conftest import TOKEN

    berkas = tmp_path / "ind.json"
    berkas.write_text(json.dumps([{"framework": "GCI"}, {"framework": "GPCI"}, {"framework": "GPCI"}]))
    app = buat_app(muat({**env, "INDIKATOR_BERKAS": str(berkas)}), ch)
    with TestClient(app, headers={"Authorization": f"Bearer {TOKEN}"}) as c:
        d = c.get("/v1/beranda/ringkasan").json()["data"]
    assert d["indikator"] == {"gci": 1, "gpci": 2, "total": 3}


def test_indikator_bronze_dinormalkan(klien):
    from data_api.shared import indikator_sumber
    from data_api.shared.konteks import Konteks

    s = klien.app.state
    daftar = indikator_sumber.daftar(Konteks(s.ch, s.cache, s.konf, "t"))
    assert daftar[0]["dataAvailable"] is True and daftar[0]["match"] == ["x"]
    assert "officialNo" not in daftar[0] and "_ingested_at" not in daftar[0]
