"""Logika fitur dataset: katalog, detail, kolom, facet, baris, agregat, ekspor.

Port `platform-v2/lib/ch/store.ts`, route `app/api/sdi/**`, dan `components/CatalogView.tsx`
(penggabungan katalog) @ 6b858eb. Yang sengaja berbeda dari Next.js:
- baris tanpa `sort` memakai urutan deterministik (SPEC §3.3), bukan urutan simpan;
- daftar tabel Silver/serving di-cache 10 menit, bukan selamanya (E §4.4);
- ekspor di atas `EXPORT_MAX_ROWS` ditolak 413 dan dibaca per halaman 10.000 baris.
"""

from __future__ import annotations

import io
import json
import os
import re
import tempfile
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

from openpyxl import Workbook
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE

from data_api.shared import hitungan, lake
from data_api.shared import queries as sq
from data_api.shared.atlas_gabungan import kunci_kolasi
from data_api.shared.errors import InvalidFilter, NotFound, TooLarge
from data_api.shared.filters import RowQuery, build_clauses, is_filtered, kind_of
from data_api.shared.format import angka_id, angka_json, teks_sel
from data_api.shared.konteks import Konteks
from data_api.shared.paging import Halaman

from . import queries

TTL_SKEMA = 300
FACET_MAX_VALUES = 50
EKSPOR_PER_HALAMAN = 10_000
AGGS = {"sum", "avg", "count", "max", "min"}

# Sumber tiap mart Gold → tabel dasar yang mengisinya (salinan `GOLD_SOURCES` store.ts; ditulis
# eksplisit karena akun app tidak boleh membaca `system.*`). Keberadaan mart tetap dicek ke server.
GOLD_SOURCES: dict[str, list[str]] = {
    "mart_wisman": [
        "data_jumlah_kunjungan_dan_ranking_wisatawan_mancanegara_ke_provinsi_dki_jakarta_melalui_pintu_soekarno_hatta_berdasarkan_kebangsaan",
    ],
    "mart_kuliner": ["data_usaha_jasa_makanan_dan_minuman_jenis_usaha_restoran_di_dki_jakarta"],
    "mart_event": ["data_event_pariwisata_dan_kebudayaan_dki_jakarta_2011_2019"],
    "mart_kunjungan_dtw": ["kunjungan_31_dtw_juli_2026_sumber_mentah"],
    "mart_atlas": ["atlas_restoran", "atlas_souvenir", "atlas_nightlife", "atlas_pertunjukan"],
    "mart_gci_readiness": ["gci_gpci_indicators"],
}

# Dataset halaman Atlas yang datanya ada di lake sebagai berkas Bronze (kunci = id katalog sekunder).
ATLAS_TABLES = {"sec-gci-resto": "atlas_restoran", "sec-events": "atlas_pertunjukan"}

SUMBER_KATALOG = [sq.META, sq.META_SEC, "lake.bronze_meta*.dataset_sync"]


# ── metadata dasar ────────────────────────────────────────────────────────────


def _serving_ada(k: Konteks) -> set[str]:
    return k.cache.ambil(("tabel", "serving"), lake.TTL_DAFTAR_TABEL, lambda: sq.daftar_tabel(k, "serving"))


def _skema(k: Konteks, tabel: str) -> dict[str, str]:
    """Kolom Silver → tipe ClickHouse, tanpa kolom audit."""

    def buat() -> dict[str, str]:
        return {r["name"]: r["type"] for r in queries.describe(k, tabel) if r["name"] not in sq.AUDIT}

    return k.cache.ambil(("skema", tabel), TTL_SKEMA, buat)


def _tabel_silver(k: Konteks, slug: str) -> tuple[str, dict[str, str]] | None:
    tabel = lake.tabel_untuk(k, slug)
    if not tabel or tabel not in lake.silver_ada(k):
        return None
    return tabel, _skema(k, tabel)


