"""Endpoint indikator: daftar readiness, detail per kode, `gci/resmi`, dan `dataset-tematik`.

Sumber yang diport: `components/FrameworkView.tsx` (daftar), `app/gci/[code]/page.tsx` +
`components/indicators/registry.tsx` + `IndicatorShell`/`IndexContext` (detail dan teks fallback),
`components/GciOfficial.tsx`, `components/FrameworkDataLinks.tsx` @ 6b858eb.
"""

from __future__ import annotations

import json
from typing import Any

from data_api.shared import hitungan, lake
from data_api.shared.errors import InvalidParam, NotFound
from data_api.shared.format import angka_json, id_num
from data_api.shared.konteks import Konteks

from . import queries
from .pemilihan import Pemuat, compute_readiness
from .tampilan import VIEW


def _framework(framework: str) -> str:
    if framework not in ("GCI", "GPCI"):
        raise InvalidParam("framework harus GCI atau GPCI")
    return framework


# ── daftar (FrameworkView) ────────────────────────────────────────────────────


def daftar(k: Konteks, framework: str) -> dict[str, Any]:
    framework = _framework(framework)
    p = Pemuat(k)
    rows = compute_readiness(p, framework)
    official = {i["code"]: i["officialNo"] for i in p.indikator() if i.get("officialNo") is not None}
    # Bila ada nomor resmi: urut nomor (tanpa nomor = 999), sort stabil.
    tabel = (
        sorted(rows, key=lambda r: official.get(r["code"], 999)) if any(r["code"] in official for r in rows) else rows
    )

    def hitung(s: str) -> str:
        return str(sum(1 for r in rows if r["status"] == s))

    return {
        "framework": framework,
        "summary": [
            {"label": "TOTAL INDIKATOR", "value": str(len(rows))},
            {"label": "DATA ADA", "value": str(sum(1 for r in rows if r.get("dataAvailable")))},
            {"label": "READY", "value": hitung("ready")},
            {"label": "PARTIAL", "value": hitung("partial")},
            {"label": "GAP", "value": hitung("gap")},
        ],
        "rows": [
            {
                "no": r.get("officialNo"),
                "code": r["code"],
                "framework": r["framework"],
                "dimension": r["dimension"],
                "group": r.get("group"),
                "name": r["name"],
                "status": r["status"],
                "data_available": r["dataAvailable"],
                "owner": r.get("owner"),
                "note": r.get("note"),
                "datasets": r["datasets"],
                "latest": r["latest"],
            }
            for r in tabel
        ],
        "gaps": [r["code"] for r in rows if r["status"] != "ready"],
    }


# ── detail per kode ───────────────────────────────────────────────────────────

_STATUS_DATA = {"punya": "Punya", "proksi": "Proksi", "belum": "Belum ada"}


def _benchmark(k: Konteks) -> dict[str, dict[str, Any]]:
    """`gci-gpci-benchmarks.json` dari salinan Bronze (`bronze_file.gci_gpci_benchmark`)."""

    def buat() -> dict[str, dict[str, Any]]:
        hasil = {}
        for r in queries.bronze(k, "gci_gpci_benchmark"):
            hasil[r["metric_id"]] = {
                "indexMetric": r["index_metric"],
                "indexSource": r["index_source"],
                "unit": r["unit"],
                "frontier": {"city": r["frontier_city"], "value": r["frontier_value"]},
                "jakarta": {"value": r["jakarta_value"], "note": r["jakarta_note"]},
                "target": r["target"],
                "dataNeeded": json.loads(r["data_needed"] or "[]"),
            }
        return hasil

    return k.cache.ambil(("indikator", "benchmark"), k.konf.cache_ttl_default, buat)


def _teks_fallback(ind: dict[str, Any], b: dict[str, Any] | None) -> list[str]:
    """Teks halaman `IndicatorFallback` varian "Data belum tersedia", berurutan seperti markup."""
    t = [f"← {ind['framework']} · {ind['dimension']}", ind["name"]]
    if ind.get("definition"):
        t.append(ind["definition"])
    t.append(f"Sumber: {ind['name']}")
    if b:
        t += [
            "Cara indeks mengukur",
            b["indexMetric"],
            "Sumber resmi indeks:",
            b["indexSource"],
            f"Satuan: {b['unit']}",
            "Jakarta vs frontier",
            "Jakarta (data proksi)",
            b["jakarta"]["value"] if b["jakarta"]["value"] is not None else "—",
            f"Frontier ({b['frontier']['city']})",
            b["frontier"]["value"],
            "Target",
            b["target"],
        ]
        if b["jakarta"]["note"]:
            t.append(b["jakarta"]["note"])
        t.append("Data pendukung yang dibutuhkan")
        for d in b["dataNeeded"]:
            t += [_STATUS_DATA[d["status"]], d["label"], f"· {d['owner']}"]
    t += [
        "Data belum tersedia",
        f"{ind['framework']} · {ind['dimension']}",
        f"{ind['code']} · {ind['name']}",
        ind["definition"],
        "Owner / OPD pemilik",
        ind["owner"],
        "Status readiness",
        "gap",
        "Keterangan",
        ind["note"],
    ]
    # simpulTeks golden: teks di-trim dan simpul kosong dibuang.
    return [s.strip() for s in t if s and s.strip()]


def _info(ind: dict[str, Any]) -> dict[str, Any]:
    """Identitas indikator untuk hero halaman detail (IndicatorShell / IndicatorFallback)."""
    return {kk: ind.get(kk) for kk in ("framework", "dimension", "name", "definition", "owner", "note")}


