"""Agregasi dashboard (plan 03) dengan data buatan kecil (`tests/palsu_dashboard.py`).

Kasus wajib plan: bulan bolong (Q8), tahun parsial, "Lainnya" sumber, kota tidak lengkap (Q16),
`jenis_tamu` tak dikenal (Q18), semester belum dirilis. PDRB dibandingkan persis dengan golden
statis plan 01 memakai salinan Bronze di `tests/fixtures/dashboard/`.
"""

import json
from pathlib import Path

import pytest

from data_api.features.dashboard import queries
from data_api.shared.errors import Upstream
from data_api.shared.format import id_num, js_round, lokal_id

GOLDEN = Path(__file__).resolve().parents[2] / "golden"


def data(klien, path, **params):
    r = klien.get(f"/v1/dashboard/{path}", params=params)
    assert r.status_code == 200, r.text
    return r.json()["data"]


# ── wisman ────────────────────────────────────────────────────────────────────


def test_wisman_tahunan_dan_tahun_parsial(klien, mentah):
    d = data(klien, "wisman/tahunan")
    assert d["data_tersedia"] == {"dari": "2024-01", "sampai": "2026-03"}
    assert d["tahun"] == [
        {"tahun": "2024", "label": "2024", "jumlah": 7800, "target": None},
        {"tahun": "2025", "label": "2025", "jumlah": 8580, "target": 1286092},
        {"tahun": "2026", "label": "2026 (s/d Mar)", "jumlah": 720, "target": 1289257},
    ]
    assert d["tahun_default"] == "2025"
    assert d["pertumbuhan"]["label"] == "Pertumbuhan 2025" and d["pertumbuhan"]["sub"] == "vs 2024"
    assert d["kpi"][0] == {"label": "Capaian 2024", "value": 7800, "sub": "target RPJMD belum ditetapkan"}
    assert d["kpi"][2]["sub"] == "target RPJMD 1.289.257"
    assert d["kpi"][3]["value"] == "10,0%" and d["kpi"][3]["delta"] == pytest.approx(10.0)


def test_wisman_bulan_bolong_q8(klien, mentah):
    """Q8 ditiru: label "s/d" memakai jumlah baris, bukan bulan terakhir."""
    mentah["wisman_bulanan"] = [r for r in mentah["wisman_bulanan"] if r["periode"] != "2026-02"]
    tahun = data(klien, "wisman/tahunan")["tahun"]
    assert tahun[-1]["label"] == "2026 (s/d Feb)"


def test_wisman_bulanan_kpi_dan_yoy(klien, mentah):
    d = data(klien, "wisman/bulanan", periode="2025-02")
    assert d["periode"] == "2025-02" and len(d["rows"]) == 27
    assert [s["name"] for s in d["yoy"]["seri"]] == ["2024", "2025", "2026 •"]
    assert d["pertumbuhan"][0] == {"periode": "2025-01", "persen": 10}
    assert d["kpi"][0] == {"label": "Wisman Feb 2025", "value": 220, "sub": "kunjungan"}
    assert d["kpi"][1]["value"] == "10,0%" and d["kpi"][1]["sub"] == "vs Feb 2024"
    assert d["kpi"][2] == {"label": "Negara terbanyak", "value": "Tiongkok", "sub": "110 kunjungan"}
    assert d["kpi"][3]["value"] == "—"  # tak ada lama menginap Feb 2025
    awal = data(klien, "wisman/bulanan", periode="2024-01")["kpi"][1]
    assert awal == {"label": "YoY bulan ini", "value": "—", "sub": "tak ada pembanding", "delta": None}
    assert data(klien, "wisman/bulanan")["periode"] == "2026-03"


def test_kebangsaan_lainnya_sumber_digabung(klien, mentah):
    d = data(klien, "wisman/kebangsaan", tahun="2025")
    assert d["label"] == "2025"
    assert [i["label"] for i in d["items"]] == ["Tiongkok", "Malaysia", "Lainnya"]
    total = sum(110 * b for b in range(1, 13))
    assert sum(i["value"] for i in d["items"]) == total
    satu = data(klien, "wisman/kebangsaan", tahun="2025", top=1)["items"]
    assert [i["label"] for i in satu] == ["Tiongkok", "Lainnya"] and satu[1]["value"] == total - satu[0]["value"]
    bulan = data(klien, "wisman/kebangsaan", periode="2026-03")
    assert bulan["label"] == "Mar 2026" and bulan["periode"] == "2026-03"
    assert data(klien, "wisman/kebangsaan", tahun="2026")["label"] == "2026 (s/d Mar)"


