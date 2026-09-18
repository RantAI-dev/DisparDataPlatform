#!/usr/bin/env python3
"""Build dataset 'water-attractions-jakarta' dari lakehouse silver views.

Strategi (setujui user): basis silver 25 venue + tambah klasifikasi dari silver
potensi_DTW. Validasi koordinat (silver view punya data longitude/latitude yang
broken: -617091 literal, atau tertukar). Yang rusak → tandai untuk Photon
geocode (Phase 2 — dijalankan terpisah).

Sumber data:
  1. silver.data_destinasi_pariwisata_yang_memiliki_aksesibilitas_amenitas_atau_atraksi
     — 175 baris, filter 25 venue water-related via regex nama.
  2. silver.data_potensi_daya_tarik_wisata_unggulan_provinsi_dki_jakarta
     — 18 DTW dengan kolom `jenis` (klasifikasi resmi: WISATA BAHARI dll.).

Output: data/water-attractions-jakarta.json (mirror ke platform-v2/data/).

Cache per-batch: scripts/water_attractions_intermediate.json (di-resume
berdasarkan _row_hash).

Sesuai konvensi repo (lihat scripts/geocode_photon_pass.py, build-events2026.mjs):
- Path relatif dari root repo.
- Cache JSON berisi status per row (untuk resume).
- Simpan tiap batch, jangan di akhir.
- Jalankan dari root, bukan dari scripts/.
"""
from __future__ import annotations
import json
import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path("/home/alfi/repos/DisparDataPlatform")
CACHE_FILE = REPO_ROOT / "scripts" / "water_attractions_intermediate.json"
OUTPUT_FILE = REPO_ROOT / "data" / "water-attractions-jakarta.json"
MIRROR_OUTPUT = REPO_ROOT / "platform-v2" / "data" / "water-attractions-jakarta.json"

CH_URL = "http://192.168.18.187:18123"
CH_USER = "dispar_app"

