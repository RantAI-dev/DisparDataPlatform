"""Uji panggung indikator (plan 04): 28 indikator + daftar GCI/GPCI + 3 halaman pariwisata (golden live),
`gci/resmi` dan `dataset-tematik` (golden statis), dibandingkan persis dengan Data API.

Daftar indikator memakai `INDIKATOR_BERKAS` (salinan Bronze masih basi sampai plan 06 bagian A).
Penyempitan yang diizinkan kontrak: tabel placeholder `RawDataDisclosure` ("Memuat data…") di halaman
pariwisata tidak dikirim Data API, jadi dibuang dari golden sebelum dibandingkan.

Satu toleransi tercatat untuk daftar indikator: `latest` golden boleh `null` bila oracle Next.js kena
timeout 30 detik profil `app_readonly` saat membaca dataset besar (`try/catch` → null). Contoh 22 Okt:
CE2/CI-DI (dataset 96.701 baris) timeout dari klien Node di laptop, sedangkan produksi menampilkan
"9.999 · periode 9999" (inventaris C §0.3), sama dengan Data API. Jumlah toleransi ditulis ke
`TOLERANSI_BERKAS` bila env itu di-set.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from data_api.main import buat_app
from data_api.shared.konfigurasi import muat
from tests.conftest import TOKEN, hash_token

pytestmark = pytest.mark.panggung

GOLDEN = Path(__file__).resolve().parents[1] / "golden"
INDIKATOR_BERKAS = Path(__file__).resolve().parents[4] / "platform-v2" / "data" / "gci-gpci-indicators.json"
BERKAS = sorted(
    [
        *GOLDEN.glob("live/indikator.*.json"),
        *GOLDEN.glob("live/pariwisata.*.json"),
        GOLDEN / "gci.resmi.json",
        *GOLDEN.glob("dataset-tematik.*.json"),
    ]
)
WAKTU: list[tuple[str, float]] = []
TOLERANSI: list[str] = []
PLACEHOLDER = [["Memuat data…"]]


@pytest.fixture(autouse=True)
def gabungan_tetap():
    """Panggung memakai logika sungguhan (menimpa fixture autouse conftest)."""


@pytest.fixture(scope="module")
def klien():
    if not all(os.environ.get(v) for v in ("CH_URL", "CH_USER", "CH_PASSWORD")):
        pytest.skip("CH_URL/CH_USER/CH_PASSWORD tidak di-set")
    env = {**os.environ, "DATA_API_TOKENS": f"panggung:{hash_token(TOKEN)}", "INDIKATOR_BERKAS": str(INDIKATOR_BERKAS)}
    with TestClient(buat_app(muat(env)), headers={"Authorization": f"Bearer {TOKEN}"}) as c:
        yield c
    if tujuan := os.environ.get("WAKTU_BERKAS_INDIKATOR"):
        Path(tujuan).write_text(json.dumps(WAKTU, ensure_ascii=False))
    if tujuan := os.environ.get("TOLERANSI_BERKAS"):
        Path(tujuan).write_text("\n".join(TOLERANSI))


def _sempitkan(g: dict) -> dict:
    data = g["data"]
    if g["endpoint"].startswith("/v1/pariwisata/"):
        data = {**data, "tabel": [t for t in data["tabel"] if t["rows"] != PLACEHOLDER]}
    return data


@pytest.mark.parametrize("berkas", BERKAS, ids=[b.stem for b in BERKAS])
def test_indikator_sama_dengan_golden(klien, berkas):
    g = json.loads(berkas.read_text())
    path = g["endpoint"].replace("{code}", g["params"].get("code", ""))
    params = {k: v for k, v in g["params"].items() if k != "code"}
    klien.app.state.cache.kosongkan()
    mulai = time.perf_counter()
    r = klien.get(path, params=params)
    WAKTU.append((g["endpoint"], time.perf_counter() - mulai))
    assert r.status_code == 200, r.text
    assert "peringatan" not in r.json()["meta"], r.json()["meta"]
    data, harap = r.json()["data"], _sempitkan(g)
    if g["endpoint"] == "/v1/indikator":
        for a, b in zip(data["rows"], harap["rows"], strict=True):
            if b["latest"] is None and a["latest"] is not None:
                TOLERANSI.append(f"{a['code']}: golden null (timeout oracle), Data API {a['latest']}")
                b["latest"] = a["latest"]
    assert data == harap
    if "dataset_terpilih" in (g.get("meta") or {}):
        assert r.json()["meta"]["dataset_terpilih"] == g["meta"]["dataset_terpilih"]
