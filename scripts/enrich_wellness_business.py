#!/usr/bin/env python3
"""Build dataset 'usaha-wellness-jakarta' — Item 6.

Merupakan perluasan dari `wellness-jakarta.json` (Item 2) dengan fokus
"usaha terdaftar" — menambahkan kolom:

  - nama_dagang           : nama usaha/brand (bukan nama tempat generik OSM)
  - jenis_usaha           : "Rantai/Franchise" / "Independen" / "Bermerek" (hotel)
  -asosiasi               : asosiasi afiliasi (ASPAQIN, ISWI, AFPI, dll — placeholder)
  - status_usaha          : "Perlu verifikasi NIB" (placeholder jujur, kita tidak bisa
                             cek OSS publik dari skrip)

Logika deteksi:
  - Rantai/Franchise: pencocokan nama dengan regex brand nasional/internasional
    (Gold's Gym, Celebrity Fitness, Fitness First, Anytime Fitness, Delta Spa, dll).
  - Hotel Spa Premium: nama mengandung brand hotel besar (Four Seasons,
    Mandarin Oriental, Ritz-Carlton, Marriott, Hilton, dll) → tandai "Bermerek".
  - Sisanya: "Independen".

Skrip ini tidak menambah baris baru — hanya memperkaya 84 baris yang sudah ada.
Output:
  - data/sekunder/usaha-wellness-jakarta.json    (format standar repo)
  - platform-v2/data/usaha-wellness-jakarta.json (mirror untuk app)

Konvensi repo:
  - Path relatif dari root repo.
  - Idempoten — bisa dijalankan ulang tanpa duplikasi.
  - Tidak menyentuh lakehouse.
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

WELLNESS_SOURCE = REPO_ROOT / "data" / "sekunder" / "wellness-jakarta.json"
OUTPUT_JSON = REPO_ROOT / "data" / "sekunder" / "usaha-wellness-jakarta.json"
MIRROR_JSON = REPO_ROOT / "platform-v2" / "data" / "usaha-wellness-jakarta.json"

# Brand rantai fitness (regex case-insensitive).
FITNESS_CHAINS = [
    r"gold'?s gym",
    r"celebrity fitness",
    r"fitness first(?! platinum)",
    r"anytime fitness",
    r"snap fitness",
    r"world gym",
    r"big gym",
    r"gx fitness",
    r"fitness 24",
    r"k(?:x)?[ \-]?pilates",
    r"rumah fitnes",
]

# Brand rantai spa/kecantikan (nasional).
SPA_CHAINS = [
    r"delta spa",
    r"rasa spa",
    r"larissa aesthetic",
    r"larissa beauty",
    r"erha\s?(?:clinic|dermatology|aesthetic)?",
    r"beauty\s?forever",
    r"martha tilaar",
    r"sophie martin",
    r"my\s?beau(?:ty)?",
    r"johnny andrean",
    r"korean beauty",
    r"queen beauty",
    r"natalia beauty",
    r"mosk\s?(?:beauty|clinic)",
    r"nikita beauty",
    r"action beauty",
    r"fanny beauty",
    r"aesthetic clinic",
    r"skin[\s-]?care",
    r"colour yoga",
    r"yoga\s?\+",
]

# Brand hotel yang punya spa premium (kelas atas).
HOTEL_BRANDS = [
    r"four seasons",
    r"mandarin oriental",
    r"ritz[\s-]?carlton",
    r"st\.?\s?regis",
    r"kempinski",
    r"jw\s?marriott",
    r"marriott",
    r"hilton",
    r"conrad",
    r"waldorf",
    r"westin",
    r"sheraton",
    r"le\s?meridien",
    r"renaissance",
    r"fairmont",
    r"sofitel",
    r"pullman",
    r"mulia",
    r"intercontinental",
    r"park hyatt",
    r"grand hyatt",
    r"hyatt",
    r"raffles",
    r"shangri[\s-]?la",
    r"ayan?a",
    r"ritzcarlton",
    r"doubletree",
    r"alila",
    r"keraton",
    r"mercure",
    r"novotel",
    r"ibis",
    r"swiss[\s-]?bel",
    r"aston",
    r"favehotel",
    r"horison",
    r"amaroossa",
    r"ysn",
]


def classify_business_type(nama: str, kategori_wellness: str) -> tuple[str, str]:
    """Return (jenis_usaha, brand) berdasarkan nama + kategori."""
    n = nama.lower()

    # Cek hotel brand dulu (kategori Hotel Spa Premium)
    if kategori_wellness == "Hotel Spa Premium":
        for pat in HOTEL_BRANDS:
            m = re.search(pat, n)
            if m:
                return "Bermerek (Hotel)", m.group(0).title()
        return "Bermerek (Hotel)", ""

    # Cek fitness chain
    if kategori_wellness == "Fitness & Gym":
        for pat in FITNESS_CHAINS:
            m = re.search(pat, n)
            if m:
                return "Rantai/Franchise", m.group(0).strip().title()
        return "Independen", ""

    # Cek spa/kecantikan chain
    if kategori_wellness in {"Spa & Pijat", "Klinik Kecantikan & Estetika"}:
        for pat in SPA_CHAINS:
            m = re.search(pat, n)
            if m:
                return "Rantai/Franchise", m.group(0).strip().title()
        return "Independen", ""

    # Lainnya
    return "Independen", ""


def infer_asosiasi(kategori_wellness: str) -> str:
    """Inferensi asosiasi afiliasi berdasarkan kategori. Placeholder."""
    mapping = {
        "Spa & Pijat": "ASPAQIN, ISWI",
        "Hotel Spa Premium": "ASPAQIN, ISWI",
        "Fitness & Gym": "AFPI (Asosiasi Fitness Profesional Indonesia)",
        "Klinik Kecantikan & Estetika": "PERDOSKI (Perhimpunan Dokter Spesialis Kulit)",
        "Pengobatan Tradisional & Alternatif": "PDHMI (Perhimpunan Dokter Holistik Indonesia)",
        "Kesehatan Mental & Nutrisi": "Asosiasi Psikologi Klinis Indonesia",
        "Wellness Lainnya": "—",
    }
    return mapping.get(kategori_wellness, "—")


def build() -> dict:
    if not WELLNESS_SOURCE.exists():
        raise SystemExit(f"sumber tidak ditemukan: {WELLNESS_SOURCE}")

    src = json.loads(WELLNESS_SOURCE.read_text(encoding="utf-8"))
    rows = src.get("rows", [])
    if not rows:
        raise SystemExit("rows kosong di wellness-jakarta.json")

    new_rows = []
    counts = {"Rantai/Franchise": 0, "Bermerek (Hotel)": 0, "Independen": 0}

    for row in rows:
        nama = row.get("nama", "")
        kategori = row.get("kategori_wellness", "")
        jenis, brand = classify_business_type(nama, kategori)
        counts[jenis] = counts.get(jenis, 0) + 1

        new_row = dict(row)
        # Tambahkan/ubah field usaha
        new_row["nama_dagang"] = brand if brand else nama
        new_row["jenis_usaha"] = jenis
        new_row["asosiasi"] = infer_asosiasi(kategori)
        new_row["status_usaha"] = "Perlu verifikasi NIB"
        # Tambahkan referensi untuk audit
        new_row["sumber_basis"] = "wellness-jakarta.json (OSM Nominatim + Google Places API New)"
        new_row["tanggal_enrich"] = time.strftime("%Y-%m-%d", time.gmtime())

        new_rows.append(new_row)

    # Susun metadata output
    out = {
        "slug": "usaha-wellness-jakarta",
        "title": "Usaha Penyedia dan Tempat Layanan Wellness Tourism DKI Jakarta",
        "description": (
            "Perluasan dataset wellness-jakarta (84 venue) dengan fokus 'usaha terdaftar'. "
            "Menambahkan 4 kolom baru: nama_dagang (brand), jenis_usaha (Rantai/Bermerek/Independen), "
            "asosiasi (placeholder inferensi berdasarkan kategori), dan status_usaha ('Perlu verifikasi NIB'). "
            "Deteksi rantai via regex nama brand; asosiasi berupa inferensi berdasarkan kategori karena "
            "registrasi NIB publik tidak bisa diverifikasi via skrip otomatis. "
            f"Distribusi jenis usaha: {counts['Rantai/Franchise']} Rantai/Franchise, "
            f"{counts['Bermerek (Hotel)']} Hotel Spa Premium (bermerek), "
            f"{counts['Independen']} Independen."
        ),
        "columns": [
            {"key": "id", "label": "ID", "type": "string"},
            {"key": "nama", "label": "Nama Venue", "type": "string"},
            {"key": "nama_dagang", "label": "Nama Dagang/Brand", "type": "string"},
            {"key": "jenis_usaha", "label": "Jenis Usaha", "type": "string"},
            {"key": "asosiasi", "label": "Asosiasi (Inferensi)", "type": "string"},
            {"key": "status_usaha", "label": "Status Usaha", "type": "string"},
            {"key": "kategori_wellness", "label": "Kategori Wellness", "type": "string"},
            {"key": "kategori_osm", "label": "Kategori OSM / Google", "type": "string"},
            {"key": "alamat", "label": "Alamat", "type": "string"},
            {"key": "latitude", "label": "Lintang", "type": "number"},
            {"key": "longitude", "label": "Bujur", "type": "number"},
            {"key": "kota_adm", "label": "Kota Administrasi", "type": "string"},
            {"key": "sumber", "label": "Sumber", "type": "string"},
            {"key": "google_place_id", "label": "Google Place ID", "type": "string"},
            {"key": "google_primary_type", "label": "Google Primary Type", "type": "string"},
            {"key": "importance", "label": "Importance", "type": "number"},
            {"key": "telepon", "label": "Telepon", "type": "string"},
            {"key": "website", "label": "Website", "type": "string"},
            {"key": "deskripsi", "label": "Deskripsi", "type": "string"},
            {"key": "sumber_basis", "label": "Sumber Basis", "type": "string"},
            {"key": "tanggal_enrich", "label": "Tanggal Enrich", "type": "string"},
        ],
        "rows": new_rows,
        "meta": {
            "basis_slug": "wellness-jakarta",
            "basis_jumlah_baris": len(rows),
            "distribusi_jenis_usaha": counts,
            "asosiasi_inferensi_sumber": "Kategori → asosiasi (placeholder, bukan hasil lookup direktori)",
            "dibangun": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=0))
    MIRROR_JSON.parent.mkdir(parents=True, exist_ok=True)
    MIRROR_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=0))

    return {
        "out": str(OUTPUT_JSON.relative_to(REPO_ROOT)),
        "rows": len(new_rows),
        "counts": counts,
    }


def main() -> int:
    print(f"[enrich_wellness_business] Sumber: {WELLNESS_SOURCE.relative_to(REPO_ROOT)}")
    summary = build()
    print()
    print("=" * 60)
    print("RINGKASAN")
    print("=" * 60)
    print(f"Output                : {summary['out']}")
    print(f"Baris                 : {summary['rows']}")
    print(f"Rantai/Franchise      : {summary['counts'].get('Rantai/Franchise', 0)}")
    print(f"Bermerek (Hotel)      : {summary['counts'].get('Bermerek (Hotel)', 0)}")
    print(f"Independen            : {summary['counts'].get('Independen', 0)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
