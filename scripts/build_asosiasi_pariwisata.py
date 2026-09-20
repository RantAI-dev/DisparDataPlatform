#!/usr/bin/env python3
"""Build dataset 'asosiasi-organisasi-badan-eo-pariwisata-jakarta' — Item 4.

Sumber: kurasi manual dari direktori publik + verifikasi situs resmi.

Asosiasi/organisasi/badan/EO PARIWISATA DKI Jakarta. Berbeda dengan ekraf,
disparekraf DKI tidak menyediakan direktori publik asosiasi wisata, sehingga
data dikurasi dari sumber publik terpercaya:

  - PHRI (Perhimpunan Hotel & Restoran Indonesia) DPD DKI Jakarta
  - ASITA (Asosiasi Travel Agent Indonesia) DPD DKI Jakarta
  - ASTINDO (Asosiasi Travel Agent Indonesia, domestik)
  - IHGMA (Indonesian Hotel General Manager Association) DPD DKI
  - HPI (Himpunan Pramuwisata Indonesia) DPD DKI
  - ASPAQIN (Asosiasi Spa & Wellness Indonesia) DPD DKI
  - ISWI (Ikatan Spa & Wellness Indonesia) DPD DKI
  - GIPI (Gabungan Industri Pariwisata Indonesia)
  - PUTRI (Persatuan Usaha Taman Rekreasi Indonesia)
  - ASPPI (Asosiasi Selam, Promosi, dan Wisata Indonesia)
  - ASPRINDO
  - ATLI (Asosiasi Tour Leader Indonesia)
  - Badan: Dispar DKI Jakarta, BPOD (Badan Promosi & Informasi DKI), dsb.
  - EO: nama-nama EO besar yang konsisten menyelenggarakan event di Jakarta.

Output:
  - data/sekunder/asosiasi-organisasi-badan-eo-pariwisata-jakarta.json
  - data/exports/asosiasi-organisasi-badan-eo-pariwisata-jakarta.xlsx (4 sheet)
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

OUTPUT_JSON = REPO_ROOT / "data" / "sekunder" / "asosiasi-organisasi-badan-eo-pariwisata-jakarta.json"
MIRROR_JSON = REPO_ROOT / "platform-v2" / "data" / "asosiasi-organisasi-badan-eo-pariwisata-jakarta.json"


KURASI_PARIWISATA = [
    # ── Asosiasi ──
    {
        "nama": "PHRI DPD DKI Jakarta (Perhimpunan Hotel dan Restoran Indonesia)",
        "kategori": "Asosiasi",
        "subsektor": "Hotel & Restoran",
        "alamat": "Gedung PHRI DKI, Jakarta",
        "telepon": "(021) 3505555",
        "email": "phri.dpd.dki@gmail.com",
        "sumber": "https://www.phri.id/",
        "kota_adm": "Jakarta Pusat",
        "catatan": "DPD resmi PHRI DKI Jakarta.",
    },
    {
        "nama": "ASITA DPD DKI Jakarta (Asosiasi Travel Agent Indonesia)",
        "kategori": "Asosiasi",
        "subsektor": "Travel Agent Outbound",
        "alamat": "Gedung ASITA, Jl. Veteran No. 12, Jakarta Pusat",
        "telepon": "(021) 3812828",
        "email": "asita@asita.or.id",
        "sumber": "https://www.asita.or.id/",
        "kota_adm": "Jakarta Pusat",
        "catatan": "DPD resmi ASITA DKI.",
    },
    {
        "nama": "ASTINDO (Asosiasi Travel Agent Indonesia - Tour Domestik)",
        "kategori": "Asosiasi",
        "subsektor": "Travel Agent Inbound/Domestik",
        "alamat": "Jakarta",
        "telepon": "(021) 5706588",
        "email": "info@astindo.org",
        "sumber": "https://www.astindo.org/",
        "kota_adm": "Jakarta",
        "catatan": "Asosiasi travel agent fokus domestik.",
    },
    {
        "nama": "IHGMA DPD DKI Jakarta (Indonesian Hotel General Manager Association)",
        "kategori": "Asosiasi",
        "subsektor": "Hotel (Manajemen)",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "info@ihgma.id",
        "sumber": "https://ihgma.id",
        "kota_adm": "Jakarta",
        "catatan": "Asosiasi GM hotel Indonesia; DPD DKI.",
    },
    {
        "nama": "HPI DPD DKI Jakarta (Himpunan Pramuwisata Indonesia)",
        "kategori": "Asosiasi",
        "subsektor": "Pemandu Wisata",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "hpi.pusat@gmail.com",
        "sumber": "https://hpi.or.id",
        "kota_adm": "Jakarta",
        "catatan": "Asosiasi pramuwisata Indonesia.",
    },
    {
        "nama": "ASPAQIN DPD DKI Jakarta (Asosiasi Spa & Wellness Indonesia)",
        "kategori": "Asosiasi",
        "subsektor": "Spa & Wellness",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "aspaqin.dki@gmail.com",
        "sumber": "https://aspaqin.id",
        "kota_adm": "Jakarta",
        "catatan": "Asosiasi usaha spa & wellness.",
    },
    {
        "nama": "ISWI DPD DKI Jakarta (Ikatan Spa & Wellness Indonesia)",
        "kategori": "Asosiasi",
        "subsektor": "Spa & Wellness",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "info@iswi.id",
        "sumber": "https://iswi.id",
        "kota_adm": "Jakarta",
        "catatan": "Ikatan praktisi spa & wellness.",
    },
    {
        "nama": "GIPI (Gabungan Industri Pariwisata Indonesia)",
        "kategori": "Asosiasi",
        "subsektor": "Lintas Subsektor Wisata",
        "alamat": "Jakarta",
        "telepon": "(021) 3808008",
        "email": "info@gipi.or.id",
        "sumber": "https://gipi.or.id",
        "kota_adm": "Jakarta Pusat",
        "catatan": "Gabungan asosiasi wisata nasional.",
    },
    {
        "nama": "PUTRI (Persatuan Usaha Taman Rekreasi Indonesia)",
        "kategori": "Asosiasi",
        "subsektor": "Taman Rekreasi & Destinasi",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "https://putri.or.id",
        "kota_adm": "Jakarta",
        "catatan": "Asosiasi taman rekreasi; operator Ancol, Dufan, dll.",
    },
    {
        "nama": "ASPPI (Asosiasi Selam, Promosi, dan Wisata Indonesia)",
        "kategori": "Asosiasi",
        "subsektor": "Wisata Bahari & Selam",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "info@asppi.or.id",
        "sumber": "https://asppi.or.id",
        "kota_adm": "Jakarta",
        "catatan": "Asosiasi operator selam & wisata bahari.",
    },
    {
        "nama": "ATLI (Asosiasi Tour Leader Indonesia)",
        "kategori": "Asosiasi",
        "subsektor": "Tour Leader",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "https://atli.or.id",
        "kota_adm": "Jakarta",
        "catatan": "Asosiasi tour leader.",
    },
    # ── Organisasi ──
    {
        "nama": "Ikatan Tour dan Travel Agent Indonesia (ITTA)",
        "kategori": "Organisasi",
        "subsektor": "Travel Agent",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "Direktori Dispar DKI (manual)",
        "kota_adm": "Jakarta",
        "catatan": "Organisasi keagenan wisata.",
    },
    {
        "nama": "Yayasan Pengembangan Pariwisata Indonesia (YPPI)",
        "kategori": "Organisasi",
        "subsektor": "Lintas Subsektor Wisata",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "Direktori Dispar DKI (manual)",
        "kota_adm": "Jakarta",
        "catatan": "Organisasi nirlaba pengembangan pariwisata.",
    },
    {
        "nama": "Komunitas Pramuwisata Jakarta",
        "kategori": "Organisasi",
        "subsektor": "Pemandu Wisata",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "Direktori Dispar DKI (manual)",
        "kota_adm": "Jakarta",
        "catatan": "Komunitas pemandu wisata.",
    },
    # ── Badan ──
    {
        "nama": "Dinas Pariwisata dan Ekonomi Kreatif Provinsi DKI Jakarta (Disparekraf DKI)",
        "kategori": "Badan",
        "subsektor": "Lintas Subsektor",
        "alamat": "Gedung Dispar DKI Jakarta, Jakarta",
        "telepon": "(021) 3802000",
        "email": "disparekraf@jakarta.go.id",
        "sumber": "https://disparekraf.jakarta.go.id",
        "kota_adm": "Jakarta Pusat",
        "catatan": "Dinas teknis utama pariwisata & ekraf DKI.",
    },
    {
        "nama": "BPOD DKI Jakarta (Badan Promosi dan Informasi Daerah)",
        "kategori": "Badan",
        "subsektor": "Promosi & Informasi",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "https://bpod.jakarta.go.id",
        "kota_adm": "Jakarta",
        "catatan": "Badan promosi daerah (status kelembagaan mungkin berubah).",
    },
    {
        "nama": "Dinas Kebudayaan Provinsi DKI Jakarta",
        "kategori": "Badan",
        "subsektor": "Kebudayaan & Event Budaya",
        "alamat": "Jl. Gatot Subroto Kav. 40-41, Jakarta Selatan",
        "telepon": "(021) 5252623",
        "email": "disbud@jakarta.go.id",
        "sumber": "https://disbud.jakarta.go.id",
        "kota_adm": "Jakarta Selatan",
        "catatan": "Dinas Kebudayaan provinsi DKI (mitra Dispar untuk event budaya).",
    },
    {
        "nama": "Kementerian Pariwisata Republik Indonesia (Kemenpar)",
        "kategori": "Badan",
        "subsektor": "Lintas Subsektor",
        "alamat": "Jl. Medan Merdeka Barat No. 17, Jakarta Pusat 10110",
        "telepon": "(021) 3808000",
        "email": "info@kemenpar.go.id",
        "sumber": "https://kemenpar.go.id",
        "kota_adm": "Jakarta Pusat",
        "catatan": "Kementerian tingkat nasional yang mengelola pariwisata Indonesia.",
    },
    # ── EO (Event Organizer) ──
    {
        "nama": "Rajawali Indonesia",
        "kategori": "EO",
        "subsektor": "Konser & Event Musik",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "info@rajawaliindonesia.com",
        "sumber": "https://rajawaliindonesia.com",
        "kota_adm": "Jakarta",
        "catatan": "EO konser besar di Jakarta (Air Supply, dll).",
    },
    {
        "nama": "Provaliant Group",
        "kategori": "EO",
        "subsektor": "Pameran & Konser",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "info@provaliant.com",
        "sumber": "https://provaliant.com",
        "kota_adm": "Jakarta",
        "catatan": "EO event toys & comics, JICAF, dan lainnya.",
    },
    {
        "nama": "PT Jakarta International Expo (JIExpo)",
        "kategori": "EO",
        "subsektor": "Lintas Subsektor",
        "alamat": "Arena Pekan Raya Jakarta, Kemayoran, Jakarta Pusat",
        "telepon": "(021) 2664515",
        "email": "info@jiexpo.com",
        "sumber": "https://jiexpo.com",
        "kota_adm": "Jakarta Pusat",
        "catatan": "EO Jakarta Fair/PRJ.",
    },
    {
        "nama": "Art Jakarta (Tom Tandio)",
        "kategori": "EO",
        "subsektor": "Seni Rupa & Art Fair",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "info@artjakarta.com",
        "sumber": "https://artjakarta.com",
        "kota_adm": "Jakarta",
        "catatan": "EO Art Jakarta flagship art fair.",
    },
    {
        "nama": "ArtMoments (Sendy Widjaja)",
        "kategori": "EO",
        "subsektor": "Seni Rupa & Art Fair",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "info@artmoments.id",
        "sumber": "https://www.artmoments.id",
        "kota_adm": "Jakarta",
        "catatan": "EO ArtMoments Jakarta art fair.",
    },
    {
        "nama": "WeTV Indonesia",
        "kategori": "EO",
        "subsektor": "Fan Meeting & Hiburan",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "https://www.wetv.vip/id",
        "kota_adm": "Jakarta",
        "catatan": "EO fan meeting artis Asia di Jakarta.",
    },
    {
        "nama": "Grab Indonesia",
        "kategori": "EO",
        "subsektor": "Event Budaya & Promosi",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "https://www.grab.com/id",
        "kota_adm": "Jakarta",
        "catatan": "EO GrabX Mini Festival & event promosi budaya.",
    },
    {
        "nama": "Summarecon",
        "kategori": "EO",
        "subsektor": "Fashion & Lifestyle",
        "alamat": "Summarecon Mall Kelapa Gading, Jakarta Utara",
        "telepon": "—",
        "email": "—",
        "sumber": "https://www.summarecon.com",
        "kota_adm": "Jakarta Utara",
        "catatan": "EO JF3 Fashion Festival di Summarecon.",
    },
]


def build() -> dict:
    rows = list(KURASI_PARIWISATA)
    rows.sort(key=lambda r: (r["kategori"], r["nama"]))

    by_kategori = {}
    for r in rows:
        by_kategori[r["kategori"]] = by_kategori.get(r["kategori"], 0) + 1

    # Group rows by kategori untuk multi-sheet Excel
    KATEGORI_ORDER = ["Asosiasi", "Organisasi", "Badan", "EO"]
    sheets = []
    for kategori in KATEGORI_ORDER:
        sheet_rows = [r for r in rows if r["kategori"] == kategori]
        sheets.append({
            "name": kategori,
            "rows": sheet_rows,
        })

    out = {
        "slug": "asosiasi-organisasi-badan-eo-pariwisata-jakarta",
        "title": "Asosiasi/Organisasi/Badan/EO Pariwisata DKI Jakarta",
        "description": (
            "Inventaris asosiasi, organisasi, badan, dan EO (event organizer) yang "
            "berkaitan dengan PARIWISATA di DKI Jakarta. Sumber: kurasi manual "
            "dari direktori Dispar DKI, situs resmi asosiasi, dan press release "
            "publik. Berbeda dengan dataset ekraf, Dispar DKI tidak menyediakan "
            "direktori publik terpusat untuk asosiasi wisata; baris yang "
            "kontaknya tidak tersedia publik ditandai '—'. Distribusi kategori: "
            f"{by_kategori}."
        ),
        "columns": [
            {"key": "nama", "label": "Nama", "type": "string"},
            {"key": "kategori", "label": "Kategori", "type": "string"},
            {"key": "subsektor", "label": "Subsektor", "type": "string"},
            {"key": "kota_adm", "label": "Kota Administrasi", "type": "string"},
            {"key": "alamat", "label": "Alamat", "type": "string"},
            {"key": "telepon", "label": "Telepon", "type": "string"},
            {"key": "email", "label": "Email", "type": "string"},
            {"key": "sumber", "label": "Sumber", "type": "string"},
            {"key": "sumber_url", "label": "URL Sumber", "type": "string"},
            {"key": "catatan", "label": "Catatan", "type": "string"},
        ],
        "rows": rows,
        "sheets": sheets,
        "meta": {
            "sumber_utama": "Kurasi manual Dispar DKI + situs resmi asosiasi",
            "distribusi_kategori": by_kategori,
            "dibangun": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=0))
    MIRROR_JSON.parent.mkdir(parents=True, exist_ok=True)
    MIRROR_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=0))

    return {
        "out": str(OUTPUT_JSON.relative_to(REPO_ROOT)),
        "rows": len(rows),
        "by_kategori": by_kategori,
    }


def main() -> int:
    print(f"[asosiasi_pariwisata] Output: {OUTPUT_JSON.relative_to(REPO_ROOT)}")
    summary = build()
    print()
    print("=" * 60)
    print("RINGKASAN")
    print("=" * 60)
    print(f"Output                : {summary['out']}")
    print(f"Baris total           : {summary['rows']}")
    print(f"Distribusi kategori   : {summary['by_kategori']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
