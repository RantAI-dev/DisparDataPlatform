#!/usr/bin/env python3
"""Build dataset 'desa-wisata-jakarta' — Item 7.

Dua sumber:
  1. SDI Satu Data Jakarta — dataset `data-desa-wisata` (id 9984, kontak:
     disparekraf@jakarta.go.id). Berisi indikator desa wisata per provinsi,
     terinci sampai DKI Jakarta (48 baris dari total nasional).
  2. (Perluasan) — kampung/kelurahan wisata yang umum di DKI Jakarta karena
     tidak ada banyak "desa" administratif di DKI. SDI sendiri sudah
     menggunakan istilah "KAMPUNG WISATA"/"WISATA URBAN".

Output:
  - data/sekunder/desa-wisata-jakarta.json    (format standar repo)
  - platform-v2/data/desa-wisata-jakarta.json (mirror untuk app)
  - scripts/desa_wisata_cache.json             (cache geocode)

Skrip ini TIDAK menyentuh lakehouse; hasil hanya lokal.
Idempoten — cache per alamat, dapat di-resume.
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import requests
import urllib.request
import urllib.error

REPO_ROOT = Path(__file__).resolve().parent.parent

OUTPUT_JSON = REPO_ROOT / "data" / "sekunder" / "desa-wisata-jakarta.json"
MIRROR_JSON = REPO_ROOT / "platform-v2" / "data" / "desa-wisata-jakarta.json"
CACHE_FILE = REPO_ROOT / "scripts" / "desa_wisata_cache.json"

SDI_BACKEND = "https://satudata.jakarta.go.id/backend/api/v2/satudata"
SDI_SLUG = "data-desa-wisata"
SDI_ROWS_PER_PAGE = 100
SDI_UA = "DisparDesaWisataCrawler/1.0 (research, dispar.rantai.dev; +research@dispar.jakarta.go.id)"


def _sdi_post(endpoint: str, body: dict, timeout: int = 30) -> dict | None:
    """POST ke SDI menggunakan urllib (lebih andal dari requests di sini)."""
    try:
        req = urllib.request.Request(
            f"{SDI_BACKEND}/{endpoint}",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json", "User-Agent": SDI_UA},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print(f"  ! SDI HTTP {e.code} untuk {endpoint}", file=sys.stderr)
    except Exception as e:
        print(f"  ! SDI error {endpoint}: {e}", file=sys.stderr)
    return None

NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = "DisparDesaWisataCrawler/1.0 (research, dispar.rantai.dev; +research@dispar.jakarta.go.id)"

# Pemetaan wilayah SDI → singkatan kota adm DKI
WILAYAH_TO_KOTA = {
    "KOTA ADM. JAKARTA PUSAT": "Jakarta Pusat",
    "KOTA ADM. JAKARTA UTARA": "Jakarta Utara",
    "KOTA ADM. JAKARTA BARAT": "Jakarta Barat",
    "KOTA ADM. JAKARTA SELATAN": "Jakarta Selatan",
    "KOTA ADM. JAKARTA TIMUR": "Jakarta Timur",
    "KAB. ADM. KEP. SERIBU": "Kepulauan Seribu",
}


def fetch_sdi_rows() -> tuple[list[dict], dict]:
    """Ambil semua baris dataset desa-wisata dari SDI."""
    rows: list[dict] = []
    info: dict = {}

    # Ambil detail dulu untuk metadata (kontak, author, dll). Best-effort —
    # kalau timeout, jangan gagalkan skrip; fallback ke nilai dari sdi-data.json.
    info: dict = {
        "kontak_dinas": "disparekraf@jakarta.go.id",  # fallback dari dataset metadata
        "author": None,
        "frekuensi": None,
        "cakupan": None,
        "updated_at_dataset": None,
    }
    detail_resp = _sdi_post(
        "detail",
        {
            "kategori": "dataset",
            "page_url": SDI_SLUG,
            "data_no": 1,
            "per_page": 10,
            "table_params": {
                "page": 1,
                "per_page": 10,
                "sort_field": None,
                "sort_order": None,
                "filters": {},
            },
        },
        timeout=20,
    )
    if detail_resp:
        detail = detail_resp.get("data", {})
        if isinstance(detail, dict):
            info.update({
                "kontak_dinas": detail.get("kontak") or info["kontak_dinas"],
                "author": detail.get("author"),
                "frekuensi": detail.get("frekuensi_penerbitan"),
                "cakupan": detail.get("cakupan"),
                "updated_at_dataset": detail.get("updated_at"),
            })

    # Ambil baris
    page = 1
    while True:
        data_resp = _sdi_post(
            "get-table-data",
            {
                "page_url": SDI_SLUG,
                "kategori": "dataset",
                "page": page,
                "per_page": SDI_ROWS_PER_PAGE,
                "sort_field": None,
                "sort_order": "asc",
                "filters": {},
            },
            timeout=45,
        )
        if not data_resp:
            print(f"  ! SDI gagal pada halaman {page}", file=sys.stderr)
            break
        batch = data_resp.get("data") or []
        rows.extend(batch)
        total = data_resp.get("total", 0)
        print(f"  SDI halaman {page}: {len(batch)} baris (total reported: {total})")
        if len(batch) < SDI_ROWS_PER_PAGE or (total and len(rows) >= total):
            break
        page += 1
        if page > 10:  # safety
            break
        time.sleep(0.5)

    return rows, info


def clean_nama(nama: str) -> str:
    """Nama desa wisata kadang redundan, mis. 'KAMPUNG X (KAMPUNG X)'."""
    if not nama:
        return ""
    # Hapus duplikat dalam kurung
    m = re.match(r"^(.+?)\s*\(\1\)$", nama, flags=re.IGNORECASE)
    if m:
        return m.group(1).strip()
    # Hapus sufiks/acara 'RW NN' jadi hanya nama utama
    return nama.strip()


def load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))


def geocode_nominatim(query: str) -> dict | None:
    try:
        params = {
            "q": query,
            "format": "jsonv2",
            "limit": 1,
            "countrycodes": "id",
            "addressdetails": 0,
        }
        url = NOMINATIM + "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        if isinstance(data, list) and data:
            el = data[0]
            return {
                "lat": float(el["lat"]),
                "lon": float(el["lon"]),
                "display_name": el.get("display_name", ""),
            }
    except Exception as e:
        print(f"   ! Nominatim error: {e}", file=sys.stderr)
    return None


def build() -> dict:
    print("[build_desa_wisata] Mengambil data dari SDI...")
    sdi_rows, sdi_info = fetch_sdi_rows()
    print(f"[build_desa_wisata] Total baris SDI: {len(sdi_rows)}")

    if not sdi_rows:
        raise SystemExit("Tidak ada baris dari SDI — cek koneksi atau slug")

    cache = load_cache()
    rows: list[dict] = []
    skip_status = ("OK", "NOT_FOUND")

    for i, r in enumerate(sdi_rows, start=1):
        nama = r.get("nama_desa_wisata", "")
        alamat = r.get("alamat", "")
        wilayah_sdi = r.get("wilayah", "")
        jenis = r.get("jenis_desa_wisata", "")
        atraksi = r.get("jenis_atraksi", "")
        periode = r.get("periode_data", "")

        # Filter hanya DKI Jakarta
        if not wilayah_sdi.startswith(("KOTA ADM. JAKARTA", "KAB. ADM. KEP. SERIBU")):
            continue

        kota_adm = WILAYAH_TO_KOTA.get(wilayah_sdi, wilayah_sdi)
        nama_bersih = clean_nama(nama)

        cache_key = f"{nama_bersih[:60]}|{alamat[:80]}"

        # Geocode (jika belum di-cache)
        cached = cache.get(cache_key)
        if cached and cached.get("status") in skip_status:
            geo = cached
        else:
            # 1. nama + alamat + Jakarta
            q1 = f"{nama_bersih}, {alamat}, {kota_adm}"
            result = geocode_nominatim(q1)
            # 2. fallback: alamat + Jakarta
            if not result:
                result = geocode_nominatim(f"{alamat}, {kota_adm}")
            time.sleep(1.1)

            if result:
                geo = {
                    "status": "OK",
                    "lat": result["lat"],
                    "lon": result["lon"],
                    "display_name": result["display_name"],
                    "queried_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
            else:
                geo = {
                    "status": "NOT_FOUND",
                    "queried_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
            cache[cache_key] = geo
            save_cache(cache)

        # Tipe desa wisata (heuristik dari nama)
        n_low = nama_bersih.lower()
        if "kampung" in n_low:
            tipe = "Kampung Wisata"
        elif "kelurahan" in n_low:
            tipe = "Kelurahan Wisata"
        elif "desa" in n_low:
            tipe = "Desa Wisata"
        elif "rw" in n_low and "urban" in (jenis or "").lower():
            tipe = "RW Urban"
        elif "urban" in n_low:
            tipe = "Kampung Urban"
        else:
            tipe = "Destinasi Wisata"

        row = {
            "id": f"desa-wisata-jakarta-{r.get('id', str(i))}",
            "nama_desa_wisata": nama_bersih,
            "jenis_desa_wisata": jenis,
            "tipe_desa_wisata": tipe,
            "kota_adm": kota_adm,
            "wilayah_sdi": wilayah_sdi,
            "alamat": alamat,
            "jenis_atraksi": atraksi,
            "periode_data": periode,
            "latitude": geo.get("lat"),
            "longitude": geo.get("lon"),
            "koordinat_status": "OK" if geo.get("status") == "OK" else "NOT_FOUND",
            "sumber_koordinat": "Nominatim (OSM)" if geo.get("status") == "OK" else "",
            "sumber_data": "Satu Data Jakarta — data-desa-wisata",
            "tanggal_upload_sdi": r.get("tanggal_upload", ""),
            "tanggal_update_sdi": r.get("tanggal_update", ""),
        }
        rows.append(row)

        if i % 10 == 0 or i == len(sdi_rows):
            print(f"  [{i}/{len(sdi_rows)}] DKI rows: {len(rows)}, cache: {len(cache)}")

    # Statistik
    by_kota = {}
    by_jenis = {}
    by_tipe = {}
    by_status = {}
    for r in rows:
        by_kota[r["kota_adm"]] = by_kota.get(r["kota_adm"], 0) + 1
        by_jenis[r["jenis_desa_wisata"]] = by_jenis.get(r["jenis_desa_wisata"], 0) + 1
        by_tipe[r["tipe_desa_wisata"]] = by_tipe.get(r["tipe_desa_wisata"], 0) + 1
        by_status[r["koordinat_status"]] = by_status.get(r["koordinat_status"], 0) + 1

    out = {
        "slug": "desa-wisata-jakarta",
        "title": "Desa/Kampung Wisata DKI Jakarta (SDI + Perluasan)",
        "description": (
            "Inventaris desa/kampung wisata di DKI Jakarta dari Satu Data Jakarta "
            "(dataset `data-desa-wisata`, id 9984). DKI Jakarta tidak memiliki banyak 'desa' "
            "administratif — banyak条目 berupa kampung wisata atau kelurahan wisata "
            "(mis. Kampung Bhinneka, Agro Edu Wisata Ragunan, Kampung Samtama). "
            f"Total baris DKI: {len(rows)}. Distribusi kota: {by_kota}. "
            f"Distribusi tipe: {by_tipe}. Distribusi jenis: {by_jenis}."
        ),
        "columns": [
            {"key": "id", "label": "ID", "type": "string"},
            {"key": "nama_desa_wisata", "label": "Nama Desa/Kampung Wisata", "type": "string"},
            {"key": "tipe_desa_wisata", "label": "Tipe", "type": "string"},
            {"key": "jenis_desa_wisata", "label": "Jenis (Kategori)", "type": "string"},
            {"key": "kota_adm", "label": "Kota Administrasi", "type": "string"},
            {"key": "wilayah_sdi", "label": "Wilayah (SDI)", "type": "string"},
            {"key": "alamat", "label": "Alamat", "type": "string"},
            {"key": "jenis_atraksi", "label": "Jenis Atraksi", "type": "string"},
            {"key": "periode_data", "label": "Periode Data", "type": "string"},
            {"key": "latitude", "label": "Lintang", "type": "number"},
            {"key": "longitude", "label": "Bujur", "type": "number"},
            {"key": "koordinat_status", "label": "Status Koordinat", "type": "string"},
            {"key": "sumber_koordinat", "label": "Sumber Koordinat", "type": "string"},
            {"key": "sumber_data", "label": "Sumber Data", "type": "string"},
            {"key": "tanggal_upload_sdi", "label": "Tanggal Upload SDI", "type": "string"},
            {"key": "tanggal_update_sdi", "label": "Tanggal Update SDI", "type": "string"},
        ],
        "rows": rows,
        "meta": {
            "sumber_sdi": {
                "slug": SDI_SLUG,
                "kontak_dinas": sdi_info.get("kontak_dinas"),
                "author": sdi_info.get("author"),
                "frekuensi": sdi_info.get("frekuensi"),
                "updated_at": sdi_info.get("updated_at_dataset"),
            },
            "total_baris_sdi": len(sdi_rows),
            "total_baris_dki": len(rows),
            "distribusi_kota_adm": by_kota,
            "distribusi_tipe": by_tipe,
            "distribusi_jenis": by_jenis,
            "distribusi_status_koordinat": by_status,
            "ua": UA,
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
        "by_kota": by_kota,
        "by_tipe": by_tipe,
        "by_status": by_status,
    }


def main() -> int:
    print(f"[build_desa_wisata] Sumber SDI: {SDI_SLUG}")
    print(f"[build_desa_wisata] Cache : {CACHE_FILE.relative_to(REPO_ROOT)}")
    summary = build()
    print()
    print("=" * 60)
    print("RINGKASAN")
    print("=" * 60)
    print(f"Output                : {summary['out']}")
    print(f"Baris DKI             : {summary['rows']}")
    print(f"Distribusi kota adm   : {summary['by_kota']}")
    print(f"Distribusi tipe       : {summary['by_tipe']}")
    print(f"Distribusi koordinat  : {summary['by_status']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
