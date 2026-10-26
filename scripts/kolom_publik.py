#!/usr/bin/env python3
"""Tata kolom dataset sekunder hasil scraping supaya berbahasa umum.

Konvensi (skill crawling-data, "Kolom publik vs jejak teknis"): dataset yang tayang
hanya memuat kolom yang berguna bagi pembaca. Jejak teknis (objek OSM, place_id
Google, skor importance, status geocoder) dibuang dari dataset; asalnya tetap ada
di cache pembangun masing-masing.

Skrip ini untuk dataset yang pembangunnya tidak bisa dijalankan ulang persis (butuh
jaringan, atau hasilnya sudah dikurasi di luar skrip) atau tidak tercatat. Dataset
yang pembangunnya bisa direproduksi (MICE, Michelin, lokasi syuting film) memberi
label publik di pembangunnya sendiri.

Setelah menjalankan ulang pembangun dataset di ATURAN, jalankan skrip ini lagi.
Idempoten: kolom yang sudah ditata dilewati. Tiap salinan (data/sekunder/ dan
cermin platform-v2/data/) diproses sendiri dengan format JSON aslinya, tanpa
saling menyalin.

Jalankan dari root repo:  python3 scripts/kolom_publik.py
"""

from __future__ import annotations

import itertools
import json
import re
import sys
from pathlib import Path

SALINAN = (Path("data/sekunder"), Path("platform-v2/data"))
BELUM_ADA = "Belum ada titik"
BULAN = {
    "January": "Januari", "February": "Februari", "March": "Maret", "April": "April",
    "May": "Mei", "June": "Juni", "July": "Juli", "August": "Agustus",
    "September": "September", "October": "Oktober", "November": "November", "December": "Desember",
}
KATA = {"begins": "mulai", "ends": "berakhir", "resumes": "dibuka kembali"}


def ada_titik(r: dict) -> bool:
    lat = r.get("lat", r.get("latitude"))
    lon = r.get("lon", r.get("lng", r.get("longitude")))
    return lat not in (None, "") and lon not in (None, "")


def sumber_venue(v, r):
    v = str(v or "")
    if v.startswith("Google"):
        return "Google Maps"
    if v.startswith("Nominatim"):
        return "OpenStreetMap"
    return v


def sumber_atraksi_air(v, r):
    v = str(v or "")
    if v.startswith("Nominatim"):
        return "OpenStreetMap"
    if "potensi_DTW" in v:
        return "Satu Data Jakarta (Data Destinasi Pariwisata + Potensi DTW)"
    if v.startswith("SDI destinasi"):
        return "Satu Data Jakarta (Data Destinasi Pariwisata)"
    return v


def titik_atraksi_air(v, r):
    if not ada_titik(r):
        return BELUM_ADA
    return {
        "OK": "Satu Data Jakarta",
        "OK (koreksi OSM)": "OpenStreetMap (dikoreksi manual)",
        "OK (nominatim-osm)": "OpenStreetMap",
        "OK (photon-fix)": "OpenStreetMap",
    }.get(v, v)


def titik_osm(v, r):
    return "OpenStreetMap" if ada_titik(r) else BELUM_ADA


def titik_suvenir(v, r):
    if not ada_titik(r):
        return BELUM_ADA
    return {"Koreksi riset": "Dikoreksi manual"}.get(v, v)


def status_terbang(v, r):
    v = str(v or "")
    for en, idn in {**KATA, **BULAN}.items():
        v = re.sub(rf"\b{en}\b", idn, v)
    return v


def peta(m: dict):
    return lambda v, r: m.get(v, v)


DESKRIPSI_TITIK = "Asal titik lokasi di peta"
WELLNESS_BUANG = ["kategori_osm", "google_place_id", "google_primary_type", "importance"]
WELLNESS_SUMBER = {"sumber": ("sumber", "Sumber Data", "Asal data venue", sumber_venue)}

WELLNESS_TEKS = {
    "id": (None, "Kode unik venue"),
    "alamat": (None, "Alamat lengkap venue"),
    "kota_adm": (None, "Kota administrasi, diperkirakan dari titik lokasi"),
}