def _json_array(s: str | None) -> list[str]:
    """`safeJsonArray` store.ts."""
    if not s:
        return []
    try:
        v = json.loads(s)
    except ValueError:
        return []
    # `v.map(String)`: String(null) = "null", berbeda dengan sel ekspor
    return ["null" if x is None else teks_sel(x) for x in v] if isinstance(v, list) else []


def _katalog_lake(k: Konteks) -> list[dict[str, Any]]:
    def buat() -> list[dict[str, Any]]:
        hasil = []
        for r in sq.katalog(k):
            try:
                views = int(r["views"])
            except (TypeError, ValueError):
                views = 0
            hasil.append(
                {
                    "slug": r["slug"],
                    "title": r["title"],
                    "description": r["description"],
                    "tags": _json_array(r["tags"]),
                    "views": views,
                    "updated_at": r["updated_at"] or None,
                    "tier": r["tier"],
                    "table_name": r["table_name"],
                }
            )
        return hasil

    return k.cache.ambil(("katalog", "lake"), k.konf.cache_ttl_default, buat)


# ── medallion ─────────────────────────────────────────────────────────────────


def _gold_dari(k: Konteks) -> dict[str, str]:
    """Tabel dasar → mart yang memakainya (hanya mart yang benar-benar ada)."""
    serving = _serving_ada(k)
    hasil: dict[str, str] = {}
    for mart, sumber in GOLD_SOURCES.items():
        if mart in serving:
            for t in sumber:
                hasil.setdefault(t, mart)
    return hasil


def _info_medallion(tabel: str, gold: dict[str, str], silver: set[str]) -> dict[str, str]:
    if tabel in gold:
        return {"level": "gold", "table": tabel, "mart": gold[tabel]}
    if tabel in silver:
        return {"level": "silver", "table": tabel}
    return {"level": "bronze", "table": tabel}


def medallion(k: Konteks) -> dict[str, dict[str, str]]:
    """slug → lapisan medallion tertinggi (`store.medallion`)."""
    gold, silver = _gold_dari(k), lake.silver_ada(k)
    return {r["slug"]: _info_medallion(r["table_name"], gold, silver) for r in _katalog_lake(k) if r["table_name"]}


def _medallion_katalog(k: Konteks) -> dict[str, dict[str, str]]:
    """Peta `/api/sdi/medallion`: slug katalog + id dataset Atlas; isi `{level, mart?}`."""
    gold, silver = _gold_dari(k), lake.silver_ada(k)
    tabel = {r["slug"]: r["table_name"] for r in _katalog_lake(k) if r["table_name"]} | ATLAS_TABLES
    return {
        kunci: {kk: v for kk, v in _info_medallion(t, gold, silver).items() if kk != "table"}
        for kunci, t in tabel.items()
    }


# ── katalog ───────────────────────────────────────────────────────────────────