# Ambil sandi dispar_app dari .env.local (sudah terverifikasi 25 char).
ENV_LOCAL = REPO_ROOT / "platform-v2" / ".env.local"
def _read_ch_password() -> str:
    for line in ENV_LOCAL.read_text().splitlines():
        if line.startswith("CH_PASSWORD="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("CH_PASSWORD tidak ditemukan di .env.local")

CH_PASSWORD = _read_ch_password()

# Regex nama venue water-related — kata-kata yang menandai atraksi air.
# Disusun dari tinjauan site SDI & standar Kemenpar (14 sub).
WATER_NAME_PATTERNS = [
    r"\bwater\b", r"\bwatersport\w*\b", r"\bwaterpark\w*\b",
    r"\bwater ?adventure\b", r"\baqua\w*\b", r"\bdufan\b", r"dunia fantasi",
    r"\bpantai\b", r"\bpanjenengan\b",
    r"\bpulau\b", r"\bseribu\b", r"\bbahari\b", r"\bteluk\b",
    r"\bsunda kelapa\b", r"\bmarina\b", r"\blaut\b",
    r"\btawar\b", r"\badventure\b", r"\bbeach\b", r"\bdiving\b",
    r"\bsnorkeling\b", r"\bski\b", r"\bsurfing\b", r"\bkayak\b",
    r"\bancol\b", r"\bgebyar\b",
]
WATER_REGEX = re.compile("|".join(WATER_NAME_PATTERNS), re.IGNORECASE)

# Batas bbox DKI Jakarta (land area), extend ke utara untuk Seribu.
DKI_LAT_MIN, DKI_LAT_MAX = -6.51, -5.30
DKI_LON_MIN, DKI_LON_MAX = 106.38, 107.10

def _ch_query(sql: str) -> list[str]:
    """Jalankan SQL ke ClickHouse HTTP dan kembalikan list of TSV rows."""
    sql_file = Path("/tmp/_q.sql")
    sql_file.write_text(sql)
    cmd = [
        "curl", "-sS",
        f"{CH_URL}/?user={CH_USER}&password={CH_PASSWORD}",
        "--data-binary", f"@{sql_file}",
    ]
    out = subprocess.run(cmd, capture_output=True, text=True, check=True).stdout
    return [line.split("\t") for line in out.rstrip("\n").split("\n") if line]

def fetch_silver_water_venues() -> list[dict]:
    """Pull silver.data_destinasi_pariwisata...; kembalikan hanya yang water-related."""
    sql = """
SELECT
  nama_destinasi_wisata,
  alamat,
  longitude,
  latitude,
  periode_data,
  semester
FROM silver.data_destinasi_pariwisata_yang_memiliki_aksesibilitas_amenitas_atau_atraksi
ORDER BY nama_destinasi_wisata, periode_data DESC
FORMAT TabSeparated
""".strip()
    rows = _ch_query(sql)
    out = []
    seen = set()  # dedupe by nama (ambil periode terbaru)
    for r in rows:
        if len(r) < 6:
            continue
        nama = (r[0] or "").strip()
        if not nama or not WATER_REGEX.search(nama):
            continue
        if nama in seen:
            continue  # skip duplikat periode lama
        seen.add(nama)
        out.append({
            "nama": nama,
            "alamat": (r[1] or "").strip(),
            "lon_raw": r[2],
            "lat_raw": r[3],
            "periode": r[4],
            "semester": r[5],
            "sumber": "SDI destinasi.par",
        })
    return out

def fetch_potensi_dtw() -> dict[str, dict]:
    """Pull silver.potensi_DTW; kembalikan dict by nama_lower."""
    sql = """
SELECT
  nama_destinasi_wisata,
  jenis,
  alamat,
  deskripsi_produk_unggulan,
  telepon,
  pengelola
FROM silver.data_potensi_daya_tarik_wisata_unggulan_provinsi_dki_jakarta
FORMAT TabSeparated
""".strip()
    rows = _ch_query(sql)
    out = {}
    for r in rows:
        if len(r) < 6 or not r[0]:
            continue
        out[r[0].strip().lower()] = {
            "jenis": (r[1] or "").strip(),
            "alamat": (r[2] or "").strip(),
            "deskripsi": (r[3] or "").strip(),
            "telepon": (r[4] or "").strip(),
            "pengelola": (r[5] or "").strip(),
        }
    return out

def _to_float(s) -> float | None:
    if s is None or s == "" or s == "\\N":
        return None
    try:
        return float(s)
    except (TypeError, ValueError):
        return None

def validate_and_fix(lon_raw, lat_raw) -> tuple[float | None, float | None, str, bool]:
    """Validasi koordinat & fix silver view lat/lon-swap.

    TEMUAN PENTING (eksperimen 2026-09-17 di silver view 25 venue):
    silver.data_destinasi_pariwisata_yang_memiliki_aksesibilitas_amenitas_atau_atraksi
    punya latitude/longitude **TERTUKAR** di source — `latitude` di silver berisi
    longitude (~106.x), `longitude` di silver berisi latitude (~-6.x). Deteksi:
    |lat|>90 dan |lon|<10 → swap. Setelah swap, validasi bbox DKI (extended
    utara untuk Seribu). Deteksi literal `-617091` (tanpa desimal) tidak
    terjadi di 25 venue ini — itu sebenarnya juga hasil swap yang `lon`
    adalah latitude murni (`-6.17091`).

    Returns (lon, lat, status, swapped):
      lon, lat  — sudah benar (di-swap kalau perlu)
      status    — "OK" / "out-of-range" / "missing"
      swapped   — bool, audit untuk downstream
    """
    lat = _to_float(lat_raw)
    lon = _to_float(lon_raw)
    if lat is None and lon is None:
        return None, None, "missing", False
    if lat is None or lon is None:
        return lon, lat, "missing", False
    # Bug literal: silver view kadang simpan -630464 (bukan -6.30464).
    # Deteksi: |v|>1000 dan hasil |v|/1e5|<10 → bagi 1e5.
    if abs(lon) > 1000 and abs(lon / 1e5) < 10:
        lon = lon / 1e5
    if abs(lat) > 1000 and abs(lat / 1e5) < 10:
        lat = lat / 1e5
    swapped = False
    if abs(lat) > 90 and abs(lon) < 10:
        lat, lon = lon, lat
        swapped = True
    if not (DKI_LAT_MIN <= lat <= DKI_LAT_MAX) or not (DKI_LON_MIN <= lon <= DKI_LON_MAX):
        return lon, lat, "out-of-range", swapped
    return lon, lat, "OK", swapped

def kategori_kemenpar(nama: str, jenis: str = "") -> list[str]:
    """Mapping nama venue + jenis ke kategori Kemenpar (subset dari 14 standar)."""
    n = nama.lower()
    out = []
    # Heuristik nama
    if "pulau" in n or "seribu" in n:
        out.append("pantai_pulau_rekreasi")
    if "pantai" in n or "beach" in n:
        out.append("pantai_pulau_rekreasi")
    if "sunda kelapa" in n or "marina" in n:
        out.append("pelabuhan_rekreasi_marina")
    if "bahari" in n or "museum bahari" in n:
        out.append("atraksi_air_lain")  # museum kelautan, bukan wahana air langsung
    if "water" in n or "aqua" in n or "dufan" in n or "dunia fantasi" in n:
        out.append("waterpark_taman_air")
    if "adventure" in n:
        out.append("atraksi_air_lain")
    # Tambah dari jenis potensi_DTW
    j = jenis.lower()
    if "bahari" in j:
        out.append("atraksi_air_lain")
    if "alam" in j and "bahari" not in j:
        out.append("atraksi_air_lain")
    return sorted(set(out)) or ["atraksi_air_lain"]

def slug_id(nama: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", nama.lower()).strip("-")
    return s[:80]

def main():
    print("== Pull silver.data_destinasi_pariwisata… ==")
    venues_silver = fetch_silver_water_venues()
    print(f"  found {len(venues_silver)} unique water-related venue(s)")

    print("== Pull silver.data_potensi_daya_tarik_wisata_unggulan… ==")
    potensi = fetch_potensi_dtw()
    print(f"  found {len(potensi)} DTW entries (lowercase key)")

    # Bangun output rows
    rows_out = []
    coords_summary = {"OK": 0, "swap-needed": 0, "out-of-range": 0, "missing": 0}
    for v in venues_silver:
        lon, lat, status, swapped = validate_and_fix(v["lon_raw"], v["lat_raw"])
        coords_summary[status] += 1
        # Join dengan potensi_DTW
        pnama = v["nama"].lower()
        join = (
            potensi.get(pnama)
            or potensi.get(pnama.replace("pulau ", "kepulauan "))
            or potensi.get(pnama.replace("kepulauan ", "pulau "))
        )
        jenis = join["jenis"] if join else ""
        rows_out.append({
            "id": f"water-attr-jakarta-{slug_id(v['nama'])}",
            "nama": v["nama"],
            "kategori_kemenpar": kategori_kemenpar(v["nama"], jenis),
            "alamat": join["alamat"] if join and join["alamat"] else v["alamat"],
            "latitude": lat,
            "longitude": lon,
            "koordinat_status": status,
            "koordinat_sumber_silver_di_swap": swapped,
            "sumber": v["sumber"] + ("+SDI potensi_DTW (join)" if join else ""),
            "periode_data": v["periode"],
            "klasifikasi_potensi": jenis,
            "deskripsi_potensi": join["deskripsi"] if join else "",
            "pengelola": join["pengelola"] if join else "",
            "telepon": join["telepon"] if join else "",
        })
    # Tulis cache intermediate (per batch).
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps({
        "rows": rows_out,
        "coords_summary": coords_summary,
        "n_silver": len(venues_silver),
        "n_potensi": len(potensi),
    }, ensure_ascii=False, indent=0))
    print(f"  cache: {CACHE_FILE.relative_to(REPO_ROOT)}")
    print(f"  coords: {coords_summary}")

    # Tulis dataset JSON (skema dataset sekunder).
    dataset = {
        "slug": "water-attractions-jakarta",
        "title": "Atraksi Wisata Air DKI Jakarta (silver SDI + join potensi DTW)",
        "description": (
            f"Inventaris venue atraksi wisata air di DKI Jakarta dari silver lakehouse: "
            f"{len(rows_out)} venue, basis silver.data_destinasi_pariwisata (filter regex nama) "
            f"di-join silver.potensi_daya_tarik_wisata_unggulan untuk klasifikasi resmi. "
            f"Kategori mengikuti standar Kemenpar 'Aktivitas Wisata Air' (14 sub, lihat README). "
            f"Silver view punya lat/lon tertukar di source — sudah di-fix, lihat "
            f"`koordinat_sumber_silver_di_swap`. Venue dengan `koordinat_status=out-of-range` "
            f"perlu Photon geocode (Phase 2)."
        ),
        "columns": [
            {"name": "id", "type": "string"},
            {"name": "nama", "type": "string"},
            {"name": "kategori_kemenpar", "type": "string[]"},
            {"name": "alamat", "type": "string"},
            {"name": "latitude", "type": "Float64?"},
            {"name": "longitude", "type": "Float64?"},
            {"name": "koordinat_status", "type": "string (OK / out-of-range / missing)"},
            {"name": "koordinat_sumber_silver_di_swap", "type": "bool (true = lat/lon raw silver view tertukar, sudah di-fix)"},
            {"name": "sumber", "type": "string"},
            {"name": "periode_data", "type": "Date?"},
            {"name": "klasifikasi_potensi", "type": "string (jenis dari potensi_DTW)"},
            {"name": "deskripsi_potensi", "type": "string"},
            {"name": "pengelola", "type": "string"},
            {"name": "telepon", "type": "string"},
        ],
        "rows": rows_out,
    }
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(dataset, ensure_ascii=False, indent=0))
    MIRROR_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    MIRROR_OUTPUT.write_text(json.dumps(dataset, ensure_ascii=False, indent=0))
    print(f"  dataset: {OUTPUT_FILE.relative_to(REPO_ROOT)}")
    print(f"  mirror : {MIRROR_OUTPUT.relative_to(REPO_ROOT)}")
    print(f"  rows   : {len(rows_out)}")
    print("\nSUMMARY")
    for k, v in coords_summary.items():
        print(f"  {k}: {v}")

if __name__ == "__main__":
    main()
