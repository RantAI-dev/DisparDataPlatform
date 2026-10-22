"""Data palsu fitur indikator: katalog, total sync, baris Silver, kolom, tier, dan berkas Bronze.

Kasus yang sengaja dibentuk:
- CE3 (D1): dataset terbesar yang cocok kata kunci tidak punya kolom event/venue;
- CE2 (D4): dua periode dijumlahkan;
- CE4 (D5): KPI dari top-15 saja, lat/lng tertukar;
- CI-SH (D6): "rata-rata keseluruhan" = jumlah rata-rata;
- latest (D9): `dataset_column` tanpa kolom periode → label = kolom pertama.
"""

from __future__ import annotations

import json
from pathlib import Path

INDIKATOR = [
    {
        "framework": "GCI",
        "dimension": "Cultural Experience",
        "group": "Cultural",
        "code": "CE1",
        "name": "Wisatawan internasional",
        "definition": "Jumlah kedatangan",
        "owner": "DISPAREKRAF",
        "dataAvailable": True,
        "draftReadiness": "ready",
        "match": ["kunjungan tic", "kebangsaan"],
        "measure": None,
        "note": "catatan CE1",
    },
    {
        "framework": "GCI",
        "dimension": "Cultural Experience",
        "group": "Cultural",
        "code": "CE2",
        "name": "Kuliner",
        "definition": "Ragam kuliner",
        "owner": "DISPAREKRAF",
        "dataAvailable": True,
        "draftReadiness": "ready",
        "match": ["restoran"],
        "measure": "jumlah",
        "note": "catatan CE2",
    },
    {
        "framework": "GCI",
        "dimension": "Cultural Experience",
        "group": "Cultural",
        "code": "CE3",
        "name": "Seni",
        "definition": "Seni pertunjukan",
        "owner": "DISPAREKRAF",
        "dataAvailable": True,
        "draftReadiness": "ready",
        "match": ["musik"],
        "measure": None,
        "note": "catatan CE3",
    },
    {
        "framework": "GCI",
        "dimension": "Cultural Experience",
        "group": "Cultural",
        "code": "CE4",
        "name": "Museum",
        "definition": "Jumlah museum",
        "owner": "DISBUD",
        "dataAvailable": True,
        "draftReadiness": "partial",
        "match": ["obyek wisata"],
        "measure": None,
        "note": "catatan CE4",
    },
    {
        "framework": "GCI",
        "dimension": "Cultural Experience",
        "group": "Cultural",
        "code": "CE5",
        "name": "Stadion",
        "definition": "Jumlah stadion",
        "owner": "Dispora",
        "dataAvailable": False,
        "draftReadiness": "gap",
        "match": [],
        "measure": None,
        "note": "Data dikelola Dispora.",
    },
    {
        "framework": "GPCI",
        "dimension": "Cultural Interaction",
        "group": "Tourism",
        "code": "CI-SH",
        "name": "Belanja",
        "definition": "Pengeluaran",
        "owner": "BPS",
        "dataAvailable": True,
        "draftReadiness": "ready",
        "match": ["pengeluaran", "kosong"],
        "measure": None,
        "note": "catatan CI-SH",
        "officialNo": 34,
    },
    {
        "framework": "GPCI",
        "dimension": "Cultural Interaction",
        "group": "Tourism",
        "code": "CI-LH",
        "name": "Hotel",
        "definition": "Okupansi",
        "owner": "BPS",
        "dataAvailable": True,
        "draftReadiness": "partial",
        "match": ["hunian"],
        "measure": None,
        "note": "catatan CI-LH",
        "officialNo": 33,
    },
    {
        "framework": "GPCI",
        "dimension": "Cultural Interaction",
        "group": "Tourism",
        "code": "BA-MICE",
        "name": "MICE",
        "definition": "Usaha MICE",
        "owner": "DPMPTSP",
        "dataAvailable": True,
        "draftReadiness": "ready",
        "match": ["mice"],
        "measure": None,
        "note": "catatan MICE",
    },
    {
        "framework": "GPCI",
        "dimension": "Accessibility",
        "group": "Transport",
        "code": "AC-AP",
        "name": "Penumpang udara",
        "definition": "Number of air passengers",
        "owner": "AP II",
        "dataAvailable": False,
        "draftReadiness": "gap",
        "match": ["tak-ada-judul-seperti-ini"],
        "measure": None,
        "note": "Data dikelola AP II.",
        "officialNo": 65,
    },
]

