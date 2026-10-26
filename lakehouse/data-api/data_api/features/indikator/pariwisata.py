"""Halaman `/gci/pariwisata/*` berdata lake — port `app/gci/pariwisata/{wisatawan-internasional,
kuliner-michelin,seni-pertunjukan}/page.tsx`, `components/pariwisata/WismanDashboard.tsx`, dan
`lib/pariwisata/parse.ts` @ 6b858eb.

Bentuk respons mencerminkan halaman (`shell`, `kpis`, `kartu`, `raw`, `komponen`, `tabel`). Kontrak
mengizinkan mempersempit tanpa mengubah nilai: tabel placeholder `RawDataDisclosure` ("Memuat data…",
keadaan muat komponen klien) tidak dikirim.

Angka resmi yang di Next.js ditulis tangan (2.767.622, Michelin 0, skor 156) dibaca dari
`bronze_file.gci_kearney_resmi`; target RPJMD dari `bronze_file.target_wisman`; venue dan kehadiran
artis dari `bronze_file.seni_venue` dan `bronze_file.artis_tampil_jakarta` (dulu dibundel di app).
"""

from __future__ import annotations

import json
import re
from typing import Any

from data_api.shared import lake
from data_api.shared.atlas_gabungan import kunci_kolasi
from data_api.shared.errors import Upstream
from data_api.shared.format import angka_json, id_num, lokal_id, to_fixed
from data_api.shared.konteks import Konteks

from . import queries
from .agg import (
    UNDEFINED,
    Point,
    Row,
    ambil,
    by_period,
    group_count,
    group_sum,
    js_number,
    js_string,
    nullish,
    top_n,
    total,
    truthy,
    urut_label,
    urut_nilai,
)

BULAN = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


class Halaman:
    """Pengumpul satu halaman; dataset yang gagal dibaca menjadi kosong (`safe()` Next.js)."""

    def __init__(self, k: Konteks):
        self.k = k
        self.peringatan: list[str] = []

    def baris(self, slug: str) -> list[Row]:
        try:
            return lake.baris_dataset(self.k, slug)
        except Upstream:
            self.peringatan.append(f"{slug} tidak dapat dibaca; ditampilkan kosong")
            return []

    def resmi(self, indikator: str) -> dict[str, Any] | None:
        rows = queries.bronze(self.k, "gci_kearney_resmi")
        return next((r for r in rows if r["indikator"] == indikator), None)


def _kpi(label: str, value: Any, sub: str | None = None, **delta: Any) -> dict[str, Any]:
    return {"label": label, "value": value, "sub": sub, **delta}


def _kartu(judul: str, sub: str | None, komponen: str, **data: Any) -> dict[str, Any]:
    return {"judul": judul, "sub": sub, "komponen": komponen, "data": data}


def _nilai_resmi(r: dict[str, Any] | None) -> str:
    angka = angka_json(r["nilai"]) if r else None
    return id_num(angka) if angka is not None else (r["nilai"] if r else "—")


# ── lib/pariwisata/parse.ts ───────────────────────────────────────────────────


def title_case(v: Any) -> str:
    return re.sub(r"\b\w", lambda m: m.group().upper(), nullish(v, "").lower(), flags=re.ASCII).strip()


_CATCHALL = {"LAINNYA", "JUMLAH", "TOTAL", "-", "", "PINTU LAINNYA"}


def is_catch_all(v: Any) -> bool:
    return nullish(v, "").strip().upper() in _CATCHALL


def bulan_label(periode: Any) -> str:
    s = re.sub(r"[^0-9]", "", nullish(periode, ""))
    if len(s) >= 6:
        m = int(s[4:6])
        nama = BULAN[m] if 0 <= m < len(BULAN) else s[4:6]
        return f"{nama} '{s[2:4]}"
    try:
        m = int(s)
    except ValueError:
        return s
    return BULAN[m] if 0 <= m < len(BULAN) else s


