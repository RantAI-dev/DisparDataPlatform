"""Isi halaman detail indikator — port 19 view `platform-v2/components/indicators/*.tsx` @ 6b858eb.

Setiap view menghasilkan `sources`, `kpis` (props `KpiStat`), dan `blocks` (judul `Block`, jenis
grafik, data grafik, lebar). Dikelompokkan per arketipe C §2.4; label dan judul per kode sama persis
dengan Next.js. Teks `MomNote` tetap konstanta layer Nuxt (KONTRAK §2.3 catatan 3).
"""

from __future__ import annotations

import math
import re
from collections.abc import Callable
from typing import Any

from data_api.shared.atlas_gabungan import kunci_kolasi
from data_api.shared.format import js_round

from .agg import (
    Point,
    Row,
    ambil,
    by_period,
    distinct,
    group_count,
    group_sum,
    id_num,
    js_number,
    nullish,
    to_fixed,
    top_n,
    total,
    truthy,
    urut_nilai,
)
from .pemilihan import Data, Pemuat, pick_data, primary_data

Halaman = dict[str, Any]


def kpi(label: str, value: Any, sub: str | None = None) -> dict[str, Any]:
    return {"label": label, "value": value, "sub": sub}


def blok(jenis: str, judul: str, data: Any, setengah: bool = False) -> dict[str, Any]:
    return {"type": jenis, "title": judul, "layout": "half" if setengah else "full", "data": data}


def _sumber(*data: Data | None) -> list[Data]:
    return [d for d in data if d is not None]


def _hasil(sumber: list[Data], kpis: list[dict[str, Any]], blocks: list[dict[str, Any]]) -> Halaman:
    return {"sumber": sumber, "kpis": kpis, "blocks": blocks}


# ── B: tren + lokasi (CE1, CI-FV) ─────────────────────────────────────────────


def _tren_lokasi(p: Pemuat, code: str) -> Halaman:
    d = pick_data(p, code, ["lokasi", "jumlah"])
    rows = d.rows if d else []
    trend = by_period(rows, "periode_data", "jumlah")
    per_lokasi = urut_nilai(group_sum(rows, "lokasi", "jumlah"))
    nd = pick_data(p, code, ["kebangsaan", "jumlah_kunjungan"])
    per_negara = top_n(group_sum(nd.rows if nd else [], "kebangsaan", "jumlah_kunjungan"), 12)
    blocks = []
    if len(trend) >= 2:
        blocks.append(blok("line", "Tren kunjungan per periode", trend))
    blocks.append(blok("bar", "Per lokasi TIC", per_lokasi))
    if per_negara:
        blocks.append(blok("ranked", "Top negara asal", per_negara))
    kpis = [
        kpi("Total kunjungan", total(trend)),
        kpi("Lokasi TIC", len(per_lokasi)),
        kpi("Periode terdata", len(trend)),
    ]
    return _hasil(_sumber(d, nd), kpis, blocks)


# ── C: breakdown wilayah (CE2, CI-DI, CI-CX) ──────────────────────────────────


def _wilayah(label_total: str) -> Callable[[Pemuat, str], Halaman]:
    def view(p: Pemuat, code: str) -> Halaman:
        d = pick_data(p, code, ["wilayah", "jumlah"])
        rows = d.rows if d else []
        per_wilayah = urut_nilai(group_sum(rows, "wilayah", "jumlah"))
        per_kecamatan = top_n(group_sum(rows, "kecamatan", "jumlah"), 12)
        kpis = [
            kpi(label_total, total(per_wilayah)),
            kpi("Wilayah", len(per_wilayah)),
            kpi("Kecamatan terdata", distinct(rows, "kecamatan")),
        ]
        blocks = [
            blok("bar", "Sebaran per wilayah (kota)", per_wilayah),
            blok("ranked", "Top kecamatan", per_kecamatan),
        ]
        return _hasil(_sumber(d), kpis, blocks)

    return view


# ── E: daftar event (CE3, CI-CE, CI-AM, CI-TH) ────────────────────────────────


