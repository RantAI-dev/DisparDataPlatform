"""Skrip pembangun referensi wilayah Kemendagri dan alias wilayah.

Mengunduh data wilayah dari repositori data Kemendagri (Kepmendagri No 300.2.2-2138 / No 300.2.2-2430 Tahun 2025)
dan menyaring:
- Semua provinsi (38 provinsi)
- Semua kabupaten/kota (514 kab/kota)
- Semua kecamatan dan kelurahan khusus DKI Jakarta (kode berawalan 31)
"""

from __future__ import annotations

import csv
import re
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
KEMENDAGRI_CSV = REPO_ROOT / "data" / "referensi" / "wilayah-kemendagri.csv"
ALIAS_CSV = REPO_ROOT / "data" / "referensi" / "wilayah-alias.csv"

UPSTREAM_SQL_URL = "https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql"


def bangun_wilayah_kemendagri() -> None:
    req = urllib.request.Request(UPSTREAM_SQL_URL, headers={"User-Agent": "Mozilla/5.0"})
    pattern = re.compile(r"\('([^']+)',\s*'([^']+)'\)")
    rows: list[tuple[str, str, str, str]] = []

    with urllib.request.urlopen(req) as resp:
        for line in resp:
            line_str = line.decode("utf-8", errors="ignore")
            m = pattern.search(line_str)
            if not m:
                continue
            kode, nama = m.group(1), m.group(2).strip()
            parts = kode.split(".")
            if len(parts) == 1:
                tingkat = "provinsi"
                kode_induk = ""
                rows.append((kode, nama, tingkat, kode_induk))
            elif len(parts) == 2:
                tingkat = "kabkota"
                kode_induk = parts[0]
                rows.append((kode, nama, tingkat, kode_induk))
            elif len(parts) == 3 and kode.startswith("31."):
                tingkat = "kecamatan"
                kode_induk = f"{parts[0]}.{parts[1]}"
                rows.append((kode, nama, tingkat, kode_induk))
            elif len(parts) == 4 and kode.startswith("31."):
                tingkat = "kelurahan"
                kode_induk = f"{parts[0]}.{parts[1]}.{parts[2]}"
                rows.append((kode, nama, tingkat, kode_induk))

    KEMENDAGRI_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(KEMENDAGRI_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["kode", "nama", "tingkat", "kode_induk"])
        for r in rows:
            writer.writerow(r)


def main() -> None:
    bangun_wilayah_kemendagri()
    if not ALIAS_CSV.exists():
        with open(ALIAS_CSV, "w", newline="", encoding="utf-8") as f:
            f.write("alias,tingkat,kode\n")


if __name__ == "__main__":
    main()