KATALOG = [
    ("tic", "Data Kunjungan TIC", "primer"),
    ("kebangsaan", "Wisman Berdasarkan Kebangsaan", "primer"),
    ("resto-kel", "Jumlah Restoran per Kelurahan", "primer"),
    ("musik-besar", "Rekomendasi Pertunjukan Musik", "primer"),
    ("musik-kecil", "Seni Pertunjukan dan Musik", "sekunder"),
    ("obyek", "Kunjungan ke Obyek Wisata", "primer"),
    ("pengeluaran", "Rata-rata Pengeluaran Wisatawan", "primer"),
    ("pengeluaran-kosong", "Pengeluaran Kosong", "primer"),
    ("hunian", "Tingkat Hunian Hotel", "primer"),
    ("mice", "Usaha MICE berizin", "primer"),
]
TOTAL = {
    "tic": 4,
    "kebangsaan": 4,
    "resto-kel": 4,
    "musik-besar": 3,
    "musik-kecil": 2,
    "obyek": 17,
    "pengeluaran": 3,
    "pengeluaran-kosong": 0,
    "hunian": 4,
    "mice": 4,
}

BARIS = {
    "tic": [
        {"periode_data": "2025-01-01", "lokasi": "TIC Kota Tua", "jumlah": 10},
        {"periode_data": "2025-02-01", "lokasi": "TIC Kota Tua", "jumlah": 20},
        {"periode_data": "2025-01-01", "lokasi": "TIC Bandara", "jumlah": 5},
        {"periode_data": "2025-02-01", "lokasi": "TIC Bandara", "jumlah": "1.234"},
    ],
    "kebangsaan": [
        {"periode_data": "2025-01-01", "kebangsaan": "LAINNYA", "jumlah_kunjungan": 900},
        {"periode_data": "2025-01-01", "kebangsaan": "TIONGKOK", "jumlah_kunjungan": 500},
        {"periode_data": "2025-01-01", "kebangsaan": "CHINA", "jumlah_kunjungan": 300},
        {"periode_data": "2025-01-01", "kebangsaan": "MALAYSIA", "jumlah_kunjungan": 700},
    ],
    "resto-kel": [
        {
            "periode_data": 2024,
            "wilayah": "KOTA ADM. JAKARTA SELATAN",
            "kecamatan": "TEBET",
            "kelurahan": "A",
            "jumlah": 10,
        },
        {
            "periode_data": 2026,
            "wilayah": "KOTA ADM. JAKARTA SELATAN",
            "kecamatan": "TEBET",
            "kelurahan": "A",
            "jumlah": 12,
        },
        {
            "periode_data": 2026,
            "wilayah": "KOTA ADM. JAKARTA PUSAT",
            "kecamatan": "MENTENG",
            "kelurahan": "B",
            "jumlah": 7,
        },
        {"periode_data": 2026, "wilayah": "KOTA ADM. JAKARTA PUSAT", "kecamatan": None, "kelurahan": "C", "jumlah": 1},
    ],
    "musik-besar": [{"periode_data": 2025, "nama_kegiatan": f"Konser {i}"} for i in range(3)],
    "musik-kecil": [
        {"periode_data": 2025, "nama_event": "Jazz", "nama_venue": "JIExpo"},
        {"periode_data": 2024, "nama_event": "Rock", "nama_venue": "GBK"},
    ],
    "obyek": [
        {
            "periode_data": "2025-01-01",
            "obyek_wisata": f"MUSEUM {i:02d}",
            "longitude": -6.1,
            "latitude": 106.8,
            "jenis_wisatawan": "WISATAWAN NUSANTARA",
            "jumlah_kunjungan": 100 - i,
        }
        for i in range(16)
    ]
    + [
        {
            "periode_data": "2025-02-01",
            "obyek_wisata": "TAMAN MINI",
            "longitude": None,
            "latitude": "x",
            "jenis_wisatawan": "WISATAWAN MANCANEGARA",
            "jumlah_kunjungan": 999,
        },
    ],
    "pengeluaran": [
        {
            "periode_data": 2025,
            "jenis_wisatawan": "WISATAWAN MANCANEGARA",
            "asal_negara": "SINGAPURA",
            "jumlah_responden": 50,
            "rata_rata": 3645837,
        },
        {
            "periode_data": 2025,
            "jenis_wisatawan": "WISATAWAN MANCANEGARA",
            "asal_negara": "MALAYSIA",
            "jumlah_responden": 40,
            "rata_rata": 2050767,
        },
        {
            "periode_data": 2025,
            "jenis_wisatawan": "WISATAWAN MANCANEGARA",
            "asal_negara": "JEPANG",
            "jumlah_responden": 11,
            "rata_rata": 1168382,
        },
    ],
    "hunian": [
        {"periode_data": "2026-06-01", "jenis_hotel": "BINTANG 3", "rata_rata": 61.5},
        {"periode_data": "2026-06-01", "jenis_hotel": "BINTANG 5", "rata_rata": 50.0},
        {"periode_data": "2026-07-01", "jenis_hotel": "BINTANG 5", "rata_rata": 50.455},
        {"periode_data": "2026-07-01", "jenis_hotel": "BINTANG 3", "rata_rata": "62,25"},
    ],
    "mice": [
        {"uraian_kbli": "PAMERAN", "skala_usaha": "Mikro", "kabupaten_atau_kota": "JAKARTA PUSAT"},
        {"uraian_kbli": "PAMERAN", "skala_usaha": "Kecil", "kabupaten_atau_kota": "JAKARTA PUSAT"},
        {"uraian_kbli": "KONVENSI", "skala_usaha": "Mikro", "kabupaten_atau_kota": "JAKARTA BARAT"},
        {"skala_usaha": "Mikro", "kabupaten_atau_kota": "JAKARTA BARAT"},
    ],
}
# dataset_column: urutan dan isi apa adanya (periode_data memang tidak pernah terdaftar di SDI).
KOLOM = {slug: [k for k in rows[0] if k != "periode_data"] for slug, rows in BARIS.items()}
KOLOM["pengeluaran-kosong"] = ["asal_negara", "rata_rata"]