def wilayah_dari_alamat(addr: Any) -> str:
    a = nullish(addr, "").upper()
    for pola, wil in (
        ("SERIBU", "Kepulauan Seribu"),
        ("JAKARTA SELATAN|SOUTH JAKARTA|JKT SELATAN|JAKSEL", "Jakarta Selatan"),
        ("JAKARTA PUSAT|CENTRAL JAKARTA|JKT PUSAT|JAKPUS", "Jakarta Pusat"),
        ("JAKARTA BARAT|WEST JAKARTA|JKT BARAT|JAKBAR", "Jakarta Barat"),
        ("JAKARTA TIMUR|EAST JAKARTA|JKT TIMUR|JAKTIM", "Jakarta Timur"),
        ("JAKARTA UTARA|NORTH JAKARTA|JKT UTARA|JAKUT", "Jakarta Utara"),
        ("CIBUBUR|CILANGKAP|PONDOK GEDE", "Jakarta Timur"),
    ):
        if re.search(pola, a):
            return wil
    pos = re.search(r"(?:^|[^0-9])(1[0-4][0-9]{3})(?:[^0-9]|$)", a)
    if pos:
        return {
            "10": "Jakarta Pusat",
            "11": "Jakarta Barat",
            "12": "Jakarta Selatan",
            "13": "Jakarta Timur",
            "14": "Jakarta Utara",
        }[pos.group(1)[:2]]
    return "Jakarta (tidak terinci)"


def artis_tampil(korpus: list[str], artis: list[str]) -> set[str]:
    """`playedArtists`: nama artis (≥ 3 huruf) muncul utuh di korpus nama event."""
    besar = [s.upper() for s in korpus]
    hasil = set()
    for nama in artis:
        a = nama.upper().strip()
        if len(a) < 3:
            continue
        pola = re.compile("(^|[^A-Z0-9])" + re.escape(a) + "([^A-Z0-9]|$)")
        if any(pola.search(e) for e in besar):
            hasil.add(nama)
    return hasil


def _sort_js(nilai: list[str]) -> list[str]:
    """`Array.prototype.sort()` tanpa pembanding: urut unit UTF-16."""
    return sorted(nilai, key=lambda s: s.encode("utf-16-be"))


# ── wisatawan internasional ───────────────────────────────────────────────────

SLUG_BULAN = "wisman-jakarta-per-bulan"
SLUG_NEGARA = "wisman-jakarta-per-negara"
SLUG_PINTU = "wisman-jakarta-per-pintu-masuk"


def _tahun_dari(r: Row) -> str:
    """`String(r.tahun ?? String(r.periode_data ?? "").slice(0, 4))`."""
    t = ambil(r, "tahun")
    return js_string(t) if t is not None and t is not UNDEFINED else nullish(ambil(r, "periode_data"), "")[:4]


def _bulan_ke(label: str) -> int:
    s = re.sub(r"[^0-9]", "", label)
    try:
        return int(s[4:6]) if len(s) >= 6 else int(s)
    except ValueError:
        return 0