# slug → {"buang": [kolom], "ubah": {kolom_lama: (kolom_baru, label, deskripsi, fungsi(nilai, baris))},
#         "teks": {kolom: (label atau None, deskripsi atau None)}}
ATURAN = {
    "wellness-jakarta": {"buang": WELLNESS_BUANG, "ubah": WELLNESS_SUMBER, "teks": WELLNESS_TEKS},
    "usaha-wellness-jakarta": {
        "buang": [*WELLNESS_BUANG, "sumber_basis"],
        "ubah": WELLNESS_SUMBER,
        "teks": {"tanggal_enrich": ("Tanggal Pembaruan Data", None)},
    },
    "water-attractions-jakarta": {
        "buang": ["koordinat_sumber_silver_di_swap"],
        "ubah": {
            "koordinat_status": ("sumber_titik", "Sumber Titik", DESKRIPSI_TITIK, titik_atraksi_air),
            "sumber": ("sumber", "Sumber Data", "Asal data atraksi", sumber_atraksi_air),
        },
    },
    "desa-wisata-jakarta": {
        "buang": ["sumber_koordinat"],
        "ubah": {"koordinat_status": ("sumber_titik", "Sumber Titik", DESKRIPSI_TITIK, titik_osm)},
    },
    "hotel-transit-jakarta": {
        "buang": ["catatan_verifikasi"],
        "ubah": {"koordinat_sumber": ("sumber_titik", "Sumber Titik", DESKRIPSI_TITIK, titik_osm)},
    },
    "hotel-kamar-jakarta": {
        "ubah": {
            "status_operasi": ("status_operasi", "Status Operasi", None,
                               peta({"BEROPERASI": "Beroperasi", "TIDAK_DIKETAHUI": "Tidak diketahui", "TUTUP": "Tutup"})),
            "status_riset": ("status_riset", "Hasil Penelusuran", "Hasil penelusuran data hotel terkini",
                             peta({"DITEMUKAN": "Ditemukan", "TIDAK_DITEMUKAN": "Tidak ditemukan",
                                   "BELUM": "Belum ditelusuri", "TUTUP": "Tutup", "RAGU": "Belum pasti"})),
        },
    },
    "penerbangan-langsung-internasional-jakarta": {
        "ubah": {"status_operasi": ("status_operasi", "Status Operasi", None, status_terbang)},
    },
    "souvenir-tripadvisor-2026": {
        "ubah": {"sumber_koordinat": ("sumber_titik", "Sumber Titik", DESKRIPSI_TITIK, titik_suvenir)},
    },
}


def format_asli(raw: str, data) -> dict:
    """Cari opsi json.dumps yang menghasilkan teks persis sama, supaya diff hanya isi."""
    for indent, ascii_ in itertools.product((2, 0, 1, 4, None), (False, True)):
        teks = json.dumps(data, ensure_ascii=ascii_, indent=indent)
        if raw in (teks, teks + "\n"):
            return {"indent": indent, "ensure_ascii": ascii_, "newline": raw.endswith("\n")}
    sys.exit("format JSON tidak dikenali; tidak ditulis supaya diff tidak membengkak")


def tata(data: dict, aturan: dict) -> int:
    berubah = 0
    buang = [k for k in aturan.get("buang", []) if any(c["key"] == k for c in data["columns"])]
    if buang:
        # Kolom yang dibuang harus jejak teknis, bukan isi: catatan_verifikasi hanya dibuang kalau kosong.
        if "catatan_verifikasi" in buang:
            if any(r.get("catatan_verifikasi") for r in data["rows"]):
                sys.exit("catatan_verifikasi berisi; tidak dibuang")
        data["columns"] = [c for c in data["columns"] if c["key"] not in buang]
        for r in data["rows"]:
            for k in buang:
                r.pop(k, None)
        berubah += len(buang)
    for lama, (baru, label, desk, fungsi) in aturan.get("ubah", {}).items():
        kol = next((c for c in data["columns"] if c["key"] == lama), None)
        if kol is None:
            continue  # sudah ditata (kolom diganti nama) pada jalan sebelumnya
        sebelum = json.dumps([kol, [r.get(lama) for r in data["rows"]]], ensure_ascii=False)
        kol["key"], kol["label"] = baru, label
        if desk is not None:
            kol["description"] = desk
        for i, r in enumerate(data["rows"]):
            nilai = fungsi(r.get(lama), r)
            if baru != lama:
                # Pertahankan urutan kunci baris: kunci baru menggantikan posisi kunci lama.
                data["rows"][i] = r = {(baru if k == lama else k): v for k, v in r.items()}
            r[baru] = nilai
        sesudah = json.dumps([kol, [r.get(baru) for r in data["rows"]]], ensure_ascii=False)
        berubah += sebelum != sesudah
    for key, (label, desk) in aturan.get("teks", {}).items():
        kol = next(c for c in data["columns"] if c["key"] == key)
        baru = {**kol, **({"label": label} if label else {}), **({"description": desk} if desk else {})}
        berubah += baru != kol
        kol.update(baru)
    return berubah


def main() -> int:
    for slug, aturan in ATURAN.items():
        for d in SALINAN:
            p = d / f"{slug}.json"
            raw = p.read_text(encoding="utf-8")
            data = json.loads(raw)
            fmt = format_asli(raw, data)
            n = tata(data, aturan)
            if n:
                teks = json.dumps(data, ensure_ascii=fmt["ensure_ascii"], indent=fmt["indent"])
                p.write_text(teks + ("\n" if fmt["newline"] else ""), encoding="utf-8")
            print(f"{p}: {n} perubahan kolom")
    return 0


if __name__ == "__main__":
    sys.exit(main())
