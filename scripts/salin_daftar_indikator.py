#!/usr/bin/env python3
"""Salin daftar indikator GCI/GPCI dari app ke berkas sumber Bronze.

App (`platform-v2/data/gci-gpci-indicators.json`) adalah sumber kebenaran daftar indikator:
nomor resmi (`officialNo`) dan catatan terbaru ada di sana. Berkas root
`data/gci-gpci-indicators.json` adalah yang di-ingest ke `lake.bronze_file.gci_gpci_indicators`
(lihat `lakehouse/sources.toml`, kelas `saat_berubah`), jadi harus sama persis dengan versi app.

Jalankan dari root repo:
    python3 scripts/salin_daftar_indikator.py [--check]
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUMBER = ROOT / "platform-v2" / "data" / "gci-gpci-indicators.json"
TUJUAN = ROOT / "data" / "gci-gpci-indicators.json"


def main() -> int:
    sama = TUJUAN.exists() and TUJUAN.read_bytes() == SUMBER.read_bytes()
    if "--check" in sys.argv:
        print("sama" if sama else f"berbeda: {TUJUAN.relative_to(ROOT)} ≠ {SUMBER.relative_to(ROOT)}")
        return 0 if sama else 1
    if not sama:
        shutil.copyfile(SUMBER, TUJUAN)
    print(f"{TUJUAN.relative_to(ROOT)} {'sudah sama' if sama else 'diperbarui'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