def test_pintu_masuk_tahun_bps_dan_semester(klien, mentah):
    t = data(klien, "wisman/pintu-masuk", tahun="2025")
    assert t == {
        "sumber": "sdi_semester",
        "label": "2025",
        "semester": "1 & 2",
        "items": [{"label": "Soekarno-Hatta", "value": 1850}, {"label": "Tanjung Priok", "value": 10}],
    }
    bps = data(klien, "wisman/pintu-masuk", periode="2025-01")
    assert bps["sumber"] == "bps_bulanan" and bps["label"] == "Jan 2025"
    assert bps["items"] == [{"label": "Soekarno-Hatta", "value": 60}, {"label": "Tanjung Priok", "value": 5}]
    sem = data(klien, "wisman/pintu-masuk", periode="2025-08")
    assert sem["label"] == "Semester 2 2025" and sem["items"] == [{"label": "Soekarno-Hatta", "value": 950}]


def test_semester_belum_dirilis_item_kosong(klien, mentah):
    mentah["wisman_pintu"] = [r for r in mentah["wisman_pintu"] if r["tahun"] != "2026"]
    d = data(klien, "wisman/pintu-masuk", periode="2026-01")
    assert d == {"sumber": "sdi_semester", "label": "Semester 1 2026", "semester": None, "items": []}
    assert data(klien, "wisman/pintu-masuk", tahun="2026")["semester"] == "—"


@pytest.mark.parametrize(
    ("path", "params"),
    [
        ("wisman/bulanan", {"periode": "2030-01"}),
        ("wisman/kebangsaan", {"tahun": "2025", "periode": "2025-01"}),
        ("wisman/kebangsaan", {"tahun": "1999"}),
        ("wisman/kebangsaan", {"top": "0"}),
        ("lama-menginap/per-kelas", {"tamu": "asing"}),
        ("lama-menginap/per-kelas", {"tamu": "wisman", "periode": "2030-01"}),
        ("wisnus/tahunan", {"kota": "Bandung"}),
        ("wisnus/per-kota", {"tahun": "1999"}),
        ("tenaga-kerja/subsektor", {"tahun": "1999"}),
        ("pdrb-ekraf/subsektor/sebaran", {"periode": "2030"}),
    ],
)
def test_parameter_tidak_valid_400(klien, mentah, path, params):
    r = klien.get(f"/v1/dashboard/{path}", params=params)
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_PARAM"


# ── lama menginap ─────────────────────────────────────────────────────────────


def test_lama_menginap_dan_jenis_tamu_tak_dikenal_q18(klien, mentah):
    mentah["lama_menginap"].append(
        {"periode": "2025-01", "jenis_hotel": "BINTANG 4", "jenis_tamu": "TIDAK DIKETAHUI", "rata": "2.1"}
    )
    d = data(klien, "lama-menginap/rata-rata")
    assert d["wisman"][0] == {"periode": "2025-01", "nilai": 2.5}
    # Q18: jenis tamu tak dikenal ikut Wisnus: rata-rata 3 kelas (1.5, 1.7, dan 2.1 yang tak dikenal)
    assert d["wisnus"][0]["nilai"] == js_round((1.5 + 1.7 + 2.1) / 3 * 100) / 100


def test_per_kelas_tabel_dan_tanpa_pembanding(klien, mentah):
    mentah["lama_menginap"] = [
        {**r, "rata": "2.4"} if r["periode"] == "2026-01" and r["jenis_hotel"] == "BINTANG 3" else r
        for r in mentah["lama_menginap"]
    ]
    d = data(klien, "lama-menginap/per-kelas", tamu="wisman")
    assert d["periode_list"] == ["2026-01", "2025-01"] and d["label"] == "Jan 2026"
    assert d["tabel"] == {
        "header": ["Kelas hotel", "Jan 2025", "Jan 2026", "YoY"],
        "rows": [["Bintang 3", "2,00", "2,40", "+20,0%"], ["Bintang 5", "3,00", "3,00", "0,0%"]],
    }
    awal = data(klien, "lama-menginap/per-kelas", tamu="wisman", periode="2025-01")["tabel"]["rows"]
    assert awal[0] == ["Bintang 3", "—", "2,00", "—"]