def katalog(k: Konteks, tier: str, hal: Halaman) -> tuple[dict[str, Any], int]:
    """Gabungan katalog seperti `CatalogView`: primer (lake) lalu entri sekunder (`katalog_sekunder.toml`)."""
    primer = [r for r in _katalog_lake(k) if r["tier"] == "primer"]
    # `/api/sdi`: urut updated_at menurun (sort stabil; kosong paling akhir).
    primer.sort(key=lambda r: r["updated_at"] or "", reverse=True)
    medal = _medallion_katalog(k)

    baris: list[dict[str, Any]] = [
        {
            "id": f"sdi-{r['slug']}",
            "title": r["title"],
            "description": r["description"] or "",
            "tags": r["tags"],
            "tier": "primer",
            "source": "SDI · Satu Data Jakarta",
            "size_label": f"{angka_id(r['views'])} dilihat",
            "href": f"/sdi/{r['slug']}",
            "external": False,
            "_medal": r["slug"],
        }
        for r in primer
    ]
    for e, n in hitungan.baris_sekunder(k):
        baris.append(
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "tags": list(e.tags),
                "tier": "sekunder",
                "source": "Dinas Pariwisata & Ekraf DKI Jakarta" if e.external is False else "Pendataan Jakarta",
                "size_label": f"{angka_id(n)} baris",
                "href": e.href,
                "external": e.external,
                "_medal": e.slug_lake or e.id,
            }
        )

    katalog_tampil = [b for b in baris if tier != "primer" or b["tier"] == "primer"]
    layer: dict[str, int] = {"bronze": 0, "silver": 0, "gold": 0}
    for b in katalog_tampil:
        if lvl := medal.get(b["_medal"], {}).get("level"):
            layer[lvl] += 1
    terpilih = [b for b in katalog_tampil if tier != "sekunder" or b["tier"] == "sekunder"]
    items = [
        {**{kk: v for kk, v in b.items() if kk != "_medal"}, "medallion": medal.get(b["_medal"])} for b in terpilih
    ]

    # `sdiStats` atas baris primer.
    tags = {t.lower() for r in primer for t in r["tags"]}
    terbaru = sorted(r["updated_at"] for r in primer if r["updated_at"])
    stats = {
        "total": len(primer),
        "tags": len(tags),
        "views": sum(r["views"] for r in primer),
        "last_updated": terbaru[-1] if terbaru else None,
    }
    data = {"items": items[hal.offset : hal.offset + hal.size], "stats": stats, "layer_counts": layer}
    return data, len(items)


# ── detail ────────────────────────────────────────────────────────────────────


def _kolom_tampil(k: Konteks, slug: str) -> list[dict[str, Any]]:
    """`displayColumns`: kolom SDI yang ada di Silver + kolom Silver yang tak terdaftar
    (`periode_data` paling depan). Kolom metadata yang tak ada di Silver (mis. `id` yang dibuang
    generator Silver) tidak ditampilkan karena isinya pasti kosong."""

    def buat() -> list[dict[str, Any]]:
        cols = [
            {"key": r["key_asli"], "desc": r["deskripsi"] or None, "type": r["tipe"] or None}
            for r in lake.kolom_dataset(k, slug)
        ]
        if not cols:
            return cols
        t = _tabel_silver(k, slug)
        if not t:
            return cols
        dikenal = {c["key"] for c in cols}
        ekstra = [{"key": c, "desc": None, "type": None} for c in t[1] if c not in dikenal]
        return (
            [c for c in ekstra if c["key"] == "periode_data"]
            + [c for c in cols if c["key"] in t[1]]
            + [c for c in ekstra if c["key"] != "periode_data"]
        )

    return k.cache.ambil(("kolom", slug), k.konf.cache_ttl_default, buat)


def _wajib_ada(k: Konteks, slug: str) -> list[dict[str, Any]]:
    cols = _kolom_tampil(k, slug)
    if not cols:
        raise NotFound("Dataset belum tersedia di lakehouse")
    return cols


def kolom(k: Konteks, slug: str) -> list[dict[str, Any]]:
    return _wajib_ada(k, slug)


def _periode(k: Konteks, slug: str) -> dict[str, str] | None:
    t = _tabel_silver(k, slug)
    if not t or "periode_data" not in t[1]:
        return None
    r = queries.periode(k, t[0])
    if not r or not r.get("lo") or not r.get("hi"):
        return None
    return {"min": r["lo"], "max": r["hi"]}


def _jumlah_silver(k: Konteks, slug: str, rq: RowQuery | None = None) -> int:
    t = _tabel_silver(k, slug)
    if not t:
        return 0
    kl = build_clauses(rq or RowQuery(), t[1])
    return queries.hitung(k, t[0], kl.where, kl.params)


