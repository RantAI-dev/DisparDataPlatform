"""Data palsu dashboard: fungsi `queries` diganti baris mentah buatan (bentuk keluaran ClickHouse:
angka sebagai teks), Bronze PDRB/target dari `tests/fixtures/dashboard/` (salinan Bronze 22 Okt 2026)."""

from __future__ import annotations

import json
from pathlib import Path

from data_api.features.dashboard import queries

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "dashboard"


def _bulanan(tahun: int, bulan: list[int], jumlah) -> list[dict]:
    return [
        {"periode": f"{tahun}-{b:02d}", "tahun": str(tahun), "bulan": str(b), "jumlah": str(jumlah(b))} for b in bulan
    ]


def mentah_bawaan() -> dict[str, list[dict]]:
    bulanan = _bulanan(2024, list(range(1, 13)), lambda b: 100 * b)
    bulanan += _bulanan(2025, list(range(1, 13)), lambda b: 110 * b)
    bulanan += _bulanan(2026, [1, 2, 3], lambda b: 120 * b)
    negara = []
    for r in bulanan:
        n = int(r["jumlah"])
        negara += [
            {"periode": r["periode"], "negara": "Tiongkok", "jumlah": str(n // 2)},
            {"periode": r["periode"], "negara": "Malaysia", "jumlah": str(n // 4)},
            {"periode": r["periode"], "negara": "Lainnya", "jumlah": str(n - n // 2 - n // 4)},
        ]
    pintu = [
        {"tahun": "2025", "semester": "1", "pintu": "SOEKARNO HATTA", "jumlah": "900"},
        {"tahun": "2025", "semester": "1", "pintu": "TANJUNG PRIOK", "jumlah": "10"},
        {"tahun": "2025", "semester": "2", "pintu": "SOEKARNO HATTA", "jumlah": "950"},
        {"tahun": "2026", "semester": "1", "pintu": "SOEKARNO HATTA", "jumlah": "500"},
    ]
    los = []
    for periode in ("2025-01", "2026-01"):
        for kelas, w, n in (("BINTANG 3", "2.0", "1.5"), ("BINTANG 5", "3.0", "1.7")):
            los += [
                {"periode": periode, "jenis_hotel": kelas, "jenis_tamu": "MANCANEGARA", "rata": w},
                {"periode": periode, "jenis_hotel": kelas, "jenis_tamu": "NUSANTARA", "rata": n},
            ]
    wisnus = []
    for tahun, bulan in ((2024, range(1, 13)), (2025, range(1, 13)), (2026, range(1, 3))):
        for b in bulan:
            for kota, dasar in (("Jakarta Pusat", 10), ("Jakarta Selatan", 20)):
                wisnus.append({"periode": f"{tahun}-{b:02d}", "kota": kota, "jumlah": str(dasar * (tahun - 2023) + b)})
    # Kunjungan destinasi: A melapor keduanya; B hanya wisnus (wisman tak pernah dilaporkan);
    # C wisnus dengan satu bulan kosong (NULL). Monas Jan 2025 meniru angka tertukar di sumber.
    destinasi = []
    for tahun, bulan in ((2025, range(1, 13)), (2026, range(1, 4))):
        for b in bulan:
            p = f"{tahun}-{b:02d}"
            wn_a, wm_a = (50, 9000) if p == "2025-01" else (9000 + b, 50 + b)
            destinasi += [
                {"periode": p, "destinasi": "MONUMEN NASIONAL", "jenis": "WISATAWAN NUSANTARA", "jumlah": str(wn_a)},
                {"periode": p, "destinasi": "MONUMEN NASIONAL", "jenis": "WISATAWAN MANCANEGARA", "jumlah": str(wm_a)},
                {
                    "periode": p,
                    "destinasi": "TAMAN MINI INDONESIA INDAH",
                    "jenis": "WISATAWAN NUSANTARA",
                    "jumlah": str(500 * b),
                },
                {
                    "periode": p,
                    "destinasi": "MUSEUM JOANG '45",
                    "jenis": "WISATAWAN NUSANTARA",
                    "jumlah": None if (tahun, b) == (2025, 6) else str(10 * b),
                },
            ]
    return {
        "kunjungan_destinasi": destinasi,
        "wisman_bulanan": bulanan,
        "wisman_negara": negara,
        "wisman_pintu": pintu,
        "pintu_bulanan": [
            {"periode": "2025-01", "pintu": "Bandara Soekarno-Hatta", "jumlah": "60"},
            {"periode": "2025-01", "pintu": "Pelabuhan Tanjung Priok", "jumlah": "5"},
        ],
        "lama_menginap": los,
        "wisnus_kota": wisnus,
        "sertifikasi": [
            {"tahun": "2023", "bidang": "SPA", "jumlah": "10"},
            {"tahun": "2023", "bidang": "KEPEMANDUAN", "jumlah": "20"},
            {"tahun": "2024", "bidang": "ZUMBA", "jumlah": "5"},
            {"tahun": "2024", "bidang": "HOTEL DAN RESTORAN", "jumlah": "7"},
        ],
        "tk_dki": [
            {"tahun": "2023", "total": "1000", "laki": "600", "perempuan": "400", "nasional": "20000"},
            {"tahun": "2024", "total": "984", "laki": "500", "perempuan": "484", "nasional": "20700"},
            {"tahun": "2025", "total": "0", "laki": "0", "perempuan": "0", "nasional": "0"},
        ],
        "tk_subsektor": [
            {"tahun": "2024", "subsektor": "Kuliner", "jumlah": "300"},
            {"tahun": "2024", "subsektor": "Fesyen", "jumlah": "500"},
            {"tahun": "2023", "subsektor": "Kuliner", "jumlah": "280"},
        ],
    }


def pasang(monkeypatch) -> dict[str, list[dict]]:
    """Ganti fungsi `queries` dengan baris mentah; ubah isinya di tes sebelum memanggil endpoint."""
    data = mentah_bawaan()
    for nama in data:
        monkeypatch.setattr(queries, nama, lambda k, nama=nama: data[nama])
    monkeypatch.setattr(queries, "bronze", lambda k, tabel: json.loads((FIXTURE / f"{tabel}.json").read_text()))
    return data