def test_seri_per_kelas(klien, mentah):
    seri = data(klien, "lama-menginap/seri", tamu="wisnus")["seri"]
    assert [s["name"] for s in seri] == ["Bintang 3", "Bintang 5"]
    assert seri[0]["data"] == [{"label": "2025-01", "value": 1.5}, {"label": "2026-01", "value": 1.5}]


# ── wisnus ────────────────────────────────────────────────────────────────────


def test_wisnus_meta_dan_tahunan(klien, mentah):
    meta = data(klien, "wisnus/meta")
    assert meta == {
        "kota": ["Jakarta Pusat", "Jakarta Selatan"],
        "tahun": ["2024", "2025", "2026"],
        "tahun_hilang_teks": None,
        "tahun_default": "2025",
    }
    d = data(klien, "wisnus/tahunan")
    assert d["tahun"] == [
        {"label": "2024", "value": 516},
        {"label": "2025", "value": 876},
        {"label": "2026 (s/d Feb)", "value": 186},
    ]
    assert d["kpi"][0] == {"label": "Capaian 2025", "value": 876, "sub": "perjalanan"}
    assert d["kpi"][1]["value"] == "69,8%"
    assert d["kpi"][2] == {"label": "2026 (s/d Feb)", "value": 186, "sub": "Jan–Feb 2025: 126"}
    assert d["kpi"][3] == {"label": "Tujuan terbanyak 2025", "value": "Jakarta Selatan", "sub": "558 perjalanan"}


def test_wisnus_filter_kota_q15(klien, mentah):
    """Q15: KPI capaian ikut filter kota, "tujuan terbanyak" tidak."""
    d = data(klien, "wisnus/tahunan", kota="Jakarta Pusat")
    assert d["kpi"][0]["value"] == 318
    assert d["kpi"][3]["value"] == "Jakarta Selatan"
    assert [s["name"] for s in data(klien, "wisnus/bulanan")["seri"]] == ["Jakarta Pusat", "Jakarta Selatan"]
    assert [s["name"] for s in data(klien, "wisnus/bulanan", kota="Jakarta Pusat")["seri"]] == ["Jakarta Pusat"]


def test_wisnus_tahun_hilang(klien, mentah):
    mentah["wisnus_kota"] = [r for r in mentah["wisnus_kota"] if not r["periode"].startswith("2025")]
    assert data(klien, "wisnus/meta")["tahun_hilang_teks"] == "Tahun 2025 belum tersedia."


def test_wisnus_yoy_kota_tidak_lengkap_q16(klien, mentah):
    """Q16: YoY bulan yang himpunan kotanya berbeda dari bulan pembanding tidak dihitung."""
    mentah["wisnus_kota"] = [
        r for r in mentah["wisnus_kota"] if not (r["periode"] == "2025-03" and r["kota"] == "Jakarta Selatan")
    ]
    d = data(klien, "wisnus/yoy")
    periode = [p["periode"] for p in d["pertumbuhan"]]
    assert "2025-02" in periode and "2025-03" not in periode
    # satu kota saja: himpunan selalu sama, jadi bulan itu tetap dihitung
    assert "2025-03" in [p["periode"] for p in data(klien, "wisnus/yoy", kota="Jakarta Pusat")["pertumbuhan"]]
    assert [s["name"] for s in d["seri"]] == ["2024", "2025", "2026 •"]


def test_wisnus_per_kota(klien, mentah):
    d = data(klien, "wisnus/per-kota", tahun="2026")
    assert d == {
        "label": "2026 (s/d Feb)",
        "items": [{"label": "Jakarta Selatan", "value": 123}, {"label": "Jakarta Pusat", "value": 63}],
    }
    assert data(klien, "wisnus/per-kota")["label"] == "2025"


# ── tenaga kerja ──────────────────────────────────────────────────────────────


def test_tenaga_kerja_dki(klien, mentah):
    d = data(klien, "tenaga-kerja/dki")
    assert [r["tahun"] for r in d["rows"]] == ["2023", "2024"]  # total 0 dibuang
    assert d["rows"][1] == {"tahun": "2024", "total": 984, "porsi_pct": 4.75, "laki": 500, "perempuan": 484}
    assert d["kpi"] == [
        {"label": "Tenaga kerja ekraf DKI 2024", "value": 984, "sub": "orang"},
        {"label": "Pertumbuhan 2024", "value": "-1,6%", "sub": "vs 2023", "delta": pytest.approx(-1.6)},
        {"label": "Porsi terhadap nasional 2024", "value": "4,75%", "sub": "nasional 20.700 orang"},
        {"label": "Laki-laki / Perempuan 2024", "value": "500 / 484", "sub": "orang"},
    ]