def detail(k: Konteks, slug: str) -> tuple[dict[str, Any], int]:
    _wajib_ada(k, slug)

    def buat() -> tuple[dict[str, Any], int]:
        jumlah = _jumlah_silver(k, slug)
        s = queries.sync(k, slug) or {}
        if s:
            try:
                total = int(s["total"])
            except (TypeError, ValueError):
                total = 0
        else:
            total = jumlah
        teks = lambda kol: s.get(kol) or None  # noqa: E731 — `r.x || null` store.sync
        data = {
            "slug": slug,
            "title": s["title"] if s.get("title") is not None else slug,
            "description": s["description"] if s.get("description") is not None else "",
            "sumber_data": _json_array(s.get("sumber_data")),
            "frekuensi": teks("frekuensi"),
            "satuan": teks("satuan"),
            "periode": _periode(k, slug),
            "klasifikasi": teks("klasifikasi"),
            "kontak": teks("kontak"),
            "author": teks("author"),
            "medallion": medallion(k).get(slug),
            "total_bronze": total,
        }
        return data, jumlah

    return k.cache.ambil(("detail", slug), k.konf.cache_ttl_default, buat)


# ── baris ─────────────────────────────────────────────────────────────────────


def baris(k: Konteks, slug: str, hal: Halaman, rq: RowQuery) -> tuple[list[dict[str, Any]], int]:
    _wajib_ada(k, slug)
    t = _tabel_silver(k, slug)
    if not t:
        return [], 0
    kl = build_clauses(rq, t[1])
    rows = queries.baris(k, t[0], kl.where, kl.order_by, kl.params, hal.size, hal.offset)
    return [sq.buang_audit(r) for r in rows], queries.hitung(k, t[0], kl.where, kl.params)


# ── facet ─────────────────────────────────────────────────────────────────────


def facet(k: Konteks, slug: str) -> list[dict[str, Any]]:
    t = _tabel_silver(k, slug)
    if not t:
        return []
    tabel, skema = t

    def buat() -> list[dict[str, Any]]:
        cols = [(c, kind_of(tipe)) for c, tipe in skema.items()]
        rentang = [c for c, kind in cols if kind in ("angka", "tanggal")]
        teks = [c for c, kind in cols if kind == "teks"]
        stats = queries.facet_statistik(k, tabel, rentang, teks, FACET_MAX_VALUES)
        kecil = [c for i, c in enumerate(teks) if (angka_json(stats.get(f"u{i}")) or 0) <= FACET_MAX_VALUES]
        nilai: dict[str, list[dict[str, Any]]] = {c: [] for c in kecil}
        if kecil:
            for r in queries.facet_nilai(k, tabel, kecil):
                nilai[r["k"]].append({"v": r["v"], "n": int(r["n"])})
            for daftar in nilai.values():
                # `b.n - a.n || a.v.localeCompare(b.v, "id")`
                daftar.sort(key=lambda x: (-x["n"], kunci_kolasi(x["v"])))
        hasil = []
        for c, kind in cols:
            if c in rentang:
                i = rentang.index(c)
                hasil.append({"key": c, "kind": kind, "min": stats.get(f"mn{i}"), "max": stats.get(f"mx{i}")})
            elif c in nilai:
                hasil.append({"key": c, "kind": "kategori", "values": nilai[c]})
            else:
                hasil.append({"key": c, "kind": "none"})
        return hasil

    return k.cache.ambil(("facet", slug), k.konf.cache_ttl_default, buat)


# ── agregat ───────────────────────────────────────────────────────────────────


def agregat(k: Konteks, slug: str, rq: RowQuery, x: str, y: str, agg: str) -> list[dict[str, Any]]:
    if not x or agg not in AGGS:
        raise InvalidFilter("Parameter grafik tidak valid")
    t = _tabel_silver(k, slug)
    if not t:
        return []
    tabel, skema = t
    if x not in skema or "`" in x or (agg != "count" and (y not in skema or "`" in y)):
        raise InvalidFilter("Kolom grafik tidak dikenal")
    kl = build_clauses(RowQuery(rq.search, rq.filters, None), skema)
    return [
        {"name": r["name"], "value": angka_json(r["value"])}
        for r in queries.agregat(k, tabel, x, y, agg, kl.where, kl.params)
    ]


