"""Setiap endpoint indikator (plan 04) divalidasi terhadap `openapi.yaml` dengan data palsu."""

import pytest

from tests.kontrak import SPEC, validasi

KASUS = [
    ("/v1/indikator", "/v1/indikator", {"framework": "GCI"}),
    ("/v1/indikator", "/v1/indikator", {"framework": "GPCI"}),
    ("/v1/indikator/{code}", "/v1/indikator/CE1", {}),
    ("/v1/indikator/{code}", "/v1/indikator/CE3", {}),
    ("/v1/indikator/{code}", "/v1/indikator/CE4", {}),
    ("/v1/indikator/{code}", "/v1/indikator/CI-LH", {}),
    ("/v1/indikator/{code}", "/v1/indikator/AC-AP", {}),
    ("/v1/gci/resmi", "/v1/gci/resmi", {}),
    ("/v1/dataset-tematik", "/v1/dataset-tematik", {"framework": "GCI"}),
    ("/v1/pariwisata/wisatawan-internasional", "/v1/pariwisata/wisatawan-internasional", {}),
    ("/v1/pariwisata/kuliner-michelin", "/v1/pariwisata/kuliner-michelin", {}),
    ("/v1/pariwisata/seni-pertunjukan", "/v1/pariwisata/seni-pertunjukan", {"tahun": "2025"}),
]
PATH_PLAN04 = {
    p for p in SPEC["paths"] if p.startswith(("/v1/indikator", "/v1/gci/", "/v1/dataset-tematik", "/v1/pariwisata/"))
}


@pytest.mark.parametrize(("path", "url", "params"), KASUS)
def test_respons_sesuai_kontrak(klien, indikator, path, url, params):
    r = klien.get(url, params=params)
    assert r.status_code == 200, r.text
    validasi(path, "get", 200, r.json())
    assert sorted(r.json()["meta"]["source"]) == sorted(SPEC["paths"][path]["get"]["x-sumber"])


def test_kode_tidak_dikenal_sesuai_kontrak(klien, indikator):
    r = klien.get("/v1/indikator/XX")
    assert r.status_code == 404
    validasi("/v1/indikator/{code}", "get", 404, r.json())


def test_semua_endpoint_plan04_diuji():
    assert {p for p, _, _ in KASUS} == PATH_PLAN04
