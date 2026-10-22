"""Fixture bersama: ClickHouse palsu dan klien uji FastAPI.

`ChPalsu` menjawab SQL Data API dari data kecil di memori. Ia mengenali query dari potongan teks
yang khas (bukan parser SQL), cukup untuk menguji logika Python: penggabungan katalog, medallion,
kolom tampil, facet, agregat, halaman, ekspor. Perilaku SQL sungguhan diuji `panggung/`.
"""

from __future__ import annotations

import hashlib
import re
from collections import Counter
from typing import Any

import pytest
from fastapi.testclient import TestClient

from data_api.main import buat_app
from data_api.shared.konfigurasi import muat

TOKEN = "rahasia-uji"
TOKEN_DAGSTER = "rahasia-dagster"
AUDIT = {"_ingested_at": "2026-10-21 00:00:00", "_source_url": "x", "_batch_id": "b", "_row_hash": "h", "_tenant": "t"}

KATALOG = [
    # slug, title, tags, views, updated_at, tier, table_name
    (
        "wisman",
        "Wisman per Kebangsaan",
        '["Wisman","kebangsaan"]',
        "1598",
        "2026-10-21T03:19:38.000000Z",
        "primer",
        "t_wisman",
    ),
    (
        "event",
        "Event 2011-2019",
        '["event","Wisman"]',
        "10",
        "2026-09-01T00:00:00.000000Z",
        "primer",
        "data_event_pariwisata_dan_kebudayaan_dki_jakarta_2011_2019",
    ),
    ("mentah", "Hanya Bronze", "bukan json", "x", "", "primer", "t_mentah"),
    ("wisman-jakarta-per-negara", "Teks lake berbeda", '["lake"]', "0", "2026-08-01", "sekunder", "t_venue"),
]
SYNC = {
    "wisman": {"total": "5", "sumber_data": '["BPS DKI"]', "frekuensi": "1 Bulan Sekali", "satuan": "Orang"},
    "event": {"total": "3", "sumber_data": "", "frekuensi": "", "satuan": ""},
    "mentah": {"total": "7", "sumber_data": "[]", "frekuensi": "", "satuan": ""},
    "wisman-jakarta-per-negara": {"total": "604", "sumber_data": "[]", "frekuensi": "", "satuan": ""},
}
KOLOM = {
    "wisman": [("kebangsaan", "komponen", "varchar", "1"), ("jumlah", "nilai", "int", "2")],
    "event": [("nama_event", "komponen", "varchar", "1")],
    "mentah": [("a", "", "", "1")],
    "wisman-jakarta-per-negara": [("negara", "Negara", "string", "1")],
}
SKEMA = {
    "t_wisman": {
        "periode_data": "Date",
        "kebangsaan": "Nullable(String)",
        "jumlah": "Nullable(Int64)",
        "catatan": "Nullable(String)",
        **{k: "Nullable(String)" for k in AUDIT},
    },
    "data_event_pariwisata_dan_kebudayaan_dki_jakarta_2011_2019": {"periode_data": "UInt16", "nama_event": "String"},
    "t_venue": {"negara": "LowCardinality(Nullable(String))"},
}
BARIS = {
    "t_wisman": [
        {"periode_data": "2026-01-01", "kebangsaan": "JEPANG", "jumlah": "100", "catatan": 'a "b", c', **AUDIT},
        {"periode_data": "2026-02-01", "kebangsaan": "JEPANG", "jumlah": "200", "catatan": None, **AUDIT},
        {"periode_data": "2026-01-01", "kebangsaan": "MALAYSIA", "jumlah": "50", "catatan": "", **AUDIT},
        {"periode_data": "2026-02-01", "kebangsaan": "Ägypten", "jumlah": "50", "catatan": None, **AUDIT},
        {"periode_data": "2026-03-01", "kebangsaan": "", "jumlah": "7", "catatan": None, **AUDIT},
    ],
    "data_event_pariwisata_dan_kebudayaan_dki_jakarta_2011_2019": [
        {"periode_data": 2011, "nama_event": "A"},
        {"periode_data": 2019, "nama_event": "B"},
        {"periode_data": 2015, "nama_event": "C"},
    ],
    "t_venue": [{"negara": f"N{i:03d}"} for i in range(604)],
}
BRONZE_FILE = {
    "gmti_ibadah": 8331,
    "event_pertunjukan": 308,
    "golf": 14,
    "souvenir": 67,
    "hotel_registri": 120,
}
INDIKATOR = [
    {
        "framework": fw,
        "code": f"{fw}{i}",
        "dataavailable": "True",
        "match": '["x"]',
        "officialno": None,
        "draftreadiness": "ready",
        **AUDIT,
    }
    for fw, n in (("GCI", 8), ("GPCI", 20))
    for i in range(n)
]


