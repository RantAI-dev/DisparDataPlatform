"""Setiap respons endpoint plan 02 divalidasi terhadap `openapi.yaml` (ClickHouse palsu)."""

from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

SPEC = yaml.safe_load((Path(__file__).resolve().parents[2] / "openapi.yaml").read_text())
REGISTRY = Registry().with_resource("urn:kontrak", Resource.from_contents(SPEC, default_specification=DRAFT202012))


def _pointer(*bagian: str) -> str:
    return "/".join(str(b).replace("~", "~0").replace("/", "~1") for b in bagian)


def validasi(path: str, metode: str, status: int, isi, media: str = "application/json") -> None:
    respons = SPEC["paths"][path][metode]["responses"][str(status)]
    if "$ref" in respons:
        nama = respons["$ref"].rsplit("/", 1)[1]
        ptr = _pointer("components", "responses", nama, "content", media, "schema")
    else:
        ptr = _pointer("paths", path, metode, "responses", str(status), "content", media, "schema")
    v = Draft202012Validator({"$ref": f"urn:kontrak#/{ptr}"}, registry=REGISTRY)
    galat = sorted(v.iter_errors(isi), key=lambda e: list(e.path))
    assert not galat, [f"{list(e.path)}: {e.message}" for e in galat[:5]]


KASUS = [
    ("/v1/katalog", "/v1/katalog", {}, 200),
    ("/v1/katalog", "/v1/katalog", {"tier": "sekunder"}, 200),
    ("/v1/katalog", "/v1/katalog", {"tier": "x"}, 400),
    ("/v1/dataset/{slug}", "/v1/dataset/wisman", {}, 200),
    ("/v1/dataset/{slug}", "/v1/dataset/event", {}, 200),
    ("/v1/dataset/{slug}", "/v1/dataset/tidak-ada", {}, 404),
    ("/v1/dataset/{slug}/kolom", "/v1/dataset/wisman/kolom", {}, 200),
    ("/v1/dataset/{slug}/kolom", "/v1/dataset/tidak-ada/kolom", {}, 404),
    ("/v1/dataset/{slug}/facet", "/v1/dataset/wisman/facet", {}, 200),
    ("/v1/dataset/{slug}/baris", "/v1/dataset/wisman/baris", {}, 200),
    ("/v1/dataset/{slug}/baris", "/v1/dataset/wisman/baris", {"f": "kebangsaan:in:JEPANG", "sort": "jumlah:desc"}, 200),
    ("/v1/dataset/{slug}/baris", "/v1/dataset/wisman/baris", {"f": "x:in:y"}, 400),
    ("/v1/dataset/{slug}/baris", "/v1/dataset/tidak-ada/baris", {}, 404),
    ("/v1/dataset/{slug}/agregat", "/v1/dataset/wisman/agregat", {"x": "kebangsaan", "agg": "count"}, 200),
    ("/v1/dataset/{slug}/agregat", "/v1/dataset/wisman/agregat", {"x": "kebangsaan", "agg": "x"}, 400),
    ("/v1/dataset/{slug}/ekspor", "/v1/dataset/tidak-ada/ekspor", {}, 404),
    ("/v1/beranda/ringkasan", "/v1/beranda/ringkasan", {}, 200),
]


@pytest.mark.parametrize(("path", "url", "params", "status"), KASUS)
def test_respons_json_sesuai_kontrak(klien, path, url, params, status):
    r = klien.get(url, params=params)
    assert r.status_code == status, r.text
    validasi(path, "get", status, r.json())
    assert r.headers["x-request-id"]


def test_ekspor_csv_sesuai_kontrak(klien):
    r = klien.get("/v1/dataset/wisman/ekspor")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    validasi("/v1/dataset/{slug}/ekspor", "get", 200, r.text, "text/csv")
    for h in SPEC["paths"]["/v1/dataset/{slug}/ekspor"]["get"]["responses"]["200"]["headers"]:
        assert h.lower() in r.headers


def test_ekspor_413_sesuai_kontrak(ch, env):
    from fastapi.testclient import TestClient

    from data_api.main import buat_app
    from data_api.shared.konfigurasi import muat
    from tests.conftest import TOKEN

    with TestClient(
        buat_app(muat({**env, "EXPORT_MAX_ROWS": "1"}), ch), headers={"Authorization": f"Bearer {TOKEN}"}
    ) as c:
        r = c.get("/v1/dataset/wisman/ekspor")
    assert r.status_code == 413
    validasi("/v1/dataset/{slug}/ekspor", "get", 413, r.json())


def test_sistem_sesuai_kontrak(app, ch):
    from fastapi.testclient import TestClient

    from tests.conftest import TOKEN_DAGSTER

    with TestClient(app) as c:
        validasi("/v1/health", "get", 200, c.get("/v1/health").json())
        validasi("/v1/katalog", "get", 401, c.get("/v1/katalog").json())
        ch.gagal = True
        validasi("/v1/health", "get", 503, c.get("/v1/health").json())
        ch.gagal = False
    with TestClient(app, headers={"Authorization": f"Bearer {TOKEN_DAGSTER}"}) as c:
        validasi("/v1/admin/cache/flush", "post", 200, c.post("/v1/admin/cache/flush").json())


def test_semua_endpoint_plan02_diuji():
    """Daftar kasus menutup setiap path plan 02 di kontrak."""
    plan02 = {p for p in SPEC["paths"] if p.startswith(("/v1/katalog", "/v1/dataset/", "/v1/beranda/"))}
    assert plan02 == {k[0] for k in KASUS} | {"/v1/dataset/{slug}/ekspor"}


def test_validator_menolak_bentuk_salah():
    with pytest.raises(AssertionError):
        validasi("/v1/dataset/{slug}/baris", "get", 200, {"data": {"items": []}, "meta": {"total": "5"}})
    with pytest.raises(AssertionError):
        validasi("/v1/katalog", "get", 401, {"error": {"code": "SALAH", "message": "x", "detail": None}})
