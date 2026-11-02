#!/usr/bin/env python3
"""Bangun dataset sekunder fasilitasi HKI pelaku ekraf 2026 dari transkripsi lampiran nota monev.

Sumber: lampiran tiga nota dinas monev subkegiatan fasilitasi HKI 2026 (PDF hasil pindai,
tidak di-commit). Tabel lampiran ditranskripsi tangan dari pindaian, apa adanya — tidak ada
baris/kolom yang dihapus atau ditambah, ejaan asli dipertahankan (mis. "Aplikas",
"Maesrtonesia"), dan sel gabungan (merge) diisi ulang di tiap baris yang ditutupinya:

  data/sumber/disparekraf/fasilitasi-hki-2026-tw1.tsv   nota 1967/PW.04.02, 30 Mar 2026 (50)
  data/sumber/disparekraf/fasilitasi-hki-2026-tw2.tsv   nota 3870/PW.04.02, 23 Jun 2026 (80)
  data/sumber/disparekraf/fasilitasi-hki-2026-tw3.tsv   nota 6234/PW.04.02, 29 Sep 2026 (100)

Tiap triwulan jadi satu dataset (kolom TW III berbeda dari TW I-II):

  data/sekunder/fasilitasi-hki-ekraf-2026-tw{1,2,3}.json

Jalankan dari root repo:  python3 scripts/fasilitasi_hki_2026.py
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

DIR = Path("data/sumber/disparekraf")
OUT = Path("data/sekunder")
TRIWULAN = {
    1: ("I", 50, "nama pemohon, merek/ciptaan, alamat, dan subsektor"),
    2: ("II", 80, "nama pemohon, merek/ciptaan, alamat, dan subsektor"),
    3: ("III", 100, "nama merek/ciptaan, subsektor, dan jenis HKI (Hak Merek atau Hak Cipta)"),
}


def kunci(label: str) -> str:
    """'Merk/Cipta' → 'merk_cipta'."""
    return re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")


def main() -> None:
    for tw, (romawi, jumlah, isi) in TRIWULAN.items():
        with open(DIR / f"fasilitasi-hki-2026-tw{tw}.tsv", encoding="utf-8", newline="") as f:
            kepala, *rows = list(csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE))
        if len(rows) != jumlah or [r[0] for r in rows] != [str(i) for i in range(1, jumlah + 1)]:
            raise SystemExit(f"TW {romawi}: nomor baris harus 1..{jumlah}")
        if any(len(r) != len(kepala) for r in rows):
            raise SystemExit(f"TW {romawi}: jumlah kolom tidak seragam")
        keys = [kunci(k) for k in kepala]
        slug = f"fasilitasi-hki-ekraf-2026-tw{tw}"
        data = {
            "slug": slug,
            "title": f"Fasilitasi HKI Pelaku Ekonomi Kreatif 2026 Triwulan {romawi}",
            "description": (
                f"Pelaku ekonomi kreatif DKI Jakarta yang difasilitasi pendaftaran hak kekayaan "
                f"intelektual pada triwulan {romawi} 2026: {isi}."
            ),
            "columns": [
                {"key": k, "label": label, "type": "string", "description": f"{label} sesuai lampiran laporan monev."}
                for k, label in zip(keys, kepala)
            ],
            "rows": [dict(zip(keys, r)) for r in rows],
        }
        path = OUT / f"{slug}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{path}: {len(rows)} baris, {len(keys)} kolom")


if __name__ == "__main__":
    main()