class ChPalsu:
    """Pengganti `shared.ch.ClickHouse` dengan `query(sql, params, rid)` yang sama."""

    def __init__(self) -> None:
        self.log: list[tuple[str, dict[str, Any]]] = []
        self.gagal = False

    def tutup(self) -> None:
        pass

    def query(self, sql: str, params: dict[str, Any] | None = None, rid: str | None = None) -> list[dict[str, Any]]:
        p = params or {}
        self.log.append((sql, p))
        if self.gagal:
            from data_api.shared.errors import Upstream

            raise Upstream("Lakehouse tidak dapat dibaca", "palsu")
        return self._jawab(" ".join(sql.split()), p)

    def _jawab(self, sql: str, p: dict[str, Any]) -> list[dict[str, Any]]:
        if sql == "SELECT 1 AS ok":
            return [{"ok": 1}]
        if "toString(views) AS views" in sql:
            kunci = ("slug", "title", "tags", "views", "updated_at", "tier", "table_name")
            return [dict(zip(kunci, r, strict=True)) | {"description": f"Deskripsi {r[0]}"} for r in KATALOG]
        if "SELECT slug, toString(total) AS total" in sql:
            return [{"slug": s, "total": v["total"]} for s, v in SYNC.items()]
        if "sumber_data, frekuensi" in sql:
            s = p["slug"]
            if s not in SYNC:
                return []
            judul = next(r[1] for r in KATALOG if r[0] == s)
            return [
                {
                    "slug": s,
                    "title": judul,
                    "description": f"Deskripsi {s}",
                    "klasifikasi": "",
                    "kontak": "a@b.id",
                    "author": "Dinas",
                    "table_name": "",
                    **SYNC[s],
                }
            ]
        if "SELECT key_asli, deskripsi" in sql:
            return [
                dict(zip(("key_asli", "deskripsi", "tipe", "ord"), c, strict=True)) for c in KOLOM.get(p["slug"], [])
            ]
        if sql.startswith("SELECT table_name"):
            return [{"table_name": r[6]} for r in KATALOG if r[0] == p["slug"]]
        if sql == "SHOW TABLES FROM silver":
            return [{"name": t} for t in SKEMA]
        if sql == "SHOW TABLES FROM serving":
            return [{"name": "mart_event"}, {"name": "mart_lain"}]
        if m := re.match(r"DESCRIBE TABLE silver\.`(\w+)`", sql):
            return [{"name": c, "type": t} for c, t in SKEMA[m[1]].items()]
        if m := re.search(r"FROM lake\.`bronze_file\.(\w+)`", sql):
            if "count()" in sql:
                return [{"c": str(BRONZE_FILE[m[1]])}]
            assert m[1] == "gci_gpci_indicators", m[1]
            return INDIKATOR
        if m := re.search(r"FROM silver\.`(\w+)`", sql):
            return self._silver(sql, m[1], p)
        raise AssertionError(f"SQL tak dikenal ChPalsu: {sql[:200]}")

    def _silver(self, sql: str, tabel: str, p: dict[str, Any]) -> list[dict[str, Any]]:
        rows = BARIS[tabel]
        if "min(periode_data)" in sql:
            v = [str(r["periode_data"]) for r in rows]
            return [{"lo": min(v), "hi": max(v)}]
        if "toString(count()) AS c" in sql:
            return [{"c": str(len(self._saring(rows, sql, p)))}]
        if sql.startswith("SELECT *"):
            hasil = self._saring(rows, sql, p)
            return hasil[p["offset"] : p["offset"] + p["limit"]]
        if "AS mn0" in sql or "AS u0" in sql:
            out: dict[str, Any] = {}
            for fn, c, alias in re.findall(r"toString\((min|max)\(`(\w+)`\)\) AS (\w+)", sql):
                v = [r[c] for r in rows if r[c] is not None]
                out[alias] = str(min(v) if fn == "min" else max(v))
            for c, alias in re.findall(r"uniqUpTo\(\d+\)\(`(\w+)`\)\) AS (\w+)", sql):
                out[alias] = str(len({r[c] for r in rows if r[c] is not None}))
            return [out]
        if "{k0:String} AS k" in sql:
            hasil = []
            for i, c in enumerate(re.findall(r"toString\(`(\w+)`\) AS v", sql)):
                n = Counter(str(r[c]) for r in rows if r[c] not in (None, ""))
                hasil += [{"k": p[f"k{i}"], "v": v, "n": str(j)} for v, j in n.items()]
            return hasil
        if " AS name, " in sql:
            x = re.search(r"trim\(toString\(`(\w+)`\)\)\) AS name", sql)[1]
            kel: dict[str, list[float]] = {}
            for r in self._saring(rows, sql, p):
                nama = (r[x] or "").strip() or "—"
                y = re.search(r"replaceAll\(toString\(`(\w+)`\)", sql)
                kel.setdefault(nama, []).append(float(r[y[1]]) if y else 1.0)
            if "count()" in sql.split(" AS value")[0]:
                nilai = {n: float(len(v)) for n, v in kel.items()}
            else:
                nilai = {n: sum(v) for n, v in kel.items()}
            return [{"name": n, "value": str(v)} for n, v in sorted(nilai.items(), key=lambda t: (-t[1], t[0]))]
        raise AssertionError(f"SQL silver tak dikenal: {sql[:200]}")

    @staticmethod
    def _saring(rows: list[dict[str, Any]], sql: str, p: dict[str, Any]) -> list[dict[str, Any]]:
        """Cukup untuk uji: `q` (cari teks) dan filter `in` pertama."""
        hasil = rows
        if "q" in p:
            hasil = [r for r in hasil if p["q"].lower() in " ".join(str(v) for v in r.values()).lower()]
        if m := re.search(r"toString\(`(\w+)`\) IN \{f0:Array\(String\)\}", sql):
            hasil = [r for r in hasil if str(r[m[1]]) in p["f0"]]
        return hasil


def hash_token(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()


@pytest.fixture
def ch() -> ChPalsu:
    return ChPalsu()


@pytest.fixture
def env() -> dict[str, str]:
    return {"DATA_API_TOKENS": f"portal:{hash_token(TOKEN)},dagster:{hash_token(TOKEN_DAGSTER)}"}


@pytest.fixture
def app(ch: ChPalsu, env: dict[str, str]):
    return buat_app(muat(env), ch)  # type: ignore[arg-type]


@pytest.fixture
def klien(app) -> TestClient:
    with TestClient(app, headers={"Authorization": f"Bearer {TOKEN}"}) as c:
        yield c


@pytest.fixture(autouse=True)
def gabungan_tetap(monkeypatch):
    """Logika gabung Restoran GCI/Direktori diuji sendiri (`test_atlas_gabungan.py`) terhadap golden."""
    from data_api.shared import hitungan

    monkeypatch.setattr(hitungan, "_gabungan", lambda k, nama: {"restoran_gci": 2577, "direktori_restoran": 604}[nama])


@pytest.fixture
def mentah(monkeypatch):
    """Baris mentah query dashboard (lihat `tests/palsu_dashboard.py`)."""
    from tests.palsu_dashboard import pasang

    return pasang(monkeypatch)