def _event(
    pilih: Callable[[Pemuat, str], Data | None], kata: str, label_total: str
) -> Callable[[Pemuat, str], Halaman]:
    """`kata` = "event" atau "pertunjukan" (CI-TH); judul tabel ikut kata itu."""

    def view(p: Pemuat, code: str) -> Halaman:
        d = pilih(p, code)
        rows = d.rows if d else []
        trend = by_period(rows, "periode_data")
        top_venue = urut_nilai(group_count(rows, "nama_venue"))[:12]
        terbaru = sorted(
            (r for r in rows if truthy(ambil(r, "nama_event"))),
            key=lambda r: kunci_kolasi(nullish(ambil(r, "periode_data"), "")),
            reverse=True,
        )[:20]
        tabel = {
            "header": ["Tanggal", "Event", "Venue"],
            "rows": [[nullish(ambil(r, k), "—") for k in ("periode_data", "nama_event", "nama_venue")] for r in terbaru]
            or [["Tidak ada baris event."]],
        }
        blocks = []
        if len(trend) >= 2:
            blocks.append(blok("line", f"Tren jumlah {kata} per periode", trend))
        blocks.append(blok("ranked", f"Top venue (jumlah {kata})", top_venue))
        blocks.append(blok("table_events", "Event terbaru" if kata == "event" else "Pertunjukan terbaru", tabel))
        kpis = [
            kpi(label_total, len(rows)),
            kpi("Venue unik", distinct(rows, "nama_venue")),
            kpi("Periode", len(trend)),
        ]
        return _hasil(_sumber(d), kpis, blocks)

    return view


# ── A: peta titik (CE4, CI-TA, CI-WH, CI-MU) ──────────────────────────────────


def _peta(
    pilih: Callable[[Pemuat, str], Data | None],
    pola: str | None,
    label_obyek: str,
    judul_peta: str,
    judul_top: str = "Top 15 obyek (kunjungan)",
) -> Callable[[Pemuat, str], Halaman]:
    def view(p: Pemuat, code: str) -> Halaman:
        d = pilih(p, code)
        rows = d.rows if d else []
        f = [r for r in rows if re.search(pola, nullish(ambil(r, "obyek_wisata"), ""), re.IGNORECASE)] if pola else rows
        by_obyek = top_n(group_sum(f, "obyek_wisata", "jumlah_kunjungan"), 15)
        trend = by_period(f, "periode_data", "jumlah_kunjungan")
        # SWAP lat/lng ditiru: kolom longitude/latitude di dataset sumber memang tertukar.
        points = []
        for r in f:
            lat, lng = js_number(ambil(r, "longitude")), js_number(ambil(r, "latitude"))
            if math.isfinite(lat) and math.isfinite(lng):
                points.append(
                    {
                        "lat": lat,
                        "lng": lng,
                        "label": nullish(ambil(r, "obyek_wisata"), ""),
                        "value": id_num(ambil(r, "jumlah_kunjungan")) or 0,
                    }
                )
        wisman = group_sum(f, "jenis_wisatawan", "jumlah_kunjungan")
        blocks = [
            blok("map_points", judul_peta, points),
            blok("ranked", judul_top, by_obyek, setengah=True),
            blok("donut", "Komposisi wisman / wisnus", wisman, setengah=True),
        ]
        if len(trend) >= 2:
            blocks.append(blok("line", "Tren kunjungan per periode", trend))
        kpis = [
            kpi("Total kunjungan", total(by_obyek)),
            kpi(label_obyek, len(by_obyek)),
            kpi("Titik terpetakan", len(points)),
        ]
        return _hasil(_sumber(d), kpis, blocks)

    return view


# ── D: registri usaha (BA-MICE, CI-IC, CI-HR, CI-NL) ──────────────────────────


def _registri(label_total: str, judul_jenis: str) -> Callable[[Pemuat, str], Halaman]:
    def view(p: Pemuat, code: str) -> Halaman:
        d = primary_data(p, code)
        rows = d.rows if d else []
        per_jenis = top_n(group_count(rows, "uraian_kbli"), 10)
        per_skala = urut_nilai(group_count(rows, "skala_usaha"))
        per_kota = urut_nilai(group_count(rows, "kabupaten_atau_kota"))
        kpis = [
            kpi(label_total, len(rows)),
            kpi("Jenis (KBLI)", distinct(rows, "uraian_kbli")),
            kpi("Kota/Kab", len(per_kota)),
        ]
        blocks = [
            blok("bar", judul_jenis, per_jenis),
            blok("bar", "Per skala usaha", per_skala, setengah=True),
            blok("bar", "Per kota/kabupaten", per_kota, setengah=True),
        ]
        return _hasil(_sumber(d), kpis, blocks)

    return view


# ── F: okupansi (CI-LH) ───────────────────────────────────────────────────────


