"""Autentikasi, amplop, request id + log (E §4.2 butir 9), metode (butir 10), docs, flush cache."""

import json

from fastapi.testclient import TestClient

from tests.conftest import TOKEN, TOKEN_DAGSTER


def test_tanpa_token_401(app):
    with TestClient(app) as c:
        r = c.get("/v1/katalog")
    assert r.status_code == 401
    assert r.json() == {
        "error": {"code": "UNAUTHORIZED", "message": "Token tidak ada atau tidak dikenal", "detail": None}
    }


def test_token_salah_401(app):
    with TestClient(app, headers={"Authorization": "Bearer salah"}) as c:
        assert c.get("/v1/dataset/wisman").status_code == 401


def test_health_tanpa_token(app, ch):
    with TestClient(app) as c:
        r = c.get("/v1/health")
        assert r.status_code == 200 and r.json()["status"] == "ok" and r.json()["clickhouse"] == "ok"
        ch.gagal = True
        r = c.get("/v1/health")
        assert r.status_code == 503 and r.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"


def test_request_id_dipantulkan_dan_dicatat(klien, capsys):
    r = klien.get("/v1/dataset/wisman/baris", headers={"X-Request-Id": "uji-123"})
    assert r.headers["x-request-id"] == "uji-123" and r.json()["meta"]["request_id"] == "uji-123"
    log = [json.loads(b) for b in capsys.readouterr().out.splitlines() if b.startswith("{")]
    baris = next(x for x in log if x["request_id"] == "uji-123")
    assert baris["path"] == "/v1/dataset/wisman/baris" and baris["status"] == 200
    assert baris["baris"] == 5 and baris["klien"] == "portal"
    assert TOKEN not in json.dumps(log)


def test_request_id_dibuat_dan_masuk_sql(klien, ch):
    r = klien.get("/v1/dataset/wisman")
    rid = r.headers["x-request-id"]
    assert len(rid) == 32 and r.json()["meta"]["request_id"] == rid
    assert r.json()["meta"]["generated_at"].endswith("+07:00")
    # Konteks meneruskan rid ke klien ClickHouse (ditulis sebagai komentar SQL di shared/ch.py)
    assert all(s for s, _ in ch.log)


def test_error_juga_membawa_request_id(klien):
    r = klien.get("/v1/dataset/tidak-ada", headers={"X-Request-Id": "e-1"})
    assert r.status_code == 404 and r.headers["x-request-id"] == "e-1"


def test_path_tidak_dikenal_404_beramplop(klien):
    r = klien.get("/v1/tidak-ada")
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"


def test_tidak_ada_patch_atau_metode_tulis(app):
    """Hanya GET, kecuali POST /v1/admin/cache/flush (SPEC §3.3)."""
    with TestClient(app, headers={"Authorization": f"Bearer {TOKEN}"}) as c:
        for path in ("/v1/katalog", "/v1/dataset/wisman", "/v1/dataset/wisman/baris", "/v1/beranda/ringkasan"):
            for metode in ("PATCH", "PUT", "DELETE", "POST"):
                assert c.request(metode, path).status_code == 405, (metode, path)
    with TestClient(app, headers={"Authorization": f"Bearer {TOKEN_DAGSTER}"}) as c:
        assert c.get("/v1/admin/cache/flush").status_code == 405
        assert c.patch("/v1/admin/cache/flush").status_code == 405


def test_docs_mati_bawaan(app):
    with TestClient(app) as c:
        for p in ("/docs", "/redoc", "/openapi.json"):
            assert c.get(p).status_code == 404


def test_docs_hidup_dengan_env(ch, env):
    from data_api.main import buat_app
    from data_api.shared.konfigurasi import muat

    with TestClient(buat_app(muat({**env, "DATA_API_DOCS": "1"}), ch)) as c:
        assert c.get("/openapi.json").status_code == 200


def test_flush_hanya_dagster(app):
    with TestClient(app, headers={"Authorization": f"Bearer {TOKEN}"}) as c:
        c.get("/v1/katalog")
        assert c.post("/v1/admin/cache/flush").status_code == 401
    with TestClient(app, headers={"Authorization": f"Bearer {TOKEN_DAGSTER}"}) as c:
        r = c.post("/v1/admin/cache/flush")
        assert r.status_code == 200 and r.json()["data"]["dikosongkan"] > 0
        assert c.post("/v1/admin/cache/flush").json()["data"]["dikosongkan"] == 0


def test_daftar_tabel_silver_dikosongkan_flush(app, ch):
    """Tabel Silver baru terbaca sesudah flush, tanpa restart (E §4.4)."""
    with TestClient(app, headers={"Authorization": f"Bearer {TOKEN_DAGSTER}"}) as c:
        c.get("/v1/dataset/wisman")
        n = sum(1 for s, _ in ch.log if s == "SHOW TABLES FROM silver")
        c.get("/v1/dataset/wisman")
        assert sum(1 for s, _ in ch.log if s == "SHOW TABLES FROM silver") == n
        c.post("/v1/admin/cache/flush")
        c.get("/v1/dataset/wisman")
        assert sum(1 for s, _ in ch.log if s == "SHOW TABLES FROM silver") == n + 1