# ── ekspor ────────────────────────────────────────────────────────────────────


@dataclass
class Ekspor:
    nama_berkas: str
    media_type: str
    jumlah: int
    isi: Iterator[bytes]


# Sel teks yang diawali karakter ini dibaca Excel/Sheets sebagai formula (CSV/formula injection).
_PEMICU_FORMULA = ("=", "+", "-", "@", "\t", "\r")
_ANGKA = re.compile(r"^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$", re.IGNORECASE)


def _netral(s: str) -> str:
    """Awali `'` pada teks pemicu formula; angka (termasuk Int64 yang dikirim sebagai teks) dibiarkan.

    Satu-satunya pengecualian paritas ekspor: Next.js menulis sel apa adanya.
    """
    return "'" + s if s.startswith(_PEMICU_FORMULA) and not _ANGKA.match(s) else s


def _sel_csv(v: object) -> str:
    s = teks_sel(v)
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        s = _netral(s)
    return '"' + s.replace('"', '""') + '"' if re.search(r'[",\n\r]', s) else s


def _alir_csv(kolom: list[str], rows: Iterator[dict[str, Any]]) -> Iterator[bytes]:
    # BOM UTF-8 agar Excel membaca aksen; baris dipisah CRLF tanpa CRLF penutup (sama dengan Next.js).
    yield ("﻿" + ",".join(_sel_csv(c) for c in kolom)).encode()
    buf = io.StringIO()
    for i, r in enumerate(rows, 1):
        buf.write("\r\n" + ",".join(_sel_csv(r.get(c)) for c in kolom))
        if i % 1000 == 0:
            yield buf.getvalue().encode()
            buf = io.StringIO()
    if buf.tell():
        yield buf.getvalue().encode()


def _nilai_xlsx(v: object) -> object:
    if v is None:
        return ""
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v
    return _netral(ILLEGAL_CHARACTERS_RE.sub("", teks_sel(v)))


def _alir_xlsx(kolom: list[str], rows: Iterator[dict[str, Any]]) -> Iterator[bytes]:
    """openpyxl tidak bisa menulis per halaman ke stream: tulis dulu ke berkas sementara."""
    fd, jalur = tempfile.mkstemp(suffix=".xlsx")
    os.close(fd)
    try:
        wb = Workbook(write_only=True)
        ws = wb.create_sheet("Data")
        ws.append([_nilai_xlsx(c) for c in kolom])
        for r in rows:
            ws.append([_nilai_xlsx(r.get(c)) for c in kolom])
        wb.save(jalur)
        with open(jalur, "rb") as f:
            while blok := f.read(64 * 1024):
                yield blok
    finally:
        os.unlink(jalur)


def ekspor(k: Konteks, slug: str, rq: RowQuery, format_: str) -> Ekspor:
    kolom = [c["key"] for c in _wajib_ada(k, slug)]
    t = _tabel_silver(k, slug)
    kl = build_clauses(rq, t[1]) if t else None
    jumlah = queries.hitung(k, t[0], kl.where, kl.params) if t and kl else 0
    if jumlah > k.konf.export_max_rows:
        raise TooLarge(
            f"Ekspor {jumlah} baris melebihi batas {k.konf.export_max_rows}",
            "Persempit dengan q/f lalu ulangi",
        )
    rows: Iterator[dict[str, Any]] = (
        queries.baris_alir(k, t[0], kl.where, kl.order_by, kl.params, EKSPOR_PER_HALAMAN) if t and kl else iter(())
    )
    dasar = f"{slug}-terfilter" if is_filtered(rq) or rq.sort is not None else slug
    if format_ == "xlsx":
        return Ekspor(
            f"{dasar}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            jumlah,
            _alir_xlsx(kolom, rows),
        )
    return Ekspor(f"{dasar}.csv", "text/csv; charset=utf-8", jumlah, _alir_csv(kolom, rows))
