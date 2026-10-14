#!/usr/bin/env python3
"""Pembangun berkas referensi pintu masuk wisatawan mancanegara.

Sumber data primer:
Dua view pintu masuk pada silver:
- silver.wisman_jakarta_per_pintu_masuk
- silver.wisman_per_pintu_masuk_bulanan_bps
"""
from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data" / "referensi"

PINTU_MASUK = [
    {
        "kode": "soekarno-hatta",
        "nama": "Soekarno-Hatta",
        "moda": "udara",
        "kode_provinsi": "36",
        "alias": "Soekarno-Hatta|Bandara Soekarno-Hatta",
    },
    {
        "kode": "halim-perdanakusuma",
        "nama": "Halim Perdanakusuma",
        "moda": "udara",
        "kode_provinsi": "31",
        "alias": "Bandara Halim Perdana Kusuma|Halim Perdanakusuma",
    },
    {
        "kode": "tanjung-priok",
        "nama": "Tanjung Priok",
        "moda": "laut",
        "kode_provinsi": "31",
        "alias": "Tanjung Priok|Pelabuhan Tanjung Priok",
    },
    {
        "kode": "ngurah-rai",
        "nama": "Ngurah Rai",
        "moda": "udara",
        "kode_provinsi": "51",
        "alias": "Ngurah Rai",
    },
    {
        "kode": "batam",
        "nama": "Batam (Hang Nadim)",
        "moda": "udara",
        "kode_provinsi": "21",
        "alias": "Batam|Batam (Hang Nadim)",
    },
    {
        "kode": "juanda",
        "nama": "Juanda",
        "moda": "udara",
        "kode_provinsi": "35",
        "alias": "Juanda|Juanda. surabaya",
    },
    {
        "kode": "kualanamu",
        "nama": "Kualanamu",
        "moda": "udara",
        "kode_provinsi": "12",
        "alias": "Kualanamu",
    },
    {
        "kode": "husein-sastranegara",
        "nama": "Husein Sastranegara",
        "moda": "udara",
        "kode_provinsi": "32",
        "alias": "Husein Sastranegara",
    },
    {
        "kode": "tanjung-uban",
        "nama": "Tanjung Uban",
        "moda": "laut",
        "kode_provinsi": "21",
        "alias": "Tanjung Uban",
    },
    {
        "kode": "balai-karimun",
        "nama": "Tanjung Balai Karimun",
        "moda": "laut",
        "kode_provinsi": "21",
        "alias": "Balai Karimun|Tanjung Balai Karimun",
    },
    {
        "kode": "tanjung-pinang",
        "nama": "Tanjung Pinang",
        "moda": "laut",
        "kode_provinsi": "21",
        "alias": "Tanjung Pinang",
    },
    {
        "kode": "adisucipto",
        "nama": "Adisucipto",
        "moda": "udara",
        "kode_provinsi": "34",
        "alias": "Adisucipto",
    },
    {
        "kode": "adi-sumarmo",
        "nama": "Adi Sumarmo",
        "moda": "udara",
        "kode_provinsi": "33",
        "alias": "Adi Sumarmo",
    },
    {
        "kode": "minangkabau",
        "nama": "Minangkabau",
        "moda": "udara",
        "kode_provinsi": "13",
        "alias": "Minangkabau",
    },
    {
        "kode": "sultan-syarif-kasim-ii",
        "nama": "Sultan Syarif Kasim II",
        "moda": "udara",
        "kode_provinsi": "14",
        "alias": "Sultan Syarif Kasim II",
    },
    {
        "kode": "sam-ratulangi",
        "nama": "Sam Ratulangi",
        "moda": "udara",
        "kode_provinsi": "71",
        "alias": "Sam Ratulangi",
    },
    {
        "kode": "sultan-hasanuddin",
        "nama": "Sultan Hasanuddin",
        "moda": "udara",
        "kode_provinsi": "73",
        "alias": "Makassar|Sultan Hasanuddin",
    },
    {
        "kode": "sepinggan",
        "nama": "Sultan Aji Muhammad Sulaiman",
        "moda": "udara",
        "kode_provinsi": "64",
        "alias": "Sepinggan|Sultan aji muhammad sulaiman",
    },
    {
        "kode": "entikong",
        "nama": "Entikong",
        "moda": "darat",
        "kode_provinsi": "61",
        "alias": "Entikong",
    },
    {
        "kode": "lombok-int",
        "nama": "Lombok International",
        "moda": "udara",
        "kode_provinsi": "52",
        "alias": "Int lombok|Lombok International",
    },
    {
        "kode": "selaparang",
        "nama": "Selaparang",
        "moda": "udara",
        "kode_provinsi": "52",
        "alias": "Selaparang",
    },
    {
        "kode": "lainnya",
        "nama": "Lainnya",
        "moda": "lainnya",
        "kode_provinsi": "",
        "alias": "Lainnya",
    },
]


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path_pintu = DATA_DIR / "pintu-masuk.csv"
    with open(path_pintu, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["kode", "nama", "moda", "kode_provinsi", "alias"]
        )
        writer.writeheader()
        writer.writerows(PINTU_MASUK)
    print(f"Ditulis: {path_pintu} ({len(PINTU_MASUK)} baris)")


if __name__ == "__main__":
    main()
