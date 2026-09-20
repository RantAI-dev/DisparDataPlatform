#!/usr/bin/env python3
"""Build dataset 'hotel-transit-jakarta'.

Hotel transit = hotel dalam buffer 5 km dari simpul transport utama DKI
(Bandara Soetta, stasiun KAI, terminal bus, halte MRT/LRT).

Strategi (setujui user):
  1. Basis: 120 hotel dari `platform-v2/data/hotel-jakarta.json` (registry
     resmi Satu Data Jakarta — tanpa koordinat).
  2. Geocode nama+alamat via Nominatim forward-search.
  3. Filter ke hotel yang punya jarak ≤ 5 km ke salah satu simpul transport.
  4. Simpan JSON + cache (idempotent, resume per-hotel).

Simpul transport:
  - Bandara Soekarno-Hatta
  - Stasiun KAI: Gambir, Pasar Senen, Jakarta Kota, Manggarai, Juanda
  - Terminal bus: Pulo Gebang, Kalideres, Tanjung Priok
  - Halte MRT/LRT: Blok M, Bundaran HI, Lebak Bulus, Senayan, dll.

Output:
  - data/sekunder/hotel-transit-jakarta.json    (format standar repo)
  - platform-v2/data/hotel-transit-jakarta.json (mirror untuk app)
  - scripts/hotel_transit_cache.json             (cache geocode)

Konvensi repo (lihat scripts/crawl_osm_wellness.py, scripts/build_water_attractions.py):
  - Path relatif dari root repo.
  - Cache JSON berisi status per hotel (untuk resume).
  - Simpan tiap batch, jangan di akhir.
  - Jalankan dari root, bukan dari scripts/.

Skrip ini TIDAK menyentuh lakehouse. Hasil hanya lokal.
"""
from __future__ import annotations

import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

HOTEL_SOURCE = REPO_ROOT / "platform-v2" / "data" / "hotel-jakarta.json"
OUTPUT_JSON = REPO_ROOT / "data" / "sekunder" / "hotel-transit-jakarta.json"
MIRROR_JSON = REPO_ROOT / "platform-v2" / "data" / "hotel-transit-jakarta.json"
CACHE_FILE = REPO_ROOT / "scripts" / "hotel_transit_cache.json"

NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = "DisparHotelTransitCrawler/1.0 (research, dispar.rantai.dev; +research@dispar.jakarta.go.id)"

# Buffer jarak (km) dari simpul transport
BUFFER_KM = 5.0

