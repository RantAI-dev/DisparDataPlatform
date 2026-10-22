"""Pemilihan dataset indikator dan readiness — port apa adanya [K-12]:
`lib/indicator-data.ts` (`datasetsFor`, `primaryData`, `pickData`) dan `lib/gci/readiness.ts`
(`computeReadiness`, `latestValue`). Defect D1–D10 ikut ditiru (C §2.6), termasuk "Nilai
terbaru" yang berisi sampah (D9): hasilnya bergantung urutan simpan baris Silver.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from data_api.shared import hitungan, indikator_sumber, lake
from data_api.shared import queries as sq
from data_api.shared.atlas_gabungan import kunci_kolasi
from data_api.shared.errors import Upstream
from data_api.shared.konteks import Konteks

from .agg import Row, ambil, js_number, nullish

READINESS_ORDER = {"gap": 0, "partial": 1, "ready": 2}
_LABEL_RE = re.compile("periode|tahun|bulan|tanggal", re.IGNORECASE)
_MEASURE_LATEST = re.compile(
    "jumlah|total|nilai|pajak|pendapatan|kunjungan|pengunjung|wisatawan|persen|rata|kamar|realisasi", re.IGNORECASE
)


@dataclass
class Data:
    """Hasil `primaryData`/`pickData`: dataset terpilih beserta barisnya."""

    title: str
    slug: str
    rows: list[Row] = field(default_factory=list)


@dataclass
class Pemuat:
    """Satu permintaan: katalog, total, dan baris dataset dibaca sekali lalu dipakai ulang."""

    k: Konteks
    _baris: dict[str, list[Row]] = field(default_factory=dict)

    def indikator(self) -> list[dict[str, Any]]:
        return indikator_sumber.daftar(self.k)

    def satu(self, code: str) -> dict[str, Any] | None:
        return next((i for i in self.indikator() if i["code"] == code), None)

    def katalog(self) -> list[dict[str, Any]]:
        return self.k.cache.ambil(("indikator", "katalog"), self.k.konf.cache_ttl_default, lambda: sq.katalog(self.k))

    def baris(self, slug: str) -> list[Row]:
        if slug not in self._baris:
            self._baris[slug] = lake.baris_dataset(self.k, slug)
        return self._baris[slug]


def _cocok(ind: dict[str, Any], katalog: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Judul katalog yang memuat salah satu kata kunci `match` (substring mentah, huruf kecil)."""
    if not ind.get("match"):
        return []
    return [d for d in katalog if any(kw in (d["title"] or "").lower() for kw in ind["match"])]


def datasets_for(p: Pemuat, code: str) -> list[dict[str, Any]]:
    ind = p.satu(code)
    if not ind or not ind.get("match"):
        return []
    totals = hitungan.total_sync(p.k)
    ds = [{"slug": d["slug"], "title": d["title"], "total": totals.get(d["slug"], 0)} for d in _cocok(ind, p.katalog())]
    return sorted((d for d in ds if d["total"] > 0), key=lambda d: -d["total"])


def primary_data(p: Pemuat, code: str) -> Data | None:
    ds = datasets_for(p, code)
    if not ds:
        return None
    return Data(ds[0]["title"], ds[0]["slug"], p.baris(ds[0]["slug"]))


def pick_data(p: Pemuat, code: str, wajib: list[str]) -> Data | None:
    """Dataset yang punya semua kolom `wajib`, periode terbaru dulu lalu terbesar; fallback terbesar."""
    ds = datasets_for(p, code)
    if not ds:
        return None
    kunci = lake.kunci_kolom(p.k, [d["slug"] for d in ds])
    calon = []
    for d in ds:
        if not all(c in kunci.get(d["slug"], set()) for c in wajib):
            continue
        rows = p.baris(d["slug"])
        if not rows:
            continue
        max_p = ""
        for r in rows:
            v = nullish(ambil(r, "periode_data"), "")
            if v > max_p:
                max_p = v
        calon.append((d, rows, max_p))
    if calon:
        # `b.maxP.localeCompare(a.maxP) || b.total - a.total` (sort stabil, dua tahap)
        calon.sort(key=lambda c: c[0]["total"], reverse=True)
        calon.sort(key=lambda c: kunci_kolasi(c[2]), reverse=True)
        d, rows, _ = calon[0]
        return Data(d["title"], d["slug"], rows)
    return Data(ds[0]["title"], ds[0]["slug"], p.baris(ds[0]["slug"]))


# ── readiness ─────────────────────────────────────────────────────────────────


_ANGKA = re.compile(r"^-?[0-9]+(\.[0-9]+)?$")


def _num(v: Any) -> float | None:
    s = nullish(v, "").strip()
    if not _ANGKA.match(s):
        return None
    return js_number(s)


def latest_value(p: Pemuat, slug: str, measure: str | None) -> dict[str, Any] | None:
    """`latestValue`: label = kolom periode pertama (atau kolom pertama) — sering sampah (D9)."""
    cols = [r["key_asli"] for r in lake.kolom_dataset(p.k, slug)]
    rows = p.baris(slug)
    if not rows or not cols:
        return None
    measure_re = re.compile(measure, re.IGNORECASE) if measure else _MEASURE_LATEST

    def is_num(key: str) -> bool:
        return sum(1 for r in rows if _num(ambil(r, key)) is not None) >= len(rows) * 0.9

    value_col = next((c for c in cols if measure_re.search(c) and not _LABEL_RE.search(c) and is_num(c)), None) or next(
        (c for c in cols if not _LABEL_RE.search(c) and is_num(c)), None
    )
    if not value_col:
        return None
    label_col = next((c for c in cols if _LABEL_RE.search(c)), cols[0])
    urut = sorted(rows, key=lambda r: kunci_kolasi(nullish(ambil(r, label_col), "")), reverse=True)
    for r in urut:
        v = _num(ambil(r, value_col))
        if v is not None:
            return {"label": nullish(ambil(r, label_col), ""), "value": v, "datasetSlug": slug}
    return None


def compute_readiness(p: Pemuat, framework: str | None = None) -> list[dict[str, Any]]:
    katalog = p.katalog()
    totals = hitungan.total_sync(p.k)
    hasil = []
    for ind in p.indikator():
        if framework and ind["framework"] != framework:
            continue
        matched = _cocok(ind, katalog)
        with_data = sorted(
            (
                {"slug": d["slug"], "title": d["title"], "total": totals.get(d["slug"], 0)}
                for d in matched
                if totals.get(d["slug"], 0) > 0
            ),
            key=lambda d: -d["total"],
        )
        status = "gap" if not matched else "ready" if with_data else "partial"
        if READINESS_ORDER[status] > READINESS_ORDER[ind["draftReadiness"]]:
            status = ind["draftReadiness"]
        latest = None
        if with_data:
            try:
                latest = latest_value(p, with_data[0]["slug"], ind.get("measure"))
            except (re.error, Upstream):
                # Sama dengan try/catch Next.js: kegagalan (mis. timeout 30 dtk profil app_readonly
                # saat membaca dataset besar) membuat "Nilai terbaru" kosong, bukan 5xx.
                latest = None
        hasil.append({**ind, "status": status, "datasets": with_data[:5], "latest": latest})
    return hasil
