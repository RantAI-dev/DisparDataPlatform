"""Uji panggung plan 05: atlas, GMTI, spasial, hotel-scraped terhadap lake sungguhan.

- Endpoint statis (atlas.*, gmti.*) dibandingkan dengan golden statis plan 01: memastikan bacaan Bronze live
  sama dengan berkas yang dipakai gate unit.
- `/v1/spasial` dibandingkan dengan golden live (porsi Silver berubah tiap hari; buat ulang golden tepat
  sebelum uji). `catatan` dan `kepadatan_tanpa_koordinat` tidak ada di golden (lihat openapi x-catatan).
- `/v1/hotel-scraped` tidak punya golden Next.js (route lama membaca mart kosong): dibandingkan dengan SQL
  route yang dijalankan ClickHouse atas Bronze yang ditipekan ulang (tanpa jendela 7 hari, SPEC P5).
"""

from __future__ import annotations

import gzip
import json
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from data_api.main import buat_app
from data_api.shared.konfigurasi import muat
from tests.conftest import TOKEN, hash_token

pytestmark = pytest.mark.panggung

GOLDEN = Path(__file__).resolve().parents[1] / "golden"
STATIS = sorted([*GOLDEN.glob("atlas.*.json"), *GOLDEN.glob("gmti.*.json")])
BOOKING = "lake.`bronze_file.booking_hotel_2026_09_15`"


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


def _gmti(klien, g: dict) -> None:
    halaman = sorted(k for k in g["data"] if k.startswith("items_halaman_"))
    for i, kunci in enumerate(halaman, start=1):
        r = klien.get("/v1/gmti/tempat", params={**g["params"], "page": i})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["data"]["items"] == g["data"][kunci]
        assert d["data"]["facets"] == g["data"]["facets"]
        assert d["meta"]["total"] == g["meta"]["total"]
    if "ids" in g["data"]:
        ids = []
        page = 1
        while True:
            d = klien.get("/v1/gmti/tempat", params={**g["params"], "page": page}).json()
            ids += [p["id"] for p in d["data"]["items"]]
            if not d["meta"]["has_more"]:
                break
            page += 1
        assert ids == g["data"]["ids"]


@pytest.mark.parametrize("berkas", STATIS, ids=[b.stem for b in STATIS])
def test_atlas_gmti_statis_sama_dengan_golden(klien, berkas):
    g = json.loads(berkas.read_text())
    if g["endpoint"] == "/v1/gmti/tempat":
        _gmti(klien, g)
        return
    r = klien.get(g["endpoint"], params=g["params"])
    assert r.status_code == 200, r.text
    assert r.json()["data"] == g["data"]
    if "total" in g.get("meta", {}):
        assert r.json()["meta"]["total"] == g["meta"]["total"]


def test_spasial_sama_dengan_golden_live(klien):
    g = json.loads((GOLDEN / "live" / "spasial.json").read_text())
    r = klien.get("/v1/spasial")
    assert r.status_code == 200, r.text
    d = r.json()
    data = {k: v for k, v in d["data"].items() if k not in ("catatan", "kepadatan_tanpa_koordinat")}
    assert data == {k: v for k, v in g["data"].items() if k != "catatan"}
    assert d["meta"]["total"] == g["meta"]["total"] and d["meta"]["per_kategori"] == g["meta"]["per_kategori"]
    tanpa = d["data"]["kepadatan_tanpa_koordinat"]
    assert sum(tanpa.values()) == 8331 - 770 and tanpa["tanjungpriok"] == 507
    if tujuan := os.environ.get("UKURAN_SPASIAL"):
        Path(tujuan).write_text(f"{len(r.content)} {len(gzip.compress(r.content))}\n")


def test_spasial_detail_titik_statis(klien):
    statis = json.loads((GOLDEN / "spasial.statis.json").read_text())["data"]["points_statis"]
    for p in statis[::97]:
        r = klien.get(f"/v1/spasial/titik/{p['id']}")
        assert r.status_code == 200, r.text
        assert r.json()["data"] == p


def _sql(klien, sql: str) -> list[dict]:
    return klien.app.state.ch.query(sql)


TIPE = f"""SELECT hotel_id, city, address, toDate(checkin) AS checkin, toDateTime(scraped_at) AS scraped_at,
  toFloat64OrNull(latitude) AS latitude, toFloat64OrNull(longitude) AS longitude,
  toFloat32OrNull(review_score) AS review_score, toUInt32OrNull(price_idr) AS price_idr,
  toUInt16OrNull(rooms_left) AS rooms_left, toUInt8OrNull(total_room_types) AS total_room_types,
  room_types_json FROM {BOOKING}"""


def test_hotel_scraped_sama_dengan_sql_route_atas_bronze(klien):
    d = klien.get("/v1/hotel-scraped").json()["data"]
    rows = _sql(
        klien,
        f"""WITH b AS ({TIPE})
        SELECT hotel_id, review_score, price_idr FROM b
        WHERE (checkin, hotel_id, scraped_at) IN
          (SELECT checkin, hotel_id, max(scraped_at) FROM b GROUP BY checkin, hotel_id)
        ORDER BY review_score DESC NULLS LAST, price_idr ASC NULLS LAST LIMIT 100""",
    )
    assert [(r["review_score"], r["price_idr"]) for r in d["rows"]] == [
        (r["review_score"], r["price_idr"]) for r in rows
    ]
    assert sorted(r["hotel_id"] for r in d["rows"]) == sorted(r["hotel_id"] for r in rows)
    stats = _sql(
        klien,
        f"""WITH b AS ({TIPE}) SELECT count() AS total,
        countIf(latitude IS NOT NULL AND longitude IS NOT NULL) AS with_coords, countIf(address != '') AS with_address,
        countIf(rooms_left IS NOT NULL) AS with_rooms_left, countIf(length(room_types_json) > 2) AS with_rooms,
        round(avg(price_idr)) AS avg_price, min(price_idr) AS min_price, max(price_idr) AS max_price,
        uniqExact(city) AS distinct_cities FROM b""",
    )[0]
    kamar = _sql(
        klien,
        f"""WITH b AS ({TIPE}), per_hotel AS (SELECT hotel_id, anyLast(total_room_types) AS rooms_for_hotel
        FROM b GROUP BY hotel_id HAVING rooms_for_hotel IS NOT NULL)
        SELECT sum(rooms_for_hotel) AS total_room_types, round(avg(rooms_for_hotel), 1) AS avg_room_types_per_hotel
        FROM per_hotel""",
    )[0]
    assert d["stats"] == {**stats, **kamar}
    assert d["stats"]["total"] == 72
