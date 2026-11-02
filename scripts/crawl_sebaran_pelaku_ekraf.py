#!/usr/bin/env python3
"""Ambil "Sebaran Pelaku Kreatif" EKRAF Hub (Kemenekraf) untuk provinsi DKI Jakarta.

Sumber: https://hub.ekraf.go.id/sebaran-pelaku-kreatif — tabel DataTables server-side;
halaman yang sama melayani JSON bila diminta lewat XHR (parameter draw/start/length +
filter province_id). robots.txt mengizinkan semua path. Sopan: User-Agent jujur, jeda
dengan jitter, berhenti total pada 403/429.

Kolom mengikuti tabel di situs (Nama, Subsektor, Provinsi, Kabupaten/Kota, Tipe User,
Usaha/Tempat Kerja/Nama Asosiasi/Umum, Tahun Update) plus tautan profil publik.
Data situs berubah terus (pendaftaran mandiri), jadi ini snapshot pada tanggal ambil.

Keluaran: data/sekunder/sebaran-pelaku-ekraf-jakarta.json

Jalankan dari root repo:  python3 scripts/crawl_sebaran_pelaku_ekraf.py
"""
from __future__ import annotations

import html
import json
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

URL = "https://hub.ekraf.go.id/sebaran-pelaku-kreatif"
PROVINSI_DKI = "31"
HALAMAN = 200
JEDA = 2.0  # detik, ±20%
HEADERS = {
    "User-Agent": "DisparDataPlatform/1.0 (pendataan Dinas Pariwisata dan Ekonomi Kreatif DKI Jakarta)",
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json",
}
OUT = Path("data/sekunder/sebaran-pelaku-ekraf-jakarta.json")
KOLOM = [
    ("nama", "Nama"),
    ("subsektor", "Subsektor"),
    ("provinsi", "Provinsi"),
    ("kabupaten_kota", "Kabupaten/Kota"),
    ("tipe_user", "Tipe User"),
    ("usaha_tempat_kerja", "Usaha/Tempat Kerja/Nama Asosiasi/Umum"),
    ("tahun_update", "Tahun Update"),
    ("tautan_profil", "Tautan Profil"),
]


def ambil(start: int) -> dict:
    q = {
        "draw": 1, "start": start, "length": HALAMAN, "province_id": PROVINSI_DKI,
        "name": "", "kabupaten_id": "", "business_category_id": "", "work_status": "", "year_update": "",
    }
    req = urllib.request.Request(f"{URL}?{urllib.parse.urlencode(q)}", headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code in (403, 429):
            sys.exit(f"berhenti: HTTP {e.code} pada start={start}")
        raise


def baris(d: dict) -> dict:
    nama = html.unescape(re.sub(r"<[^>]+>", "", d["profile_name"] or "")).strip()
    return {
        "nama": nama,
        "subsektor": d["business_category_name"] or "",
        "provinsi": d["provinsi_nama"] or "",
        "kabupaten_kota": d["kabupaten_nama"] or "",
        "tipe_user": d["work_status"] or "",
        "usaha_tempat_kerja": html.unescape(d["entity_info"] or "").strip(),
        "tahun_update": str(d["year_update"] or ""),
        "tautan_profil": f"https://hub.ekraf.go.id/users/{d['user_id']}",
    }


def main() -> None:
    hasil: dict[str, dict] = {}
    total = None
    start = 0
    while total is None or start < total:
        d = ambil(start)
        total = d["recordsFiltered"]
        for r in d["data"]:
            hasil.setdefault(r["user_id"], baris(r))
        print(f"start={start}: {len(d['data'])} baris, unik {len(hasil)}/{total}")
        if not d["data"]:
            break
        start += HALAMAN
        time.sleep(JEDA * random.uniform(0.8, 1.2))
    if len(hasil) != total:
        sys.exit(f"jumlah unik {len(hasil)} != recordsFiltered {total} (data bergeser saat diambil?) — ulangi")
    rows = sorted(hasil.values(), key=lambda r: (r["kabupaten_kota"], r["subsektor"], r["nama"].lower()))
    data = {
        "slug": OUT.stem,
        "title": "Sebaran Pelaku Ekonomi Kreatif DKI Jakarta (EKRAF Hub)",
        "description": (
            "Pelaku ekonomi kreatif berdomisili DKI Jakarta yang terdaftar di EKRAF Hub Kementerian "
            "Ekonomi Kreatif: nama, subsektor, kabupaten/kota, tipe pengguna, usaha atau tempat kerja, "
            "dan tahun pembaruan data. Snapshot dari hub.ekraf.go.id/sebaran-pelaku-kreatif."
        ),
        "columns": [
            {"key": k, "label": label, "type": "string", "description": f"{label} sesuai EKRAF Hub."}
            for k, label in KOLOM
        ],
        "rows": rows,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{OUT}: {len(rows)} baris")


if __name__ == "__main__":
    main()
