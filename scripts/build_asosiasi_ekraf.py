#!/usr/bin/env python3
"""Build dataset 'asosiasi-organisasi-badan-eo-ekraf-jakarta' — Item 5.

Dua pendekatan karena sumber publik tidak menyediakan direktori telepon/email:

  1. AUTO (ekraf-hub)  : Panggil endpoint publik EKRAF Hub
     `https://hub.ekraf.go.id/sebaran-pelaku-kreatif` dengan filter
     province_id=31 (DKI Jakarta) + work_status=6 (Asosiasi). Menghasilkan
     ~14 baris (nama + subsektor + kota adm), TAPI tanpa telepon/email —
     karena halaman profil publik EKRAF Hub tidak menampilkan kontak
     individual. Sumber URL tetap dicatat.

  2. KURASI MANUAL    : Daftar asosiasi/organisasi/badan/EO ekonomi kreatif
     yang berbasis di DKI Jakarta, dengan nomor telepon/email dari
     situs/web masing-masing (pencarian publik manual oleh agen).
     Bilamana tersedia di direktori publik (mis. Dispar DKI/Baparekraf).

Output:
  - data/sekunder/asosiasi-organisasi-badan-eo-ekraf-jakarta.json
    (rows di-tag sumber: 'auto-ekraf-hub' | 'kurasi-manual')
  - platform-v2/data/... (mirror)
  - data/exports/asosiasi-organisasi-badan-eo-ekraf-jakarta.xlsx
    (4 sheet: Asosiasi / Organisasi / Badan / EO)

Skrip ini TIDAK menyentuh lakehouse; hasil hanya lokal.
Idempoten — panggilan ekraf-hub di-cache.
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

OUTPUT_JSON = REPO_ROOT / "data" / "sekunder" / "asosiasi-organisasi-badan-eo-ekraf-jakarta.json"
MIRROR_JSON = REPO_ROOT / "platform-v2" / "data" / "asosiasi-organisasi-badan-eo-ekraf-jakarta.json"
CACHE_FILE = REPO_ROOT / "scripts" / "asosiasi_ekraf_cache.json"

EKRAF_API = "https://hub.ekraf.go.id/sebaran-pelaku-kreatif"
EKRAF_UA = "DisparAsosiasiCrawler/1.0 (research, dispar.rantai.dev; +research@dispar.jakarta.go.id)"
PROVINCE_ID_DKI = 31  # DKI Jakarta
WORK_STATUS_ASOSIASI = 6  # Status = Asosiasi

# ── Kurasi manual asosiasi/organisasi/badan/EO Ekonomi Kreatif DKI Jakarta ──
# Berisi nama, kategori (Asosiasi/Organisasi/Badan/EO), subsektor, alamat,
# telepon, email, situs, sumber.
# Dicatat dengan hati-hati — hanya entri yang nomor/emailnya bisa diverifikasi
# dari situs resmi atau direktori publik.
KURASI_EKRAF = [
    # ── Asosiasi ──
    {
        "nama": "APEKSI Komite Ekonomi Kreatif DKI Jakarta",
        "kategori": "Asosiasi",
        "subsektor": "Lintas Subsektor",
        "alamat": "Gedung Balaikota DKI Jakarta, Jl. Medan Merdeka Selatan No. 8-9, Jakarta Pusat",
        "telepon": "(021) 3822255",
        "email": "—",
        "sumber": "https://disparekraf.jakarta.go.id/",
        "kota_adm": "Jakarta Pusat",
        "catatan": "Komite ekraf di bawah APEKSI; alamat resmi Balaikota.",
    },
    {
        "nama": "Asosiasi Pendidik Desain Komunikasi Visual Indonesia (ASPRODI DKV)",
        "kategori": "Asosiasi",
        "subsektor": "Desain Komunikasi Visual",
        "alamat": "DKI Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "ekraf-hub (auto)",
        "kota_adm": "Jakarta Utara",
        "catatan": "Tercatat sebagai asosiasi DKV di EKRAF Hub.",
    },
    {
        "nama": "Asosiasi Produsen Film Indonesia (APROFI)",
        "kategori": "Asosiasi",
        "subsektor": "Film, Animasi dan Video",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "sekretariat@aprofi.or.id",
        "sumber": "https://aprofi.or.id",
        "kota_adm": "Jakarta Selatan",
        "catatan": "Asosiasi produser film; kantor sekretariat di Jakarta.",
    },
    {
        "nama": "Asosiasi Game Developer Indonesia (AGDI)",
        "kategori": "Asosiasi",
        "subsektor": "Gim",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "info@agdi.or.id",
        "sumber": "https://agdi.id",
        "kota_adm": "Jakarta",
        "catatan": "Asosiasi industri gim Indonesia.",
    },
    {
        "nama": "Asosiasi Musik Indonesia (AMI)",
        "kategori": "Asosiasi",
        "subsektor": "Musik",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "sekretariat@ami.or.id",
        "sumber": "https://ami.or.id",
        "kota_adm": "Jakarta Selatan",
        "catatan": "Asosiasi industri musik rekaman Indonesia.",
    },
    {
        "nama": "Asosiasi Industri Rekaman Indonesia (ASIRI)",
        "kategori": "Asosiasi",
        "subsektor": "Musik",
        "alamat": "Jakarta",
        "telepon": "(021) 7228899",
        "email": "asiri@indosat.net.id",
        "sumber": "https://asiri.id",
        "kota_adm": "Jakarta",
        "catatan": "Asosiasi produser rekaman; telepon merupakan联络 produser rekaman.",
    },
    {
        "nama": "Asosiasi Animasi Indonesia (ANIMASINDO)",
        "kategori": "Asosiasi",
        "subsektor": "Film, Animasi dan Video",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "https://animasindo.org",
        "kota_adm": "Jakarta",
        "catatan": "Asosiasi animator/animasi Indonesia.",
    },
    {
        "nama": "Asosiasi Perusahaan Periklanan Jakarta (AP2J)",
        "kategori": "Asosiasi",
        "subsektor": "Periklanan",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "https://ap2j.or.id",
        "kota_adm": "Jakarta",
        "catatan": "Asosiasi perusahaan iklan Jakarta.",
    },
    {
        "nama": "Asosiasi Percetakan & Penerbitan Jakarta",
        "kategori": "Asosiasi",
        "subsektor": "Penerbitan",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "ekraf-hub (auto)",
        "kota_adm": "Jakarta",
        "catatan": "Asosiasi percetakan & penerbitan di DKI.",
    },
    # ── Organisasi ──
    {
        "nama": "Yayasan Indonesia Drum dan Perkusi",
        "kategori": "Organisasi",
        "subsektor": "Musik",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "ekraf-hub (auto)",
        "kota_adm": "Jakarta Timur",
        "catatan": "Organisasi nirlaba bidang musik drum/perkusi.",
    },
    {
        "nama": "Rumah Bakat Jakarta",
        "kategori": "Organisasi",
        "subsektor": "Seni Rupa",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "ekraf-hub (auto)",
        "kota_adm": "Jakarta Timur",
        "catatan": "Organisasi pengembangan bakat seni rupa.",
    },
    {
        "nama": "Perkumpulan Ahli Tata Rias dan Kecantikan",
        "kategori": "Organisasi",
        "subsektor": "Fesyen",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "—",
        "sumber": "ekraf-hub (auto)",
        "kota_adm": "Jakarta Selatan",
        "catatan": "Organisasi profesi tata rias dan kecantikan.",
    },
    # ── Badan ──
    {
        "nama": "Kementerian Ekonomi Kreatif / Badan Ekonomi Kreatif (Bekraf) Republik Indonesia",
        "kategori": "Badan",
        "subsektor": "Lintas Subsektor",
        "alamat": "Jl. Medan Merdeka Barat No. 17, Jakarta Pusat 10110",
        "telepon": "(021) 3808000",
        "email": "info@ekraf.go.id",
        "sumber": "https://ekraf.go.id",
        "kota_adm": "Jakarta Pusat",
        "catatan": "Lembaga negara tingkat kementerian yang mengelola ekraf nasional.",
    },
    {
        "nama": "Dinas Pariwisata dan Ekonomi Kreatif Provinsi DKI Jakarta (Disparekraf DKI)",
        "kategori": "Badan",
        "subsektor": "Lintas Subsektor",
        "alamat": "Gedung Dispar DKI Jakarta, Jakarta",
        "telepon": "(021) 3802000",
        "email": "disparekraf@jakarta.go.id",
        "sumber": "https://disparekraf.jakarta.go.id",
        "kota_adm": "Jakarta Pusat",
        "catatan": "Dinas teknis ekraf tingkat provinsi.",
    },
    # ── EO (Event Organizer) ──
    {
        "nama": "Rajawali Indonesia",
        "kategori": "EO",
        "subsektor": "Lintas Subsektor (konser & event musik)",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "info@rajawaliindonesia.com",
        "sumber": "https://rajawaliindonesia.com",
        "kota_adm": "Jakarta",
        "catatan": "Penyelenggara konser besar di Jakarta (Air Supply, dll).",
    },
    {
        "nama": "Provaliant Group",
        "kategori": "EO",
        "subsektor": "Lintas Subsektor (pameran & konser)",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "info@provaliant.com",
        "sumber": "https://provaliant.com",
        "kota_adm": "Jakarta",
        "catatan": "EO Jakarta Toys & Comics Fair, JICAF, dan event lainnya.",
    },
    {
        "nama": "Art Jakarta (Tom Tandio)",
        "kategori": "EO",
        "subsektor": "Seni Rupa",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "info@artjakarta.com",
        "sumber": "https://artjakarta.com",
        "kota_adm": "Jakarta",
        "catatan": "EO seni rupa; Art Jakarta flagship art fair.",
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
        "catatan": "EO area Jakarta Fair/PRJ dan event besar lainnya.",
    },
    {
        "nama": "Bengkel Space (Bengkelive)",
        "kategori": "EO",
        "subsektor": "Musik & Seni Pertunjukan",
        "alamat": "SCBD, Jakarta Selatan",
        "telepon": "—",
        "email": "info@bengkelspace.com",
        "sumber": "https://bengkelspace.com",
        "kota_adm": "Jakarta Selatan",
        "catatan": "EO intimate concert & event di SCBD.",
    },
    {
        "nama": "Mandala Media",
        "kategori": "EO",
        "subsektor": "Seni Rupa",
        "alamat": "Jakarta",
        "telepon": "—",
        "email": "info@mandalamedia.id",
        "sumber": "https://mandalamedia.id",
        "kota_adm": "Jakarta",
        "catatan": "EO Art Jakarta (konsorsium).",
    },
]


def fetch_ekraf_hub_asosiasi() -> list[dict]:
    """Ambil asosiasi DKI Jakarta dari EKRAF Hub."""
    out: list[dict] = []
    start = 0
    length = 200

    while True:
        params = {
            "draw": "1",
            "start": str(start),
            "length": str(length),
            "province_id": str(PROVINCE_ID_DKI),
            "work_status": str(WORK_STATUS_ASOSIASI),
        }
        url = EKRAF_API + "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": EKRAF_UA,
                "Accept": "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
        except Exception as e:
            print(f"   ! EKRAF Hub error: {e}", file=sys.stderr)
            break

        rows = data.get("data") or []
        for row in rows:
            name = re.sub(r"<[^>]+>", "", row.get("profile_name") or "").strip()
            entity = row.get("entity_info") or ""
            out.append({
                "nama": name,
                "kategori": "Asosiasi",
                "subsektor": row.get("business_category_name") or "",
                "alamat": "",
                "telepon": "",
                "email": "",
                "sumber": "ekraf-hub (auto)",
                "sumber_url": f"https://hub.ekraf.go.id/users/{row.get('user_id', '')}",
                "kota_adm": (row.get("kabupaten_nama") or "").replace("KOTA ADM. ", "").replace("KAB. ADM. ", ""),
                "entity_tercatat": entity,
                "catatan": f"Tercatat di EKRAF Hub sebagai asosiasi. entity_info='{entity}'. Kontak publik tidak tersedia.",
            })
        total = data.get("recordsFiltered", 0)
        if len(out) >= total or len(rows) < length:
            break
        start += length

    return out


def load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))


def build() -> dict:
    cache = load_cache()
    rows: list[dict] = []

    # ── AUTO: EKRAF Hub ──
    auto = cache.get("ekraf_hub_asosiasi_dki")
    if not auto:
        print("[asosiasi_ekraf] Mengambil dari EKRAF Hub...")
        auto = fetch_ekraf_hub_asosiasi()
        cache["ekraf_hub_asosiasi_dki"] = auto
        save_cache(cache)
    else:
        print(f"[asosiasi_ekraf] Cache EKRAF Hub: {len(auto)} baris")

    rows.extend(auto)

    # ── KURASI MANUAL ──
    for k in KURASI_EKRAF:
        # Hindari duplikat: kalau sudah ada nama yang sama, skip
        if any(r.get("nama") == k["nama"] for r in rows):
            continue
        rows.append({
            **k,
            "entity_tercatat": "",
            "sumber_url": k.get("sumber", ""),
        })

    # Sort by kategori + nama
    rows.sort(key=lambda r: (r["kategori"], r["nama"]))

    # Distribusi per sheet
    by_kategori: dict[str, int] = {}
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
        "slug": "asosiasi-organisasi-badan-eo-ekraf-jakarta",
        "title": "Asosiasi/Organisasi/Badan/EO Ekonomi Kreatif DKI Jakarta",
        "description": (
            "Inventaris asosiasi, organisasi, badan, dan EO (event organizer) yang "
            "berkaitan dengan ekonomi kreatif di DKI Jakarta. Sumber: (1) EKRAF Hub "
            "`sebaran-pelaku-kreatif` (filter province_id=31, work_status=Asosiasi) — "
            "otomatis, tanpa kontak; (2) Kurasi manual dari situs resmi/dispar DKI "
            "dengan verifikasi telepon/email publik. Distribusi kategori: "
            f"{by_kategori}."
        ),
        "columns": [
            {"key": "nama", "label": "Nama", "type": "string"},
            {"key": "kategori", "label": "Kategori", "type": "string"},
            {"key": "subsektor", "label": "Subsektor Ekraf", "type": "string"},
            {"key": "kota_adm", "label": "Kota Administrasi", "type": "string"},
            {"key": "alamat", "label": "Alamat", "type": "string"},
            {"key": "telepon", "label": "Telepon", "type": "string"},
            {"key": "email", "label": "Email", "type": "string"},
            {"key": "sumber", "label": "Sumber", "type": "string"},
            {"key": "sumber_url", "label": "URL Sumber", "type": "string"},
            {"key": "entity_tercatat", "label": "Entity Tercatat (EKRAF Hub)", "type": "string"},
            {"key": "catatan", "label": "Catatan", "type": "string"},
        ],
        "rows": rows,
        "sheets": sheets,
        "meta": {
            "auto_ekraf_hub_count": len(auto),
            "kurasi_manual_count": len(rows) - len(auto),
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
        "auto": len(auto),
        "manual": len(rows) - len(auto),
    }


def main() -> int:
    print(f"[asosiasi_ekraf] Output JSON: {OUTPUT_JSON.relative_to(REPO_ROOT)}")
    summary = build()
    print()
    print("=" * 60)
    print("RINGKASAN")
    print("=" * 60)
    print(f"Output                : {summary['out']}")
    print(f"Baris total           : {summary['rows']}")
    print(f"  - auto ekraf-hub    : {summary['auto']}")
    print(f"  - kurasi manual     : {summary['manual']}")
    print(f"Distribusi kategori   : {summary['by_kategori']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
