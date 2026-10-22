"""Indikator GCI/GPCI (plan 04) dengan data palsu (`tests/palsu_indikator.py`).

Defect D1–D10 ditiru dan dituliskan eksplisit (C §2.6); perbaikannya keputusan pemilik terpisah.
"""

import json
from pathlib import Path

import pytest

from data_api.features.indikator import agg
from data_api.features.indikator.pemilihan import Pemuat, compute_readiness, latest_value, pick_data
from data_api.shared import indikator_sumber
from data_api.shared.konteks import Konteks

AKAR = Path(__file__).resolve().parents[5]


def data(klien, path, **params):
    r = klien.get(path, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def pemuat(klien) -> Pemuat:
    s = klien.app.state
    return Pemuat(Konteks(s.ch, s.cache, s.konf, "t"))


# ── pemilihan dataset ─────────────────────────────────────────────────────────


def test_pick_data_kolom_wajib_lalu_periode_lalu_total(klien, indikator):
    p = pemuat(klien)
    # CE1: dua kandidat; hanya `tic` yang punya lokasi+jumlah.
    assert pick_data(p, "CE1", ["lokasi", "jumlah"]).slug == "tic"
    assert pick_data(p, "CE1", ["kebangsaan", "jumlah_kunjungan"]).slug == "kebangsaan"
    # seri periode maks → total terbesar menang
    indikator["baris"]["kebangsaan"] = [{"periode_data": "2025-02-01", "lokasi": "x", "jumlah": 1}]
    indikator["kolom"]["kebangsaan"] = ["lokasi", "jumlah"]
    indikator["total"]["kebangsaan"] = 9
    assert pick_data(Pemuat(p.k), "CE1", ["lokasi", "jumlah"]).slug == "kebangsaan"


def test_pick_data_tanpa_kolom_wajib_jatuh_ke_terbesar(klien, indikator):
    d = pick_data(pemuat(klien), "CE3", ["nama_event", "kolom_tidak_ada"])
    assert d.slug == "musik-besar"


def test_compute_readiness_tiga_status_dan_batas_draft(klien, indikator):
    rows = {r["code"]: r for r in compute_readiness(pemuat(klien))}
    assert rows["CE1"]["status"] == "ready"
    assert rows["CE4"]["status"] == "partial"  # ready dihitung, dibatasi draft partial
    assert rows["CE5"]["status"] == "gap"  # match kosong
    assert rows["AC-AP"]["status"] == "gap"  # kata kunci tak cocok judul mana pun
    indikator["total"]["mice"] = 0
    assert {r["code"]: r for r in compute_readiness(pemuat(klien))}["BA-MICE"]["status"] == "partial"
    assert [d["slug"] for d in rows["CI-SH"]["datasets"]] == ["pengeluaran"]  # total 0 dibuang


def test_latest_value_sampah_d9(klien, indikator):
    """D9: tanpa kolom periode di dataset_column, label = kolom pertama, urut teks menurun."""
    r = latest_value(pemuat(klien), "mice", None)
    assert r is None  # tak ada kolom numerik
    hasil = latest_value(pemuat(klien), "obyek", None)
    assert hasil == {"label": "TAMAN MINI", "value": 999, "datasetSlug": "obyek"}


# ── daftar ────────────────────────────────────────────────────────────────────


def test_daftar_gci_dan_gpci_urut_nomor_resmi(klien, indikator):
    gci = data(klien, "/v1/indikator", framework="GCI")["data"]
    assert gci["summary"] == [
        {"label": "TOTAL INDIKATOR", "value": "5"},
        {"label": "DATA ADA", "value": "4"},
        {"label": "READY", "value": "3"},
        {"label": "PARTIAL", "value": "1"},
        {"label": "GAP", "value": "1"},
    ]
    assert [r["code"] for r in gci["rows"]] == ["CE1", "CE2", "CE3", "CE4", "CE5"]
    assert gci["gaps"] == ["CE4", "CE5"]
    gpci = data(klien, "/v1/indikator", framework="GPCI")["data"]
    # nomor resmi 33, 34, 65, lalu tanpa nomor (999)
    assert [(r["no"], r["code"]) for r in gpci["rows"]] == [
        (33, "CI-LH"),
        (34, "CI-SH"),
        (65, "AC-AP"),
        (None, "BA-MICE"),
    ]
    assert klien.get("/v1/indikator", params={"framework": "X"}).status_code == 400


# ── detail per arketipe ───────────────────────────────────────────────────────


def detail(klien, code):
    return data(klien, f"/v1/indikator/{code}")


def test_b_tren_lokasi_ce1_lainnya_tidak_dibuang_d7(klien, indikator):
    r = detail(klien, "ce1")  # kode huruf kecil diterima
    d = r["data"]
    assert r["meta"]["dataset_terpilih"] == ["tic", "kebangsaan"]
    assert d["sources"] == [
        {"slug": "tic", "title": "Data Kunjungan TIC", "tier": "primer"},
        {"slug": "kebangsaan", "title": "Wisman Berdasarkan Kebangsaan", "tier": "primer"},
    ]
    assert d["kpis"] == [
        # idNum("1.234") = 1,234 di JS (titik dianggap desimal bila tak ada koma), ditiru
        {"label": "Total kunjungan", "value": 36.234, "sub": None},
        {"label": "Lokasi TIC", "value": 2, "sub": None},
        {"label": "Periode terdata", "value": 2, "sub": None},
    ]
    assert [b["type"] for b in d["blocks"]] == ["line", "bar", "ranked"]
    negara = d["blocks"][2]["data"]
    assert [n["label"] for n in negara] == ["LAINNYA", "MALAYSIA", "TIONGKOK", "CHINA"]  # D7


def test_c_wilayah_ce2_menjumlah_semua_periode_d4(klien, indikator):
    d = detail(klien, "CE2")["data"]
    assert d["kpis"][0] == {"label": "Total restoran", "value": 30, "sub": None}  # 2024 + 2026
    assert d["kpis"][2]["value"] == 3  # Set JS: TEBET, MENTENG, null
    assert d["blocks"][0]["data"][0] == {"label": "KOTA ADM. JAKARTA SELATAN", "value": 22}
    assert {"label": "—", "value": 1} in d["blocks"][1]["data"]


def test_e_event_ce3_dataset_terbesar_tanpa_kolom_d1(klien, indikator):
    """D1: CE3 memilih dataset terbesar walau tak punya nama_event/nama_venue."""
    r = detail(klien, "CE3")
    assert r["meta"]["dataset_terpilih"] == ["musik-besar"]
    d = r["data"]
    assert d["kpis"] == [
        {"label": "Total event", "value": 3, "sub": None},
        {"label": "Venue unik", "value": 1, "sub": None},
        {"label": "Periode", "value": 1, "sub": None},
    ]
    assert d["blocks"][-1] == {
        "type": "table_events",
        "title": "Event terbaru",
        "layout": "full",
        "data": {"header": ["Tanggal", "Event", "Venue"], "rows": [["Tidak ada baris event."]]},
    }
    assert d["blocks"][0]["data"] == [{"label": "—", "value": 3}]


def test_a_peta_ce4_top15_dan_lat_lng_tertukar_d5(klien, indikator):
    d = detail(klien, "CE4")["data"]
    # filter /museum|monumen/: 16 museum; KPI dari top-15 saja (D5)
    assert d["kpis"][0]["value"] == sum(100 - i for i in range(15))
    assert d["kpis"][1] == {"label": "Obyek wisata", "value": 15, "sub": None}
    titik = d["blocks"][0]
    assert titik["type"] == "map_points" and len(titik["data"]) == 16
    assert titik["data"][0] == {"lat": -6.1, "lng": 106.8, "label": "MUSEUM 00", "value": 100}
    assert [b["layout"] for b in d["blocks"]] == ["full", "half", "half"]  # tren < 2 titik disembunyikan


def test_a_peta_ci_ta_tanpa_filter_dan_koordinat_tak_sah(klien, indikator):
    indikator["indikator"].append({**indikator["indikator"][3], "code": "CI-TA", "framework": "GPCI"})
    d = detail(klien, "CI-TA")["data"]
    assert d["kpis"][2]["value"] == 16  # TAMAN MINI: longitude null → 0 (finite), latitude "x" → NaN → dibuang
    assert d["blocks"][-1]["type"] == "line"


def test_d_registri_ba_mice(klien, indikator):
    d = detail(klien, "BA-MICE")["data"]
    assert d["kpis"] == [
        {"label": "Total usaha MICE", "value": 4, "sub": None},
        {"label": "Jenis (KBLI)", "value": 3, "sub": None},  # PAMERAN, KONVENSI, undefined
        {"label": "Kota/Kab", "value": 2, "sub": None},
    ]
    assert d["blocks"][0]["data"][-1] == {"label": "—", "value": 1}


def test_f_okupansi_ci_lh(klien, indikator):
    d = detail(klien, "CI-LH")["data"]
    assert d["kpis"][2] == {"label": "Okupansi bintang 5 (terbaru)", "value": "50.45%", "sub": "2026-07-01"}
    seri = d["blocks"][0]["data"]["series"]
    assert [s["name"] for s in seri] == ["BINTANG 3", "BINTANG 5"]
    assert seri[0]["data"] == [{"label": "2026-06-01", "value": 61.5}, {"label": "2026-07-01", "value": 62.25}]


def test_g_survei_ci_sh_jumlah_rata_rata_d6(klien, indikator):
    """D6: "Rata-rata keseluruhan" = Σ rata-rata per negara."""
    d = detail(klien, "CI-SH")["data"]
    assert d["kpis"] == [
        {"label": "Total responden", "value": 101, "sub": None},
        {"label": "Negara asal", "value": 3, "sub": None},
        {"label": "Rata-rata keseluruhan", "value": 3645837 + 2050767 + 1168382, "sub": None},
    ]
    assert d["blocks"][1]["data"] == [{"label": "WISATAWAN MANCANEGARA", "value": 6864986}]


def test_fallback_data_belum_tersedia(klien, indikator):
    r = detail(klien, "AC-AP")
    d = r["data"]
    assert r["meta"]["dataset_terpilih"] == []
    assert d["sources"] == [] and d["kpis"] == [] and d["blocks"] == []
    assert d["source_text"] == "Penumpang udara"
    assert d["teks_fallback"] == [
        "← GPCI · Accessibility",
        "Penumpang udara",
        "Number of air passengers",
        "Sumber: Penumpang udara",
        "Cara indeks mengukur",
        "Jumlah penumpang udara",
        "Sumber resmi indeks:",
        "GPCI — Accessibility",
        "Satuan: penumpang/tahun",
        "Jakarta vs frontier",
        "Jakarta (data proksi)",
        "—",
        "Frontier (—)",
        "—",
        "Target",
        "—",
        "data dikelola OPD lain",
        "Data pendukung yang dibutuhkan",
        "Belum ada",
        "Statistik penumpang CGK/HLP",
        "· AP II",
        "Data belum tersedia",
        "GPCI · Accessibility",
        "AC-AP · Penumpang udara",
        "Number of air passengers",
        "Owner / OPD pemilik",
        "AP II",
        "Status readiness",
        "gap",
        "Keterangan",
        "Data dikelola AP II.",
    ]


def test_kode_tidak_dikenal_404(klien, indikator):
    assert klien.get("/v1/indikator/XX-1").status_code == 404


# ── gci/resmi + dataset-tematik ───────────────────────────────────────────────


def test_gci_resmi_angka_dari_bronze_teks_dari_app(klien, indikator):
    g = json.loads((AKAR / "lakehouse/data-api/tests/golden/gci.resmi.json").read_text())
    assert data(klien, "/v1/gci/resmi")["data"] == g["data"]
    # angka mengikuti Bronze
    indikator["bronze"]["gci_kearney_resmi"][1] = {**indikator["bronze"]["gci_kearney_resmi"][1], "nilai": "70"}
    klien.app.state.cache.kosongkan()
    assert data(klien, "/v1/gci/resmi")["data"]["ranking"]["overall"] == {"y2024": 74, "y2025": 70}


def test_dataset_tematik(klien, indikator, monkeypatch):
    from data_api.shared import hitungan

    monkeypatch.setattr(hitungan, "total_sync", lambda k: {"michelin-keys-indonesia": 47})
    gci = data(klien, "/v1/dataset-tematik", framework="GCI")["data"]["items"]
    assert [(i["no"], i["title"], i["total"]) for i in gci] == [
        ("01", "Restoran GCI", 2577),
        ("02", "Direktori Restoran", 604),
        ("03", "Pertunjukan & Budaya", 308),
        ("04", "Hotel MICHELIN Key", 47),
    ]
    assert [i["no"] for i in data(klien, "/v1/dataset-tematik", framework="GPCI")["data"]["items"]] == [
        "05",
        "06",
        "07",
    ]


# ── sumber daftar indikator ───────────────────────────────────────────────────


def test_bronze_dan_berkas_menghasilkan_struktur_sama():
    """Salinan Bronze (kolom huruf kecil, teks) dan berkas JSON → struktur indikator yang sama."""
    asli = json.loads((AKAR / "data/gci-gpci-indicators.json").read_text())
    bronze = []
    for i in asli:
        r = {k.lower(): (json.dumps(v) if isinstance(v, list) else None if v is None else str(v)) for k, v in i.items()}
        r["_ingested_at"] = "2026-10-22 00:00:00"
        bronze.append(r)
    dari_bronze = [indikator_sumber._dari_bronze({k: v for k, v in r.items() if not k.startswith("_")}) for r in bronze]
    assert dari_bronze == asli


# ── peniru JavaScript ─────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("v", "hasil"),
    [
        ("51,85", 51.85),
        ("1.234.567", None),
        ("3645837", 3645837),
        ("abc", 0),
        ("", None),
        (None, None),
        ("1,234.5", 1234.5),
    ],
)
def test_id_num_seperti_agg_ts(v, hasil):
    assert agg.id_num(v) == hasil


def test_to_fixed_dan_number_seperti_js():
    assert [agg.to_fixed(x, d) for x, d in ((-0.04, 1), (0.25, 1), (1.005, 2), (50.455, 2))] == [
        "-0.0",
        "0.3",
        "1.00",
        "50.45",
    ]
    assert (
        agg.js_number(None) == 0
        and agg.js_number(" 12 ") == 12
        and agg.js_number(agg.UNDEFINED) != agg.js_number(agg.UNDEFINED)
    )