# Simpul transport utama DKI Jakarta. Tiap simpul punya nama, tipe, koordinat.
# Sumber koordinat: OSM Nominatim forward-search untuk nama publik yang baku.
# Hanya yang terverifikasi berada di dalam DKI atau area yang memang diakses
# dari Jakarta (mis. Bandara Soetta walaupun masuk Kab. Tangerang).
TRANSPORT_HUBS = [
    # Bandara
    {"id": "bandara-soetta", "nama": "Bandara Internasional Soekarno-Hatta", "tipe": "bandara", "lat": -6.125556, "lon": 106.655889},
    {"id": "bandara-halim", "nama": "Bandara Internasional Halim Perdanakusuma", "tipe": "bandara", "lat": -6.266389, "lon": 106.891111},
    # Stasiun KAI
    {"id": "stasiun-gambir", "nama": "Stasiun Gambir", "tipe": "stasiun-kai", "lat": -6.176667, "lon": 106.830833},
    {"id": "stasiun-pasar-senen", "nama": "Stasiun Pasar Senen", "tipe": "stasiun-kai", "lat": -6.174444, "lon": 106.844722},
    {"id": "stasiun-jakarta-kota", "nama": "Stasiun Jakarta Kota", "tipe": "stasiun-kai", "lat": -6.137222, "lon": 106.814722},
    {"id": "stasiun-manggarai", "nama": "Stasiun Manggarai", "tipe": "stasiun-kai", "lat": -6.209861, "lon": 106.850306},
    {"id": "stasiun-juanda", "nama": "Stasiun Juanda", "tipe": "stasiun-kai", "lat": -6.166667, "lon": 106.831111},
    {"id": "stasiun-tanjung-priok", "nama": "Stasiun Tanjung Priuk", "tipe": "stasiun-kai", "lat": -6.106111, "lon": 106.880833},
    # Terminal bus
    {"id": "terminal-pulo-gebang", "nama": "Terminal Pulo Gebang", "tipe": "terminal-bus", "lat": -6.194722, "lon": 106.929722},
    {"id": "terminal-kalideres", "nama": "Terminal Kalideres", "tipe": "terminal-bus", "lat": -6.166389, "lon": 106.701111},
    {"id": "terminal-tanjung-priok", "nama": "Terminal Tanjung Priok", "tipe": "terminal-bus", "lat": -6.106111, "lon": 106.880833},
    # MRT Jakarta (corridor 1: Lebak Bulus - Bundaran HI; fase 2A ke Kota)
    {"id": "mrt-lebak-bulus", "nama": "Stasiun MRT Lebak Bulus", "tipe": "mrt", "lat": -6.288333, "lon": 106.774722},
    {"id": "mrt-blok-m", "nama": "Stasiun MRT Blok M", "tipe": "mrt", "lat": -6.244167, "lon": 106.799444},
    {"id": "mrt-senayan", "nama": "Stasiun MRT Senayan", "tipe": "mrt", "lat": -6.224167, "lon": 106.806389},
    {"id": "mrt-istora", "nama": "Stasiun MRT Istora", "tipe": "mrt", "lat": -6.222222, "lon": 106.809722},
    {"id": "mrt-bendungan-hilir", "nama": "Stasiun MRT Bendungan Hilir", "tipe": "mrt", "lat": -6.216944, "lon": 106.815278},
    {"id": "mrt-setiabudi", "nama": "Stasiun MRT Setiabudi", "tipe": "mrt", "lat": -6.210833, "lon": 106.822222},
    {"id": "mrt-dukuh-atas", "nama": "Stasiun MRT Dukuh Atas", "tipe": "mrt", "lat": -6.207222, "lon": 106.826111},
    {"id": "mrt-bundaran-hi", "nama": "Stasiun MRT Bundaran HI", "tipe": "mrt", "lat": -6.201944, "lon": 106.831389},
    # LRT Jakarta (Kelapa Gading - Velodrome)
    {"id": "lrt-pegangsaan-dua", "nama": "Stasiun LRT Pegangsaan Dua", "tipe": "lrt", "lat": -6.146667, "lon": 106.913611},
    {"id": "lrt-kelapa-gading", "nama": "Stasiun LRT Kelapa Gading", "tipe": "lrt", "lat": -6.158056, "lon": 106.901944},
    {"id": "lrt-velodrome", "nama": "Stasiun LRT Velodrome", "tipe": "lrt", "lat": -6.186389, "lon": 106.893889},
    # LRT Jabodebek (Cibubur & Bekasi line) — beberapa station masuk DKI
    {"id": "lrt-jabodebek-jatimulya", "nama": "Stasiun LRT Jabodebek Jatimulya", "tipe": "lrt", "lat": -6.260833, "lon": 106.927778},
    {"id": "lrt-jabodebek-cililitan", "nama": "Stasiun LRT Jabodebek Cililitan", "tipe": "lrt", "lat": -6.262778, "lon": 106.866944},
]


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Jarak great-circle (km) antara dua titik (lat, lon)."""
    R = 6371.0
    lat1, lon1 = a
    lat2, lon2 = b
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    x = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def norm_name(name: str) -> str:
    """Normalisasi nama untuk konsistensi cache key."""
    s = re.sub(r"[^A-Z0-9 ]", " ", name.upper())
    s = re.sub(r"\s+", " ", s).strip()
    # Hapus awalan grup hotel yang tidak relevan untuk geocode
    for prefix in ["ACCOR ", "ARYADUTA ", "MARC ", "SWISS-BEL ", "IHG ", "MARRIOTT ",
                   "BEST WESTERN ", "BW ", "FAVE ", "FOX ", "HORISON ", "ZEST ", "AMARIS "]:
        if s.startswith(prefix):
            s = s[len(prefix):]
    return s


def clean_address(alamat: str) -> str:
    """Rapikan alamat: tambah 'Jakarta' kalau tidak ada, normalisasi spasi."""
    s = re.sub(r"\s+", " ", alamat.strip())
    # Tambah ', Jakarta' jika belum menyebut Jakarta / JKt / Daearah Khusus Ibukota
    if not re.search(r"jakarta|jkt|dki|daerah khusus ibukota", s, re.IGNORECASE):
        s = f"{s}, Jakarta"
    return s


def geocode_nominatim(query: str) -> dict | None:
    """Forward-search Nominatim; return dict {lat, lon, display_name} atau None."""
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


def load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))


def nearest_hub(lat: float, lon: float) -> tuple[dict, float]:
    """Return (simpul_terdekat, jarak_km)."""
    best = None
    best_d = float("inf")
    for hub in TRANSPORT_HUBS:
        d = haversine_km((lat, lon), (hub["lat"], hub["lon"]))
        if d < best_d:
            best_d = d
            best = hub
    return best, best_d


def find_nearby_hubs(lat: float, lon: float, buffer_km: float = BUFFER_KM) -> list[tuple[dict, float]]:
    """Return daftar (simpul, jarak_km) yang jaraknya ≤ buffer."""
    out = []
    for hub in TRANSPORT_HUBS:
        d = haversine_km((lat, lon), (hub["lat"], hub["lon"]))
        if d <= buffer_km:
            out.append((hub, d))
    out.sort(key=lambda x: x[1])
    return out


def build() -> dict:
    if not HOTEL_SOURCE.exists():
        raise SystemExit(f"sumber hotel tidak ditemukan: {HOTEL_SOURCE}")

    src = json.loads(HOTEL_SOURCE.read_text(encoding="utf-8"))
    hotels = src.get("registry", [])
    if not hotels:
        raise SystemExit("registry kosong di hotel-jakarta.json")

    cache = load_cache()
    rows: list[dict] = []
    skip_status = ("OK", "NOT_FOUND", "AMBIGUOUS")

    print(f"[build_hotel_transit] Total hotel di registry: {len(hotels)}")
    print(f"[build_hotel_transit] Buffer: {BUFFER_KM} km dari {len(TRANSPORT_HUBS)} simpul transport")

    geocoded_count = 0
    in_buffer_count = 0

    for i, hotel in enumerate(hotels, start=1):
        # Pakai nama|alamat sebagai key cache (alamat bisa beda walau nama sama)
        raw_name = hotel.get("nama", "").strip()
        alamat = hotel.get("alamat", "").strip()
        if not raw_name:
            continue
        cache_key = f"{norm_name(raw_name)}|{alamat[:80]}"

        cached = cache.get(cache_key)
        if cached and cached.get("status") in skip_status:
            geo = cached
        else:
            # 1. Coba nama + alamat (best signal)
            q1 = f"{raw_name}, {alamat}"
            result = geocode_nominatim(q1)
            # 2. Fallback: nama saja + 'Jakarta'
            if not result:
                result = geocode_nominatim(f"{raw_name} hotel Jakarta")
            # 3. Fallback: alamat saja
            if not result:
                result = geocode_nominatim(clean_address(alamat))

            time.sleep(1.1)  # ToS Nominatim: 1 req/s

            if result:
                geo = {
                    "status": "OK",
                    "lat": result["lat"],
                    "lon": result["lon"],
                    "display_name": result["display_name"],
                    "queried_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
                geocoded_count += 1
            else:
                geo = {
                    "status": "NOT_FOUND",
                    "queried_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
            cache[cache_key] = geo
            # Simpan tiap hotel
            save_cache(cache)

        # Tentukan apakah hotel ini masuk buffer
        if geo.get("status") == "OK":
            lat, lon = geo["lat"], geo["lon"]
            nearby = find_nearby_hubs(lat, lon)
            if nearby:
                in_buffer_count += 1
                nearest_hub_obj, nearest_d = nearby[0]
                # Format: gabungkan daftar simpul terdekat sbg string
                simpul_str = "; ".join(
                    f"{h['nama']} ({h['tipe']}, {d:.2f} km)"
                    for h, d in nearby[:5]  # tampilkan max 5 simpul terdekat
                )
                row = {
                    "id": f"hotel-transit-{norm_name(raw_name).lower().replace(' ', '-')[:60]}",
                    "nama_hotel": raw_name,
                    "golongan": hotel.get("golongan", ""),
                    "jenis_usaha": hotel.get("jenis_usaha", ""),
                    "kamar": hotel.get("kamar", 0),
                    "alamat": alamat,
                    "wilayah": hotel.get("wilayah", ""),
                    "latitude": lat,
                    "longitude": lon,
                    "koordinat_sumber": "Nominatim (OSM)",
                    "simpul_transit_terdekat": nearest_hub_obj["nama"],
                    "tipe_simpul_terdekat": nearest_hub_obj["tipe"],
                    "jarak_min_ke_simpul_km": round(nearest_d, 2),
                    "jumlah_simpul_dalam_buffer": len(nearby),
                    "daftar_simpul_dalam_5km": simpul_str,
                    "sumber_data_hotel": "Satu Data Jakarta — Rekapitulasi Usaha & Kamar Hotel",
                    "periode_data_hotel": hotel.get("periode", ""),
                    "catatan_verifikasi": "",
                }
                rows.append(row)

        # Log periodik
        if i % 10 == 0 or i == len(hotels):
            print(f"  [{i}/{len(hotels)}] cache entries: {len(cache)}, "
                  f"in-buffer: {in_buffer_count}")

    # Sort by jarak
    rows.sort(key=lambda r: r["jarak_min_ke_simpul_km"])

    # Susun metadata output
    out = {
        "slug": "hotel-transit-jakarta",
        "title": "Hotel Transit DKI Jakarta (≤5 km dari simpul transport)",
        "description": (
            f"Inventaris hotel dalam buffer {BUFFER_KM} km dari {len(TRANSPORT_HUBS)} simpul "
            "transport utama DKI Jakarta (bandara, stasiun KAI, terminal bus, halte MRT/LRT). "
            "Basis: registry 120 hotel resmi Satu Data Jakarta. Koordinat via Nominatim forward-search; "
            "hotel yang tidak bisa di-geocode ditandai di cache (lihat scripts/hotel_transit_cache.json)."
        ),
        "columns": [
            {"key": "id", "label": "ID", "type": "string"},
            {"key": "nama_hotel", "label": "Nama Hotel", "type": "string"},
            {"key": "golongan", "label": "Golongan", "type": "string"},
            {"key": "jenis_usaha", "label": "Jenis Usaha", "type": "string"},
            {"key": "kamar", "label": "Jumlah Kamar", "type": "number"},
            {"key": "alamat", "label": "Alamat", "type": "string"},
            {"key": "wilayah", "label": "Wilayah", "type": "string"},
            {"key": "latitude", "label": "Lintang", "type": "number"},
            {"key": "longitude", "label": "Bujur", "type": "number"},
            {"key": "koordinat_sumber", "label": "Sumber Koordinat", "type": "string"},
            {"key": "simpul_transit_terdekat", "label": "Simpul Transit Terdekat", "type": "string"},
            {"key": "tipe_simpul_terdekat", "label": "Tipe Simpul", "type": "string"},
            {"key": "jarak_min_ke_simpul_km", "label": "Jarak ke Simpul Terdekat (km)", "type": "number"},
            {"key": "jumlah_simpul_dalam_buffer", "label": "Jumlah Simpul dalam Buffer", "type": "number"},
            {"key": "daftar_simpul_dalam_5km", "label": "Daftar Simpul dalam 5 km", "type": "string"},
            {"key": "sumber_data_hotel", "label": "Sumber Data Hotel", "type": "string"},
            {"key": "periode_data_hotel", "label": "Periode Data Hotel", "type": "string"},
            {"key": "catatan_verifikasi", "label": "Catatan Verifikasi", "type": "string"},
        ],
        "rows": rows,
        "meta": {
            "buffer_km": BUFFER_KM,
            "total_hotel_di_registry": len(hotels),
            "total_hotel_ke_geocode": geocoded_count,
            "total_hotel_dalam_buffer": in_buffer_count,
            "jumlah_simpul_transport": len(TRANSPORT_HUBS),
            "simpul_transport": [{"id": h["id"], "nama": h["nama"], "tipe": h["tipe"]} for h in TRANSPORT_HUBS],
            "sumber_koordinat": "Nominatim (OSM) forward-search",
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
        "registry_count": len(hotels),
        "geocoded": geocoded_count,
        "in_buffer": in_buffer_count,
    }


def main() -> int:
    print(f"[build_hotel_transit] Sumber: {HOTEL_SOURCE.relative_to(REPO_ROOT)}")
    print(f"[build_hotel_transit] Cache : {CACHE_FILE.relative_to(REPO_ROOT)}")
    summary = build()
    print()
    print("=" * 60)
    print("RINGKASAN")
    print("=" * 60)
    print(f"Output                : {summary['out']}")
    print(f"Hotel di registry     : {summary['registry_count']}")
    print(f"Berhasil di-geocode   : {summary['geocoded']}")
    print(f"Masuk buffer (≤{BUFFER_KM} km): {summary['in_buffer']}")
    print(f"Baris output          : {summary['rows']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