def test_tenaga_kerja_subsektor_dan_sertifikasi_q11(klien, mentah):
    s = data(klien, "tenaga-kerja/subsektor")
    assert s == {
        "tahun_list": ["2023", "2024"],
        "tahun": "2024",
        "items": [{"label": "Fesyen", "value": 500}, {"label": "Kuliner", "value": 300}],
    }
    d = data(klien, "tenaga-kerja/sertifikasi")
    # Q11: urutan bidang tetap (urutan tayang), bidang baru menyusul.
    assert d["bidang"] == ["Kepemanduan", "Hotel Dan Restoran", "Spa", "Zumba"]
    assert d["per_tahun"] == [{"label": "2023", "value": 30}, {"label": "2024", "value": 12}]
    assert [[p["value"] for p in s["data"]] for s in d["seri"]] == [[20, 0, 10, 0], [0, 7, 0, 5]]


# ── PDRB + ringkasan ──────────────────────────────────────────────────────────


@pytest.mark.parametrize("berkas", sorted(GOLDEN.glob("dashboard.pdrb-ekraf.*.json")), ids=lambda p: p.stem)
def test_pdrb_sama_dengan_golden_statis(klien, mentah, berkas):
    g = json.loads(berkas.read_text())
    r = klien.get(g["endpoint"], params=g["params"])
    assert r.status_code == 200 and r.json()["data"] == g["data"]


def test_ringkasan(klien, mentah):
    d = data(klien, "ringkasan")
    assert d["wisman"] == {"tahun": "2025", "jumlah": 8580, "target": 1286092}
    assert d["pdrb"]["kontribusi_pct"] == 11.16 and d["pdrb"]["target_pct"] == 10.51
    assert d["kpi"] == [
        {"label": "Wisman 2025", "value": 8580, "sub": "target RPJMD 1.286.092"},
        {"label": "Kontribusi PDRB Ekraf 2024", "value": "11,16%", "sub": "target 2025 10,51%"},
        {"label": "Nilai PDRB Ekraf 2024", "value": "Rp 411 T", "sub": "ADHB"},
        {"label": "Pertumbuhan Ekraf 2024", "value": "8,13%", "sub": "DKI 4,91%"},
    ]


# ── Q21 ───────────────────────────────────────────────────────────────────────


def test_q21_query_gagal_data_kosong_dan_peringatan(klien, mentah, monkeypatch):
    def gagal(k):
        raise Upstream("Lakehouse tidak dapat dibaca", "palsu")

    monkeypatch.setattr(queries, "wisman_bulanan", gagal)
    r = klien.get("/v1/dashboard/wisman/tahunan")
    assert r.status_code == 200
    assert r.json()["data"]["tahun"] == [] and r.json()["data"]["kpi"] == []
    assert r.json()["meta"]["peringatan"] == ["wisman_bulanan tidak dapat dibaca; ditampilkan kosong"]
    # kegagalan tidak di-cache: setelah pulih, data kembali
    monkeypatch.undo()
    from tests.palsu_dashboard import pasang

    pasang(monkeypatch)
    ok = klien.get("/v1/dashboard/wisman/tahunan").json()
    assert ok["data"]["tahun"] and "peringatan" not in ok["meta"]


def test_q21_tidak_berlaku_untuk_bronze_pdrb(klien, mentah, monkeypatch):
    def gagal(k, tabel):
        raise Upstream("Lakehouse tidak dapat dibaca", "palsu")

    monkeypatch.setattr(queries, "bronze", gagal)
    assert klien.get("/v1/dashboard/pdrb-ekraf/makro").status_code == 503


def test_format_angka_seperti_intl():
    assert id_num(8.998504853093307, 1) == "9,0" and id_num(-1.5639716549710672, 1) == "-1,6"
    assert id_num(1.005, 2) == "1,01" and id_num(-0.04, 1) == "-0,0" and id_num(26474118) == "26.474.118"
    assert lokal_id(2.06) == "2,06" and lokal_id(411.0) == "411" and lokal_id(0.1 + 0.2) == "0,3"
    assert [js_round(v) for v in (2.5, -2.5, 0.5)] == [3, -2, 1]


# ── kunjungan destinasi (DestinasiStat) ───────────────────────────────────────