def _okupansi(p: Pemuat, code: str) -> Halaman:
    d = pick_data(p, code, ["jenis_hotel", "rata_rata"])
    rows = d.rows if d else []
    per_hotel: dict[str, list[Row]] = {}
    for r in rows:
        per_hotel.setdefault(nullish(ambil(r, "jenis_hotel"), "—"), []).append(r)
    series = [
        {
            "name": nama,
            "data": [
                {"label": pt["label"], "value": id_num(pt["value"]) or 0}
                for pt in by_period(rs, "periode_data", "rata_rata")
            ],
        }
        for nama, rs in per_hotel.items()
    ]
    bintang5 = sorted(
        (r for r in rows if re.search(r"5\s*[★*]?|bintang\s*5", nullish(ambil(r, "jenis_hotel"), ""), re.IGNORECASE)),
        key=lambda r: kunci_kolasi(nullish(ambil(r, "periode_data"), "")),
        reverse=True,
    )
    s5 = bintang5[0] if bintang5 else None
    latest5 = id_num(ambil(s5, "rata_rata")) if s5 else None
    kpis = [
        kpi("Jenis hotel", len(per_hotel)),
        kpi("Baris data", len(rows)),
        kpi(
            "Okupansi bintang 5 (terbaru)",
            "—" if latest5 is None else f"{to_fixed(latest5, 2)}%",
            nullish(ambil(s5, "periode_data"), "") if s5 else None,
        ),
    ]
    return _hasil(
        _sumber(d), kpis, [blok("grouped_lines", "Okupansi per jenis hotel (% rata-rata)", {"series": series})]
    )


# ── G: survei pengeluaran (CI-SH) ─────────────────────────────────────────────


def _survei(p: Pemuat, code: str) -> Halaman:
    d = pick_data(p, code, ["asal_negara", "rata_rata"])
    rows = d.rows if d else []
    per_negara: list[Point] = urut_nilai(group_sum(rows, "asal_negara", "rata_rata"))[:15]
    wisman = group_sum(rows, "jenis_wisatawan", "rata_rata")
    kpis = [
        kpi("Total responden", total(group_sum(rows, "asal_negara", "jumlah_responden"))),
        kpi("Negara asal", len(per_negara)),
        # D6 ditiru: "rata-rata keseluruhan" = jumlah rata-rata per negara.
        kpi("Rata-rata keseluruhan", js_round(total(per_negara))),
    ]
    blocks = [blok("bar", "Rata-rata pengeluaran per negara asal", per_negara)]
    if wisman:
        blocks.append(blok("donut", "Komposisi wisman / wisnus", wisman))
    return _hasil(_sumber(d), kpis, blocks)


def _pilih(*kolom: str) -> Callable[[Pemuat, str], Data | None]:
    return lambda p, code: pick_data(p, code, list(kolom))


VIEW: dict[str, Callable[[Pemuat, str], Halaman]] = {
    "CE1": _tren_lokasi,
    "CI-FV": _tren_lokasi,
    "CE2": _wilayah("Total restoran"),
    "CI-DI": _wilayah("Total usaha kuliner"),
    "CI-CX": _wilayah("Total usaha ekraf"),
    "CE3": _event(primary_data, "event", "Total event"),
    "CI-CE": _event(_pilih("nama_venue"), "event", "Total event"),
    "CI-AM": _event(primary_data, "event", "Total event"),
    "CI-TH": _event(primary_data, "pertunjukan", "Total pertunjukan"),
    "CE4": _peta(primary_data, "museum|monumen", "Obyek wisata", "Sebaran titik obyek wisata"),
    "CI-TA": _peta(_pilih("obyek_wisata", "jumlah_kunjungan"), None, "Obyek wisata", "Sebaran titik obyek wisata"),
    "CI-WH": _peta(
        primary_data, "kota tua|heritage|fatahillah|onrust", "Obyek heritage", "Sebaran titik obyek heritage"
    ),
    "CI-MU": _peta(primary_data, "museum", "Museum", "Sebaran titik museum", "Top 15 museum (kunjungan)"),
    "BA-MICE": _registri("Total usaha MICE", "Per jenis usaha MICE (KBLI)"),
    "CI-IC": _registri("Total usaha", "Per jenis usaha (KBLI)"),
    "CI-HR": _registri("Total usaha akomodasi", "Per jenis akomodasi (KBLI)"),
    "CI-NL": _registri("Total usaha hiburan", "Per jenis usaha (KBLI)"),
    "CI-LH": _okupansi,
    "CI-SH": _survei,
}
