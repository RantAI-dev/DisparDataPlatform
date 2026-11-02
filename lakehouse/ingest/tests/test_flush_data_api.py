"""Hook flush cache Data API di akhir refresh_lakehouse (plan 06 bagian A)."""

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from dispar_ingest.flush_data_api import flush_cache


@pytest.fixture
def data_api():
    """Data API palsu: mencatat request, menjawab sesuai `status`."""
    catatan = {"status": 200, "request": []}

    class H(BaseHTTPRequestHandler):
        def do_POST(self):
            catatan["request"].append((self.path, self.headers.get("Authorization")))
            body = json.dumps({"data": {"dikosongkan": 3}}).encode()
            self.send_response(catatan["status"])
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):
            pass

    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    catatan["url"] = f"http://127.0.0.1:{srv.server_port}/v1/admin/cache/flush"
    yield catatan
    srv.shutdown()


def test_token_kosong_dilewati(monkeypatch):
    monkeypatch.delenv("DATA_API_FLUSH_TOKEN", raising=False)
    assert flush_cache().startswith("dilewati")


def test_sukses_mengirim_token_dagster(monkeypatch, data_api):
    monkeypatch.setenv("DATA_API_FLUSH_TOKEN", "rahasia-uji")
    monkeypatch.setenv("DATA_API_FLUSH_URL", data_api["url"])
    hasil = flush_cache()
    assert hasil.startswith("sukses: HTTP 200")
    assert data_api["request"] == [("/v1/admin/cache/flush", "Bearer rahasia-uji")]


def test_ditolak_dicatat_tanpa_exception(monkeypatch, data_api):
    data_api["status"] = 403
    monkeypatch.setenv("DATA_API_FLUSH_TOKEN", "token-salah")
    monkeypatch.setenv("DATA_API_FLUSH_URL", data_api["url"])
    assert flush_cache().startswith("gagal: HTTP 403")


def test_tidak_terjangkau_dicatat_tanpa_exception(monkeypatch):
    monkeypatch.setenv("DATA_API_FLUSH_TOKEN", "rahasia-uji")
    monkeypatch.setenv("DATA_API_FLUSH_URL", "http://127.0.0.1:9/v1/admin/cache/flush")
    assert flush_cache().startswith("gagal:")


def test_aset_ada_di_akhir_refresh_dan_tidak_menggagalkan(monkeypatch):
    from dagster import build_asset_context

    from dispar_orchestrate.definitions import defs, flush_data_api, refresh_job

    dipilih = refresh_job.selection.resolve(defs.resolve_asset_graph())
    assert "flush_data_api" in {k.to_user_string() for k in dipilih}
    monkeypatch.setenv("DATA_API_FLUSH_TOKEN", "rahasia-uji")
    monkeypatch.setenv("DATA_API_FLUSH_URL", "http://127.0.0.1:9/v1/admin/cache/flush")
    flush_data_api(build_asset_context())  # gagal terhubung → hanya peringatan di log
