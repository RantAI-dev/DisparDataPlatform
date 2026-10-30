#!/usr/bin/env python3
"""Pecah 'Data Hotel dan Hiburan (per kota).xlsx' (Disparekraf) jadi dua dataset.

Berkas asli berisi 10 sheet: "Hotel <Kota> (n)" dan "Hiburan <Kota> (n)" untuk 5 kota.
Pembaca xlsx pipeline Bronze hanya membaca sheet pertama, dan Disparekraf meminta hotel
dan hiburan dipisah, jadi sheet sejenis digabung ke satu TSV dengan kolom `Kota` di depan:

  data/sumber/disparekraf/hotel-per-kota.tsv
  data/sumber/disparekraf/hiburan-per-kota.tsv

Nilai sel disalin apa adanya (teks, termasuk baris baru); hanya angka bulat yang dibaca
openpyxl sebagai float ditulis tanpa ".0", dan kolom kosong sisa format Excel dibuang.
Dipublikasikan atas permintaan Disparekraf (pemilik data), termasuk kolom kontak.

Isi yang sama juga ditulis sebagai dataset sekunder (JSON {slug,title,description,columns,rows})
supaya tampil di Katalog Data:

  data/sekunder/hotel-per-kota-jakarta.json
  data/sekunder/hiburan-per-kota-jakarta.json

Nama kolom tetap seperti berkas asli (label); kunci = label yang dinormalkan.

Jalankan dari root repo:  python3 scripts/pisah_hotel_hiburan.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

import openpyxl

DIR = Path("data/sumber/disparekraf")
SRC = DIR / "Data Hotel dan Hiburan (per kota).xlsx"
OUT = {"Hotel": DIR / "hotel-per-kota.tsv", "Hiburan": DIR / "hiburan-per-kota.tsv"}
KOTA = {
    "Jakbar": "Jakarta Barat",
    "Jakpus": "Jakarta Pusat",
    "Jaksel": "Jakarta Selatan",
    "Jaktim": "Jakarta Timur",
    "Jakut": "Jakarta Utara",
}
NAMA_SHEET = re.compile(r"^(Hotel|Hiburan)\s+(Jak\w+)\s*\((\d+)\)\s*$")
SEKUNDER = {
    "Hotel": (
        Path("data/sekunder/hotel-per-kota-jakarta.json"),
        "hotel-per-kota-jakarta",
        "Hotel per Kota DKI Jakarta",
        "Pendataan usaha hotel per kota administrasi DKI Jakarta: NIB, pelaku usaha, klasifikasi, "
        "alamat, kontak, jumlah kamar, dan tenaga kerja.",
    ),
    "Hiburan": (
        Path("data/sekunder/hiburan-per-kota-jakarta.json"),
        "hiburan-per-kota-jakarta",
        "Usaha Hiburan per Kota DKI Jakarta",
        "Pendataan usaha hiburan (bar, karaoke, dan diskotek) per kota administrasi DKI "
        "Jakarta: jenis usaha, NIB, pelaku usaha, alamat, kontak, kapasitas, dan tenaga kerja.",
    ),
}


def kunci(label: str) -> str:
    """'Jml. Kamar' → 'jml_kamar', '(L)' → 'l'."""
    return re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")


def tulis_sekunder(kategori: str, kepala: list[str], rows: list[list[str]]) -> None:
    path, slug, judul, deskripsi = SEKUNDER[kategori]
    keys = [kunci(k) for k in kepala]
    if len(set(keys)) != len(keys):
        raise SystemExit(f"kunci kolom {kategori} bertabrakan: {keys}")
    data = {
        "slug": slug,
        "title": judul,
        "description": deskripsi,
        "columns": [
            {"key": k, "label": label, "type": "string", "description": f"{label} sesuai berkas pendataan."}
            for k, label in zip(keys, kepala)
        ],
        "rows": [dict(zip(keys, r)) for r in rows],
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{path}: {len(rows)} baris, {len(keys)} kolom")


def teks(v: object) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def baca_sheet(ws) -> tuple[list[str], list[list[str]]]:
    baris = [r for r in ws.iter_rows(values_only=True) if any(c not in (None, "") for c in r)]
    kepala = [str(c).strip() if c is not None else "" for c in baris[0]]
    isi = [[teks(c) for c in r] for r in baris[1:]]
    # Kolom terpakai = berjudul dan tidak sepenuhnya kosong (sisa format "Column 15", dst. dibuang).
    pakai = [
        i for i, k in enumerate(kepala)
        if k and not re.fullmatch(r"Column \d+", k) and any(i < len(r) and r[i].strip() for r in isi)
    ]
    return [kepala[i] for i in pakai], [[r[i] if i < len(r) else "" for i in pakai] for r in isi]


def main() -> int:
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    hasil: dict[str, tuple[list[str], list[list[str]]]] = {}
    for ws in wb.worksheets:
        m = NAMA_SHEET.match(ws.title)
        if not m:
            print(f"sheet tak dikenal: {ws.title!r}", file=sys.stderr)
            return 1
        kategori, singkat, jumlah_judul = m.group(1), m.group(2), int(m.group(3))
        kepala, isi = baca_sheet(ws)
        if kategori in hasil and hasil[kategori][0] != kepala:
            print(f"kolom {ws.title!r} beda dengan sheet {kategori} lain: {kepala}", file=sys.stderr)
            return 1
        if len(isi) != jumlah_judul:
            print(f"catatan: {ws.title!r} berisi {len(isi)} baris, judul sheet menyebut {jumlah_judul}")
        rows = hasil.setdefault(kategori, (kepala, []))[1]
        rows.extend([KOTA[singkat], *r] for r in isi)
    wb.close()

    for kategori, (kepala, rows) in hasil.items():
        with open(OUT[kategori], "w", encoding="utf-8", newline="") as f:
            w = csv.writer(f, delimiter="\t", lineterminator="\n")
            w.writerow(["Kota", *kepala])
            w.writerows(rows)
        print(f"{OUT[kategori]}: {len(rows)} baris, {len(kepala) + 1} kolom")
        tulis_sekunder(kategori, ["Kota", *kepala], rows)
    return 0


if __name__ == "__main__":
    sys.exit(main())
