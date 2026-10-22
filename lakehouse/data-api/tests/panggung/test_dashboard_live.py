"""Uji panggung dashboard (plan 03): setiap golden `dashboard.*` dibandingkan persis dengan Data API.

Golden live (`tests/golden/live/`) dibuat ulang tepat sebelum uji. Golden statis PDRB
(`tests/golden/dashboard.pdrb-ekraf.*`) dibandingkan dengan Bronze sungguhan. Waktu respons tiap
panggilan diukur tanpa cache Data API (cache dikosongkan sebelum tiap panggilan) dan ditulis ke
`WAKTU_BERKAS` bila env itu di-set.
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
BERKAS = sorted([*GOLDEN.glob("live/dashboard.*.json"), *GOLDEN.glob("dashboard.*.json")])
WAKTU: list[tuple[str, float]] = []


@pytest.fixture(autouse=True)
def gabungan_tetap():
    """Panggung memakai logika sungguhan (menimpa fixture autouse conftest)."""


@pytest.fixture(scope="module")
def klien():
    if not all(os.environ.get(v) for v in ("CH_URL", "CH_USER", "CH_PASSWORD")):
        pytest.skip("CH_URL/CH_USER/CH_PASSWORD tidak di-set")
    env = {**os.environ, "DATA_API_TOKENS": f"panggung:{hash_token(TOKEN)}"}
    with TestClient(buat_app(muat(env)), headers={"Authorization": f"Bearer {TOKEN}"}) as c:
        yield c
    if tujuan := os.environ.get("WAKTU_BERKAS"):
        Path(tujuan).write_text(json.dumps(WAKTU, ensure_ascii=False))


@pytest.mark.parametrize("berkas", BERKAS, ids=[b.stem for b in BERKAS])
def test_dashboard_sama_dengan_golden(klien, berkas):
    g = json.loads(berkas.read_text())
    klien.app.state.cache.kosongkan()
    mulai = time.perf_counter()
    r = klien.get(g["endpoint"], params=g["params"])
    WAKTU.append((g["endpoint"], time.perf_counter() - mulai))
    assert r.status_code == 200, r.text
    assert "peringatan" not in r.json()["meta"], r.json()["meta"]
    assert r.json()["data"] == g["data"]