CATATAN_MONAS = (
    "Catatan data: angka nusantara dan mancanegara diduga tertukar di sumber untuk Monumen Nasional Jan 2025 "
    "(nusantara 50, mancanegara 9.000). Angka ditampilkan apa adanya sesuai Satu Data Jakarta."
)


def test_destinasi_meta_per_jenis(klien, mentah):
    """Daftar destinasi hanya yang pernah melaporkan jenis itu; tahun parsial berlabel."""
    assert data(klien, "destinasi/meta", jenis="wisman") == {
        "tahun": [{"value": "2025", "label": "2025"}, {"value": "2026", "label": "2026 (s/d Mar)"}],
        "tahun_default": "2025",
        "destinasi": ["Monumen Nasional"],
    }
    wisnus = data(klien, "destinasi/meta", jenis="wisnus")["destinasi"]
    assert wisnus == ["Monumen Nasional", "Museum Joang '45", "Taman Mini Indonesia Indah"]


def test_destinasi_ringkasan_semua_dan_catatan(klien, mentah):
    d = data(klien, "destinasi/ringkasan", jenis="wisman")
    assert d["kpi"] == [
        {"label": "Kunjungan wisatawan mancanegara · 2025", "value": 9627, "sub": "kunjungan"},
        {"label": "Destinasi melapor", "value": "1 dari 3", "sub": "2025"},
        {"label": "Destinasi teramai", "value": "Monumen Nasional", "sub": "9.627 kunjungan"},
    ]
    assert d["catatan"] == [
        "Tidak melaporkan kunjungan wisatawan mancanegara: Museum Joang '45, Taman Mini Indonesia Indah. "
        "Total di atas tidak memuat destinasi tersebut.",
        CATATAN_MONAS,
    ]
    # Catatan tertukar hanya untuk tahun yang dipilih.
    assert data(klien, "destinasi/ringkasan", jenis="wisman", tahun="2026")["catatan"][1:] == []


def test_destinasi_ringkasan_satu_destinasi_bulan_null(klien, mentah):
    """Bulan NULL tidak dihitung (11 bulan), bukan nol; porsi dan peringkat di antara pelapor."""
    d = data(klien, "destinasi/ringkasan", jenis="wisnus", tahun="2025", destinasi="Museum Joang '45")
    assert d["kpi"] == [
        {"label": "Kunjungan wisatawan nusantara · 2025", "value": 720, "sub": "11 bulan dilaporkan"},
        {"label": "Porsi dari seluruh destinasi", "value": "0,5%", "sub": "2025"},
        {"label": "Peringkat kunjungan", "value": "3 dari 3", "sub": "2025"},
    ]
    assert d["catatan"] == [CATATAN_MONAS]


def test_destinasi_per_destinasi_dan_bulanan(klien, mentah):
    d = data(klien, "destinasi/per-destinasi", jenis="wisnus", tahun="2025")
    assert d["label"] == "2025"
    assert d["items"] == [
        {"destinasi": "Monumen Nasional", "jumlah": 99127, "persen": 71.4, "bulan": 12},
        {"destinasi": "Taman Mini Indonesia Indah", "jumlah": 39000, "persen": 28.1, "bulan": 12},
        {"destinasi": "Museum Joang '45", "jumlah": 720, "persen": 0.5, "bulan": 11},
    ]
    seri = data(klien, "destinasi/bulanan", jenis="wisnus", destinasi="Museum Joang '45")["items"]
    assert len(seri) == 14 and "2025-06" not in [p["label"] for p in seri]
    assert seri[0] == {"label": "2025-01", "value": 10}


def test_destinasi_wisman_dominan_bukan_tertukar(klien, mentah):
    """Destinasi yang memang sering didominasi wisman tidak ditandai tertukar."""
    for r in mentah["kunjungan_destinasi"]:
        if r["destinasi"] == "MONUMEN NASIONAL" and r["jenis"] == "WISATAWAN MANCANEGARA":
            r["jumlah"] = "20000"
    assert data(klien, "destinasi/ringkasan", jenis="wisnus")["catatan"] == []


@pytest.mark.parametrize(
    "params",
    [
        {"jenis": "lokal"},
        {"jenis": "wisman", "destinasi": "Taman Mini Indonesia Indah"},
        {"jenis": "wisnus", "tahun": "2030"},
    ],
)
def test_destinasi_parameter_salah_400(klien, mentah, params):
    r = klien.get("/v1/dashboard/destinasi/ringkasan", params=params)
    assert r.status_code == 400, r.text
