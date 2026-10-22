"""Setiap endpoint dashboard (plan 03) divalidasi terhadap `openapi.yaml`, termasuk respons Q21."""

import pytest

from data_api.features.dashboard import queries
from data_api.shared.errors import Upstream
from tests.kontrak import SPEC, validasi

KASUS = [
    ("/v1/dashboard/ringkasan", {}),
    ("/v1/dashboard/wisman/tahunan", {}),
    ("/v1/dashboard/wisman/bulanan", {}),
    ("/v1/dashboard/wisman/bulanan", {"periode": "2024-01"}),
    ("/v1/dashboard/wisman/kebangsaan", {"tahun": "2026"}),
    ("/v1/dashboard/wisman/kebangsaan", {"periode": "2025-01", "top": 3}),
    ("/v1/dashboard/wisman/pintu-masuk", {"tahun": "2025"}),
    ("/v1/dashboard/wisman/pintu-masuk", {"periode": "2025-01"}),
    ("/v1/dashboard/wisman/pintu-masuk", {"periode": "2026-03"}),
    ("/v1/dashboard/lama-menginap/rata-rata", {}),
    ("/v1/dashboard/lama-menginap/per-kelas", {"tamu": "wisman"}),
    ("/v1/dashboard/lama-menginap/per-kelas", {"tamu": "wisnus", "periode": "2025-01"}),
    ("/v1/dashboard/lama-menginap/seri", {"tamu": "wisnus"}),
    ("/v1/dashboard/wisnus/meta", {}),
    ("/v1/dashboard/wisnus/tahunan", {"kota": "Jakarta Pusat"}),
    ("/v1/dashboard/wisnus/per-kota", {"tahun": "2025"}),
    ("/v1/dashboard/wisnus/bulanan", {}),
    ("/v1/dashboard/wisnus/yoy", {"kota": "Seluruh Jakarta"}),
    ("/v1/dashboard/tenaga-kerja/dki", {}),
    ("/v1/dashboard/tenaga-kerja/subsektor", {"tahun": "2024"}),
    ("/v1/dashboard/tenaga-kerja/sertifikasi", {}),
    ("/v1/dashboard/pdrb-ekraf/makro", {}),
    ("/v1/dashboard/pdrb-ekraf/subsektor/sebaran", {"periode": "S1 2025"}),
    ("/v1/dashboard/pdrb-ekraf/subsektor/pertumbuhan", {}),
]


PATH_DASHBOARD = {p for p in SPEC["paths"] if p.startswith("/v1/dashboard/")}


@pytest.mark.parametrize(("path", "params"), KASUS)
def test_respons_sesuai_kontrak(klien, mentah, path, params):
    r = klien.get(path, params=params)
    assert r.status_code == 200, r.text
    validasi(path, "get", 200, r.json())
    # meta.source = x-sumber kontrak (sebagai himpunan)
    assert sorted(r.json()["meta"]["source"]) == sorted(SPEC["paths"][path]["get"]["x-sumber"])


def test_parameter_salah_sesuai_kontrak(klien, mentah):
    r = klien.get("/v1/dashboard/wisnus/tahunan", params={"kota": "Bandung"})
    assert r.status_code == 400
    validasi("/v1/dashboard/wisnus/tahunan", "get", 400, r.json())


@pytest.mark.parametrize("path", sorted(p for p in PATH_DASHBOARD if "pdrb-ekraf" not in p))
def test_q21_data_kosong_tetap_sesuai_kontrak(klien, mentah, monkeypatch, path):
    """Q21: semua query ClickHouse gagal → 200 + data kosong yang tetap sah menurut kontrak."""

    def gagal(k):
        raise Upstream("Lakehouse tidak dapat dibaca", "palsu")

    for nama in list(mentah):
        monkeypatch.setattr(queries, nama, gagal)
    params = {"tamu": "wisman"} if "lama-menginap/" in path and "rata-rata" not in path else {}
    r = klien.get(path, params=params)
    assert r.status_code == 200, r.text
    assert r.json()["meta"]["peringatan"]
    validasi(path, "get", 200, r.json())


def test_semua_endpoint_dashboard_diuji():
    assert {p for p, _ in KASUS} == PATH_DASHBOARD


@pytest.mark.parametrize(
    ("path", "params"),
    [(p, q) for p, q in KASUS if q and "pdrb-ekraf" not in p],
)
def test_q21_parameter_sah_tidak_ditolak_saat_data_kosong(klien, mentah, monkeypatch, path, params):
    """Saat query gagal, parameter yang biasanya sah tetap dijawab 200 kosong (bukan 400)."""

    def gagal(k):
        raise Upstream("Lakehouse tidak dapat dibaca", "palsu")

    for nama in list(mentah):
        monkeypatch.setattr(queries, nama, gagal)
    r = klien.get(path, params=params)
    assert r.status_code == 200, r.text
    validasi(path, "get", 200, r.json())


def test_q21_label_tahun_tanpa_bulan(klien, mentah, monkeypatch):
    def gagal(k):
        raise Upstream("Lakehouse tidak dapat dibaca", "palsu")

    monkeypatch.setattr(queries, "wisnus_kota", gagal)
    assert klien.get("/v1/dashboard/wisnus/per-kota", params={"tahun": "2025"}).json()["data"]["label"] == "2025"