def _konteks(b: dict[str, Any] | None) -> dict[str, Any] | None:
    """Benchmark indeks untuk kartu IndexContext (inventaris C §4.4: benchmark → konteks)."""
    if b is None:
        return None
    return {
        "index_metric": b["indexMetric"],
        "index_source": b["indexSource"],
        "unit": b["unit"],
        "frontier": b["frontier"],
        "jakarta": b["jakarta"],
        "target": b["target"],
        "data_needed": b["dataNeeded"],
    }


def detail(k: Konteks, code: str) -> tuple[dict[str, Any], list[str]]:
    p = Pemuat(k)
    code = code.upper()
    ind = p.satu(code)
    if ind is None:
        raise NotFound(f"Indikator tidak dikenal: {code}")
    view = VIEW.get(code)
    if view is None:
        # 9 indikator dataAvailable:false → kartu "Data belum tersedia".
        isi = {
            "code": code,
            "indikator": _info(ind),
            "konteks": _konteks(_benchmark(k).get(code)),
            "sources": [],
            "source_text": ind["name"] if ind.get("dataAvailable") is False else None,
            "kpis": [],
            "blocks": [],
            "teks_fallback": _teks_fallback(ind, _benchmark(k).get(code)),
        }
        return isi, []
    h = view(p, code)
    slugs = [d.slug for d in h["sumber"]]
    tier = lake.tier_dataset(k, slugs)
    isi = {
        "code": code,
        "indikator": _info(ind),
        "konteks": _konteks(_benchmark(k).get(code)),
        "sources": [{"slug": d.slug, "title": d.title, "tier": tier.get(d.slug, "primer")} for d in h["sumber"]],
        "source_text": None,
        "kpis": h["kpis"],
        "blocks": h["blocks"],
        "teks_fallback": None,
    }
    return isi, slugs


# ── gci/resmi (GciOfficial) ───────────────────────────────────────────────────

# Teks tampilan GciOfficial yang tidak ada di Bronze (label sumber, tautan, catatan kartu).
# `catatan` Bronze untuk Seni ("Belum digabung dengan data Disbud.") berbeda dengan teks app;
# yang tayang dipakai, seperti keputusan opsi 1 katalog.
_KARTU_RESMI = [
    ("Jumlah Museum", None, None),
    ("Seni Visual & Pertunjukan", "Belum mencakup data Dinas Kebudayaan.", "/gci/pariwisata/seni-pertunjukan"),
    ("Wisatawan Internasional", None, "/gci/pariwisata/wisatawan-internasional"),
    ("Penawaran Kuliner (Michelin)", "Belum ada Michelin Star di Jakarta.", "/gci/pariwisata/kuliner-michelin"),
]


def gci_resmi(k: Konteks) -> dict[str, Any]:
    rows = queries.bronze(k, "gci_kearney_resmi")

    def nilai(indikator: str, tahun: str | None = None) -> dict[str, Any]:
        cocok = [r for r in rows if r["indikator"] == indikator and (tahun is None or r["tahun"] == tahun)]
        if not cocok:
            raise NotFound(f"gci_kearney_resmi tidak memuat {indikator} {tahun or ''}".strip())
        return cocok[0]

    def peringkat(indikator: str) -> dict[str, int]:
        return {f"y{t}": int(nilai(indikator, t)["nilai"]) for t in ("2024", "2025")}

    kartu = []
    for label, catatan, href in _KARTU_RESMI:
        r = nilai(label)
        angka = angka_json(r["nilai"])
        kartu.append(
            {
                "label": label,
                "nilai": id_num(angka) if angka is not None else r["nilai"],
                "satuan": r["satuan"],
                "tahun": r["tahun"],
                "sumber": r["sumber"],
                "catatan": catatan,
                "href": href,
            }
        )
    return {
        "ranking": {
            "cultural": peringkat("Pengalaman Budaya (Cultural Experience)"),
            "overall": peringkat("Peringkat Keseluruhan (Overall)"),
            "sumber": {"label": "jakarta.go.id/competitiveness", "url": "https://www.jakarta.go.id/competitiveness"},
            "catatan": "Kearney GCI 2025. Peringkat makin kecil makin baik.",
        },
        "kartu": kartu,
    }


# ── dataset-tematik (FrameworkDataLinks) ──────────────────────────────────────

# `lib/data-sections.ts`: urutan menentukan nomor kartu (01–07).
DATA_SECTIONS = [
    ("Restoran GCI", "/gci/pariwisata/restoran-gci", "GCI"),
    ("Direktori Restoran", "/gci/pariwisata/direktori-restoran", "GCI"),
    ("Pertunjukan & Budaya", "/gci/pariwisata/pertunjukan-budaya", "GCI"),
    ("Hotel MICHELIN Key", "/sdi/michelin-keys-indonesia", "GCI"),
    ("Lapangan Golf", "/gpci/lapangan-golf", "GPCI"),
    ("Toko Suvenir", "/gpci/toko-suvenir", "GPCI"),
    ("Hotel & Akomodasi", "/gpci/hotel", "GPCI"),
]


def dataset_tematik(k: Konteks, framework: str) -> dict[str, Any]:
    framework = _framework(framework)
    baris = {e.href: n for e, n in hitungan.baris_sekunder(k)}
    return {
        "items": [
            {"no": f"{i + 1:02d}", "title": title, "href": href, "total": baris.get(href)}
            for i, (title, href, fw) in enumerate(DATA_SECTIONS)
            if fw == framework
        ]
    }