BENCHMARK = {
    "metric_id": "AC-AP",
    "index_metric": "Jumlah penumpang udara",
    "index_source": "GPCI — Accessibility",
    "unit": "penumpang/tahun",
    "frontier_city": "—",
    "frontier_value": "—",
    "jakarta_value": None,
    "jakarta_note": "data dikelola OPD lain",
    "target": "—",
    "data_needed": json.dumps([{"label": "Statistik penumpang CGK/HLP", "status": "belum", "owner": "AP II"}]),
}
KEARNEY = [
    {
        "indikator": "Peringkat Keseluruhan (Overall)",
        "tahun": "2024",
        "nilai": "74",
        "satuan": "peringkat",
        "sumber": "x",
        "catatan": "",
    },
    {
        "indikator": "Peringkat Keseluruhan (Overall)",
        "tahun": "2025",
        "nilai": "71",
        "satuan": "peringkat",
        "sumber": "x",
        "catatan": "",
    },
    {
        "indikator": "Pengalaman Budaya (Cultural Experience)",
        "tahun": "2024",
        "nilai": "52",
        "satuan": "peringkat",
        "sumber": "x",
        "catatan": "",
    },
    {
        "indikator": "Pengalaman Budaya (Cultural Experience)",
        "tahun": "2025",
        "nilai": "58",
        "satuan": "peringkat",
        "sumber": "x",
        "catatan": "",
    },
    {
        "indikator": "Jumlah Museum",
        "tahun": "2025",
        "nilai": "79",
        "satuan": "Museum",
        "sumber": "satudata.jakarta.go.id",
        "catatan": "",
    },
    {
        "indikator": "Seni Visual & Pertunjukan",
        "tahun": "2024",
        "nilai": "156",
        "satuan": "Karya / kegiatan",
        "sumber": "Dinas Pariwisata & Ekraf",
        "catatan": "Belum digabung dengan data Disbud.",
    },
    {
        "indikator": "Wisatawan Internasional",
        "tahun": "2025",
        "nilai": "2767622",
        "satuan": "Wisatawan",
        "sumber": "jakarta.bps.go.id",
        "catatan": "",
    },
    {
        "indikator": "Penawaran Kuliner (Michelin)",
        "tahun": "2025",
        "nilai": "0",
        "satuan": "Restoran Michelin",
        "sumber": "Michelin",
        "catatan": "Belum ada Michelin Star di Jakarta.",
    },
]
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "dashboard"


def pasang(monkeypatch) -> dict:
    """Ganti akses lake untuk fitur indikator; kembalikan data yang bisa diubah tes."""
    from data_api.features.indikator import queries
    from data_api.shared import hitungan, indikator_sumber, lake
    from data_api.shared import queries as sq

    data = {
        "indikator": [dict(i) for i in INDIKATOR],
        "katalog": [{"slug": s, "title": t, "tier": tier, "table_name": s.replace("-", "_")} for s, t, tier in KATALOG],
        "total": dict(TOTAL),
        "baris": {k: [dict(r) for r in v] for k, v in BARIS.items()},
        "kolom": {k: list(v) for k, v in KOLOM.items()},
        "bronze": {
            "gci_gpci_benchmark": [BENCHMARK],
            "gci_kearney_resmi": KEARNEY,
            "target_wisman": json.loads((FIXTURE / "target_wisman.json").read_text()),
            "seni_venue": [],
            "artis_tampil_jakarta": [],
        },
    }
    monkeypatch.setattr(indikator_sumber, "daftar", lambda k: data["indikator"])
    monkeypatch.setattr(sq, "katalog", lambda k: data["katalog"])
    monkeypatch.setattr(hitungan, "total_sync", lambda k: data["total"])
    monkeypatch.setattr(lake, "baris_dataset", lambda k, slug: data["baris"].get(slug, []))
    monkeypatch.setattr(
        lake, "kunci_kolom", lambda k, slugs: {s: set(data["kolom"].get(s, [])) for s in slugs if s in data["kolom"]}
    )
    monkeypatch.setattr(lake, "kolom_dataset", lambda k, slug: [{"key_asli": c} for c in data["kolom"].get(slug, [])])
    monkeypatch.setattr(
        lake, "tier_dataset", lambda k, slugs: {d["slug"]: d["tier"] for d in data["katalog"] if d["slug"] in slugs}
    )
    monkeypatch.setattr(queries, "bronze", lambda k, tabel: data["bronze"][tabel])
    return data