def _kuartal(bulanan: list[Point]) -> list[Point]:
    q = [0.0, 0.0, 0.0, 0.0]
    for p in bulanan:
        m = _bulan_ke(p["label"])
        if 1 <= m <= 12:
            q[(m - 1) // 3] += p["value"]
    return [{"label": f"Q{i + 1}", "value": v} for i, v in enumerate(q) if v > 0]


def wisatawan_internasional(k: Konteks) -> tuple[dict[str, Any], list[str]]:
    h = Halaman(k)
    bulan, negara, pintu = h.baris(SLUG_BULAN), h.baris(SLUG_NEGARA), h.baris(SLUG_PINTU)
    years = _sort_js(list(dict.fromkeys(y for y in map(_tahun_dari, bulan) if y)))
    by_year: dict[str, dict[str, Any]] = {}
    for y in years:
        b_rows = [r for r in bulan if _tahun_dari(r) == y]
        monthly = by_period(b_rows, "periode_data", "jumlah_kunjungan")
        tot = total(monthly)
        peak = None
        for p in monthly:
            if peak is None or p["value"] > peak["value"]:
                peak = p
        n_rows = [
            r for r in negara if nullish(ambil(r, "periode_data"), "")[:4] == y and not is_catch_all(ambil(r, "negara"))
        ]
        ranked = urut_nilai(group_sum(n_rows, "negara", "jumlah_kunjungan"))
        donut_top = ranked[:8]
        lainnya = max(0.0, total(ranked) - total(donut_top))
        by_year[y] = {
            "total": tot,
            "monthly": monthly,
            "quarterly": _kuartal(monthly),
            "topNegara": ranked[:5],
            "donutNegara": [*donut_top, {"label": "Lainnya", "value": lainnya}] if lainnya > 0 else donut_top,
            "peakMonth": peak,
            "partial": len(b_rows) < 12,
        }
    yearly = [{"label": y, "value": by_year[y]["total"]} for y in years]
    default_year = "2025" if "2025" in years else (years[-1] if years else "")
    resmi = h.resmi("Wisatawan Internasional")
    shell = {
        "eyebrow": "Cultural Experience · Wisatawan Internasional",
        "title": "Wisatawan Internasional",
        "nilai": _nilai_resmi(resmi),
        "satuan": "Wisatawan",
        "tahun": resmi["tahun"] if resmi else "2025",
        "catatan": "Angka resmi 2.767.622 (BPS 2025). Data bulanan Dispar mencatat 2.754.220 untuk 2025 — selaras. "
        "Pilih tahun untuk melihat detail; tren lintas-tahun ada di bawah.",
        "sumber": "jakarta.bps.go.id",
        "sumberHref": "https://jakarta.bps.go.id",
    }
    kpis, kartu = _wisman_dashboard(k, years, by_year, yearly, default_year)
    data = {
        "shell": shell,
        "kpis": kpis,
        "kartu": kartu,
        "raw": [
            {"slug": SLUG_BULAN, "title": "Wisman per bulan (2024–2026)", "count": len(bulan)},
            {"slug": SLUG_NEGARA, "title": "Wisman per negara (s/d 2026)", "count": len(negara)},
            {"slug": SLUG_PINTU, "title": "Wisman per pintu masuk (arsip 2010/2014, nasional)", "count": len(pintu)},
        ],
        "komponen": {
            "WismanDashboard": {"years": years, "byYear": by_year, "yearlyTotals": yearly, "defaultYear": default_year}
        },
        "tabel": [],
    }
    return data, h.peringatan


def _wisman_dashboard(
    k: Konteks, years: list[str], by_year: dict[str, dict[str, Any]], yearly: list[Point], year: str
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """KPI dan kartu `WismanDashboard` pada tahun bawaan."""
    active = year if year in by_year else (years[0] if years else None)
    d = by_year.get(active) if active else None
    if not years or not d:
        return [], []
    idx = years.index(active)
    prev = by_year[years[idx - 1]] if idx > 0 else None
    yoy = (d["total"] - prev["total"]) / prev["total"] * 100 if prev and prev["total"] else None
    top, peak = d["topNegara"], d["peakMonth"]
    kpis = [
        _kpi(f"Total wisman {year}", d["total"], "akumulasi bulanan"),
        _kpi(
            "Negara asal terbanyak",
            top[0]["label"] if top else "—",
            f"{lokal_id(top[0]['value'])} kunjungan" if top else None,
        ),
        _kpi(
            "Puncak bulan",
            bulan_label(peak["label"]) if peak else "—",
            f"{lokal_id(peak['value'])} kunjungan" if peak else None,
        ),
        _kpi(
            "Pertumbuhan tahunan",
            f"{to_fixed(yoy, 1)}%" if yoy is not None else "—",
            f"vs {years[idx - 1]}" if prev else "—",
            delta=yoy,
        ),
    ]
    seri_kuartal = [
        {"name": f"{y} •" if by_year[y]["partial"] else y, "data": by_year[y]["quarterly"]}
        for y in years
        if by_year[y]["quarterly"]
    ]
    kat_kuartal = [q for q in ("Q1", "Q2", "Q3", "Q4") if any(p["label"] == q for s in seri_kuartal for p in s["data"])]
    target = {r["tahun"]: angka_json(r["target_wisman"]) for r in queries.bronze(k, "target_wisman")}
    cmp_years = _sort_js(list(dict.fromkeys([*years, *target])))
    kartu = [
        _kartu(f"Tren bulanan {year}", "kunjungan per bulan (batang)", "VerticalBars", data=d["monthly"]),
        _kartu(f"Top 5 negara asal {year}", "kunjungan per negara", "BarBreakdown", data=top),
        _kartu(f"Peta komposisi negara {year}", "treemap · proporsi & detail", "Treemap", data=d["donutNegara"]),
        _kartu(f"Komposisi negara {year}", "top 8 + lainnya (donut)", "Donut", data=d["donutNegara"]),
    ]
    if seri_kuartal and kat_kuartal:
        tanda = " · tahun berjalan ditandai •" if any("•" in s["name"] for s in seri_kuartal) else ""
        kartu.append(
            _kartu(
                "Perbandingan kuartal antar tahun",
                f"Q1–Q4 dibandingkan lintas tahun{tanda}",
                "GroupedBars",
                series=seri_kuartal,
                categories=kat_kuartal,
            )
        )
    tanda = " · tahun berjalan ditandai •" if any(by_year.get(y["label"], {}).get("partial") for y in yearly) else ""
    kartu.append(
        _kartu(
            "Tren wisman per tahun",
            f"total kunjungan tahunan{tanda}",
            "BarBreakdown",
            data=[
                {"label": f"{y['label']} •" if by_year[y["label"]]["partial"] else y["label"], "value": y["value"]}
                for y in yearly
            ],
        )
    )
    kartu.append(
        _kartu(
            "Target vs Realisasi Wisman (RPJMD 2025–2029)",
            "Batang berdampingan: realisasi (asli) vs target Jumlah Tamu Mancanegara",
            "GroupedBars",
            categories=cmp_years,
            series=[
                {
                    "name": "Realisasi (asli)",
                    "data": [{"label": y, "value": by_year[y]["total"]} for y in cmp_years if y in by_year],
                },
                {
                    "name": "Target (RPJMD)",
                    "data": [{"label": y, "value": target[y]} for y in cmp_years if target.get(y) is not None],
                },
            ],
        )
    )
    return kpis, kartu


# ── kuliner michelin ──────────────────────────────────────────────────────────

SLUG_KEL = "jumlah-restoran-per-kelurahan"
SLUG_USAHA = "data-usaha-jasa-makanan-dan-minuman-jenis-usaha-restoran-di-dki-jakarta"
SLUG_TRIPADVISOR = "restoran-tripadvisor-jakarta"


def kuliner_michelin(k: Konteks) -> tuple[dict[str, Any], list[str]]:
    h = Halaman(k)
    per_kel_all, usaha, tripadvisor = h.baris(SLUG_KEL), h.baris(SLUG_USAHA), h.baris(SLUG_TRIPADVISOR)
    tahun = _sort_js([t for t in (nullish(ambil(r, "periode_data"), "")[:4] for r in per_kel_all) if t])
    latest = tahun[-1] if tahun else None
    per_kel = [r for r in per_kel_all if nullish(ambil(r, "periode_data"), "")[:4] == latest]
    per_wilayah = urut_nilai(
        group_sum(
            [
                {
                    "wil": re.sub(r"Kota Adm\.?\s*", "", title_case(ambil(r, "wilayah")), count=1, flags=re.IGNORECASE),
                    "jumlah": ambil(r, "jumlah"),
                }
                for r in per_kel
            ],
            "wil",
            "jumlah",
        )
    )
    top_kec = top_n(
        group_sum(
            [{"kec": title_case(ambil(r, "kecamatan")), "jumlah": ambil(r, "jumlah")} for r in per_kel], "kec", "jumlah"
        ),
        10,
    )
    kelurahan = {js_string(ambil(r, "kelurahan")) for r in per_kel if truthy(ambil(r, "kelurahan"))}
    resmi = h.resmi("Penawaran Kuliner (Michelin)")
    nilai = _nilai_resmi(resmi)
    tahun_resmi = resmi["tahun"] if resmi else "2025"
    data = {
        "shell": {
            "eyebrow": "Cultural Experience · Penawaran Kuliner",
            "title": "Penawaran Kuliner (Michelin)",
            "nilai": nilai,
            "satuan": "Restoran Michelin",
            "tahun": tahun_resmi,
            "catatan": "Belum ada Michelin Star di Jakarta (2025); Panduan Michelin belum masuk Indonesia. "
            "Data pendukung menunjukkan sebaran restoran per kelurahan.",
            "sumber": "Michelin Guide",
            "sumberHref": "https://guide.michelin.com",
        },
        "kpis": [
            _kpi("Restoran Michelin", nilai, f"Michelin Guide · {tahun_resmi}"),
            _kpi(f"Restoran terdata ({latest or '—'})", total(per_wilayah), "sebaran per kelurahan"),
            _kpi("Kelurahan tercakup", len(kelurahan)),
            _kpi("Wilayah terpadat", per_wilayah[0]["label"] if per_wilayah else "—"),
        ],
        "kartu": [
            _kartu("Restoran per wilayah", latest, "BarBreakdown", data=per_wilayah),
            _kartu("Top 10 kecamatan", latest, "BarBreakdown", data=top_kec),
            _kartu("Share per wilayah", latest, "Donut", data=per_wilayah),
        ],
        "raw": [
            {"slug": SLUG_KEL, "title": f"Jumlah restoran per kelurahan ({latest or ''})", "count": len(per_kel_all)},
            {"slug": SLUG_USAHA, "title": "Daftar usaha restoran (arsip 2014)", "count": len(usaha)},
            {
                "slug": SLUG_TRIPADVISOR,
                "title": "Kuliner TripAdvisor Jakarta (kriteria Kearney: TripAdvisor & Michelin)",
                "count": len(tripadvisor),
            },
        ],
        "komponen": {},
        "tabel": [],
    }
    return data, h.peringatan


# ── seni pertunjukan ──────────────────────────────────────────────────────────

PENDUKUNG = [
    ("data-penyelenggaraan-event-pariwisata-dan-budaya-dki-jakarta", "kegiatan"),
    ("data-event-pariwisata-dan-kebudayaan-dki-jakarta-2011-2019", "nama_event"),
    ("data-rekomendasi-penyelenggaraan-pertunjukan-musik", "nama_kegiatan"),
]
CHARTS = ["Billboard Year-End Top Artists", "Spotify Global Year-End"]


def _venue(r: dict[str, Any]) -> dict[str, Any]:
    """Baris `bronze_file.seni_venue` → objek `seni-venues.json` (kunci camelCase, tipe asli)."""
    nama = {"eventcount": "eventCount"}
    hasil: dict[str, Any] = {}
    for kol, v in r.items():
        if v is None:
            continue
        kunci = nama.get(kol, kol)
        if kunci in ("events", "artists"):
            v = json.loads(v)
        elif kunci in ("lat", "lon"):
            v = float(v)
        elif kunci == "eventCount":
            v = int(v)
        elif kunci == "gold":
            v = v == "True"
        hasil[kunci] = v
    return hasil


def _kehadiran(k: Konteks) -> dict[str, dict[str, Any]]:
    """`JAKARTA_APPEARANCES` dari `bronze_file.artis_tampil_jakarta` (kunci nama UPPERCASE)."""
    return {
        r["artist"].upper().strip(): {"years": json.loads(r["years"]), "venue": r["venue"], "source": r["source"]}
        for r in queries.bronze(k, "artis_tampil_jakarta")
    }


def seni_pertunjukan(k: Konteks, tahun_param: str | None) -> tuple[dict[str, Any], list[str]]:
    h = Halaman(k)
    artis = h.baris("artis-top-global-chart")
    seni_all = h.baris("data-seni-pertunjukan-dan-visual")
    pendukung = [h.baris(slug) for slug, _ in PENDUKUNG]
    penyel_all = h.baris("jumlah-penyelenggaraan-event")

    opsi = _sort_js(
        list(
            dict.fromkeys(
                t for t in (nullish(ambil(r, "periode_data"), "").strip() for r in [*seni_all, *penyel_all]) if t
            )
        )
    )
    tahun = tahun_param if tahun_param and tahun_param in opsi else ""

    def in_tahun(v: Any) -> bool:
        return not tahun or nullish(v, "").strip() == tahun

    seni = [r for r in seni_all if in_tahun(ambil(r, "periode_data"))]
    penyel = [r for r in penyel_all if in_tahun(ambil(r, "periode_data"))]

    event_bulanan = by_period(
        [
            {
                "periode": js_string(ambil(r, "periode_data"))
                + nullish(ambil(r, "bulan_penyelenggaraan"), "").rjust(2, "0"),
                "jumlah_event": ambil(r, "jumlah_event"),
            }
            for r in penyel
        ],
        "periode",
        "jumlah_event",
    )
    event_per_tahun = urut_label(group_sum(penyel, "periode_data", "jumlah_event"))
    tahun_data = [r["label"] for r in event_per_tahun if r["label"]]
    if tahun:
        periode_event = tahun
    elif len(tahun_data) > 1:
        periode_event = f"{tahun_data[0]}–{tahun_data[-1]}"
    else:
        periode_event = tahun_data[0] if tahun_data else "semua tahun"
    top_venue = top_n(group_count(seni, "nama_venue"), 10)
    per_wilayah = urut_nilai(group_count([{"wil": wilayah_dari_alamat(ambil(r, "lokasi_venue"))} for r in seni], "wil"))
    event_total = 0.0
    for r in penyel:
        n = js_number(ambil(r, "jumlah_event"))
        event_total += n if n == n else 0.0  # `Number(x) || 0` (NaN → 0)
    venue_unik = len({js_string(ambil(r, "nama_venue")) for r in seni if truthy(ambil(r, "nama_venue"))})

    korpus = [
        s
        for s in (
            nullish(v, "")
            for v in [
                *(ambil(r, "nama_event") for r in seni_all),
                *(ambil(r, "nama_event") for r in pendukung[1]),
                *(ambil(r, "kegiatan") for r in pendukung[0]),
                *(ambil(r, "nama_kegiatan") for r in pendukung[2]),
            ]
        )
        if s
    ]
    meta_artis: dict[str, Any] = {}
    for r in artis:
        a = nullish(ambil(r, "artis"), "").strip()
        if a and a not in meta_artis:
            meta_artis[a] = ambil(r, "negara_asal")
    daftar = _sort_js(list(meta_artis))
    kehadiran = _kehadiran(k)
    sdi = artis_tampil(korpus, daftar)

    def ap(a: str) -> dict[str, Any] | None:
        return kehadiran.get(a.upper().strip())

    def tampil(a: str) -> bool:
        return ap(a) is not None or a in sdi

    top_global = sum(1 for r in seni if artis_tampil([nullish(ambil(r, "nama_event"), "")], daftar))
    persen = top_global / len(seni) * 100 if seni else None
    years = _sort_js(list(dict.fromkeys(y for y in (nullish(ambil(r, "tahun"), "") for r in artis) if y)))
    by_chart: dict[str, dict[str, dict[float, Row]]] = {}
    for r in artis:
        chart, year = nullish(ambil(r, "chart"), ""), nullish(ambil(r, "tahun"), "")
        rank = js_number(ambil(r, "peringkat"))
        if not chart or not year or rank != rank or rank in (float("inf"), float("-inf")):
            continue
        by_chart.setdefault(chart, {}).setdefault(year, {})[rank] = r

    resmi = h.resmi("Seni Visual & Pertunjukan")
    skor = _nilai_resmi(resmi)
    tahun_skor = resmi["tahun"] if resmi else "2024"
    kpis = [
        _kpi("Jumlah pertunjukan", len(seni), tahun or "semua tahun"),
        _kpi("Memenuhi kriteria top global", top_global, "menampilkan artis Top 10 Global Chart"),
        _kpi(
            "Persentase top global",
            "NA" if persen is None else f"{lokal_id(persen, 0, 1)}%",
            "top global / total pertunjukan",
        ),
        _kpi(
            "Skor Kearney (resmi)",
            skor if not tahun or tahun == tahun_skor else "NA",
            f"angka resmi Kearney {tahun_skor}, bukan hitungan data SDI",
        ),
        _kpi("Venue unik", venue_unik),
        _kpi("Penyelenggaraan event", event_total if penyel else "NA", tahun or "semua tahun"),
    ]
    kartu = [
        _kartu(
            "Penyelenggaraan event / bulan",
            f"semua event pariwisata & budaya · {periode_event}",
            "LineTrend",
            data=event_bulanan,
        ),
        _kartu("Top 10 venue tersibuk", None, "BarBreakdown", data=top_venue),
        _kartu("Event per wilayah Jakarta", "klasifikasi alamat → wilayah (lengkap)", "Donut", data=per_wilayah),
    ]
    venues = []
    for v in (_venue(r) for r in queries.bronze(k, "seni_venue")):
        events = [e for e in v.get("events", []) if in_tahun(e.get("periode"))]
        if events:
            venues.append({**v, "events": events, "eventCount": len(events)})

    tabel = []
    if artis:
        # Tahun tampil terakhir menurun, lalu nama (`localeCompare`).
        tampil_list = sorted((a for a in daftar if tampil(a)), key=kunci_kolasi)
        tampil_list.sort(key=lambda a: -(max(ap(a)["years"]) if ap(a) else 0))
        if tampil_list:
            tabel.append(
                {
                    "header": ["Artis", "Negara", "Tahun tampil", "Venue", "Sumber"],
                    "rows": [
                        [
                            a,
                            nullish(meta_artis.get(a), "—"),
                            ", ".join(str(y) for y in ap(a)["years"]) if ap(a) else "—",
                            (ap(a) or {}).get("venue") or "—",
                            "Verifikasi ↗" if ap(a) else "Data event Dispar",
                        ]
                        for a in tampil_list
                    ],
                }
            )
        for c in CHARTS:
            if c not in by_chart:
                continue
            per_tahun = by_chart[c]
            rows = []
            for rank in range(1, 11):
                sel = [str(rank)]
                for y in years:
                    r = per_tahun.get(y, {}).get(float(rank))
                    if r is None:
                        sel.append("—")
                        continue
                    teks = [js_string(ambil(r, "artis"))]
                    if tampil(js_string(ambil(r, "artis"))):
                        teks.append("✓")
                    if truthy(ambil(r, "negara_asal")):
                        teks.append(f"· {js_string(ambil(r, 'negara_asal'))}")
                    sel.append(" ".join(t for t in teks if t))
                rows.append(sel)
            tabel.append({"header": ["#", *years], "rows": rows})

    data = {
        "shell": {
            "eyebrow": "Cultural Experience · Seni Visual & Pertunjukan",
            "title": "Seni Visual & Pertunjukan",
            "nilai": lokal_id(len(seni)),
            "satuan": "Pertunjukan",
            "catatan": "Berdasarkan data Dinas Pariwisata DKI Jakarta",
            "sumber": "Satu Data Jakarta, Calendar of Event",
            "sumberHref": "https://satudata.jakarta.go.id/open-data/data-seni-pertunjukan-dan-visual",
        },
        "kpis": kpis,
        "kartu": kartu,
        "raw": [
            {"slug": "data-seni-pertunjukan-dan-visual", "title": "Seni Visual & Pertunjukan", "count": len(seni_all)}
        ],
        "komponen": {"VenueMapClient": {"venues": venues}, "TahunFilter": {"years": opsi, "value": tahun}},
        "tabel": tabel,
    }
    return data, h.peringatan
