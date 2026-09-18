#!/usr/bin/env python3
"""Phase 2B (v2) — Inventaris venue water terkait di DKI + Seribu via Nominatim.

OSM Overpass mirror yang stabil untuk query global (overpass-api.de &
overpass.osm.ch) tidak konsisten punya data DKI. Nominatim forward-search
justru lebih andal untuk kategori ini. Rate-limit sopan: 1.2 s/request.

Query yang dipakai (12 kategori):
  water park, marina, jetski, wakeboard, banana boat, water adventure,
  Atlantis, Dunia Fantasi Splash, Waterbom, waterplay, water sport,
  diving jakarta, snorkeling jakarta.

Output: data/water-attractions-osm-additions.json — venue Nominatim yang
TIDAK ada di silver (dedup by nama + koordinat < 1 km). Tidak auto-merge.
"""
from __future__ import annotations
import json
import math
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path("/home/alfi/repos/DisparDataPlatform")
OUTPUT_FILE = REPO_ROOT / "data" / "water-attractions-osm-additions.json"
CACHE_FILE = REPO_ROOT / "scripts" / "water_attractions_intermediate.json"
CRAWL_CACHE = REPO_ROOT / "scripts" / "osm_water_attractions_cache.json"

NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = "DisparWaterAttractions/1.0 (research, dispar.rantai.dev)"
DKI_BBOX = (-6.51, 106.38, -5.30, 107.10)  # S, W, N, E (extended untuk Seribu)

# Heuristik kategori OSM yang relevan untuk dataset water attractions.
RELEVANT_TYPES = {
    ("leisure", "water_park"),
    ("leisure", "marina"),
    ("leisure", "resort"),
    ("tourism", "attraction"),
    ("tourism", "boat_rental"),
    ("amenity", "ferry_terminal"),  # pelabuhan rekreasi (mungkin)
}

# Query list — disusun dari tinjauan: kategori venue air umum + spesifik DKI.
QUERIES = [
    "water park jakarta",
    "water park kepulauan seribu",
    "waterbom jakarta",
    "water adventure jakarta",
    "Atlantis Water Adventure",
    "Dunia Fantasi Splash",
    "marina jakarta",
    "marina ancol",
    "jetski jakarta",
    "jetski pluit",
    "wakeboard jakarta",
    "banana boat jakarta",
    "wake park jakarta",
    "water sport jakarta",
    "diving jakarta",
    "scuba diving jakarta",
    "snorkeling jakarta",
    "diving center jakarta",
    "boat rental jakarta",
    "pantai mutiara jakarta",
    "pantai ancol",
    "pantai indah kapuk",
]


def in_bbox(lat: float, lon: float) -> bool:
    s, w, n, e = DKI_BBOX
    return s <= lat <= n and w <= lon <= e


def nominatim_search(q: str) -> list[dict]:
    params = {
        "q": q,
        "format": "json",
        "limit": "20",
        "countrycodes": "id",
        "viewbox": f"{DKI_BBOX[1]},{DKI_BBOX[2]},{DKI_BBOX[3]},{DKI_BBOX[0]}",
        "bounded": "1",
    }
    url = NOMINATIM + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        print(f"      HTTP {e.code} (rate-limit/koordinat); sleep 5 s")
        time.sleep(5)
        return []
    except Exception as e:
        print(f"      error: {e!r}")
        return []
    time.sleep(1.2)  # 1 req/s ToS
    return data if isinstance(data, list) else []


def haversine_km(a, b):
    R = 6371
    lat1, lon1 = a
    lat2, lon2 = b
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    x = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", s.lower())).strip()


def get_category(el: dict) -> tuple[str, str]:
    return (el.get("class", ""), el.get("type", ""))


def main():
    cache = json.loads(CACHE_FILE.read_text()) if CACHE_FILE.exists() else {"rows": []}
    silver_rows = cache.get("rows", [])
    silver_names = {norm(r["nama"]): r for r in silver_rows}
    silver_coords = [(r["latitude"], r["longitude"]) for r in silver_rows if r.get("latitude")]

    if CRAWL_CACHE.exists():
        per_query = json.loads(CRAWL_CACHE.read_text())
        print(f"  cache hit: {CRAWL_CACHE.relative_to(REPO_ROOT)} ({len(per_query)} queries cached)")
    else:
        per_query = {}
        for q in QUERIES:
            print(f"  q={q!r}")
            per_query[q] = nominatim_search(q)
        CRAWL_CACHE.write_text(json.dumps(per_query, ensure_ascii=False, indent=0))
        print(f"  fetched & cached: {len(per_query)} queries")

    seen_osm_ids = set()
    additions = []
    skipped_dup_name = []
    skipped_dup_geom = []
    skipped_no_bbox = []
    skipped_irrelevant = []
    by_query_count = {}
    for q, items in per_query.items():
        by_query_count[q] = 0
        for el in items:
            cls, typ = get_category(el)
            osm_id = el.get("osm_id")
            osm_type = el.get("osm_type")
            unique = (osm_type, osm_id)
            if unique in seen_osm_ids:
                continue
            # Filter kategori relevan; kalau penasaran, izinkan yang leisure / tourism
            if (cls, typ) not in RELEVANT_TYPES and cls not in {"leisure", "tourism", "amenity"}:
                skipped_irrelevant.append((q, f"{cls}/{typ}"))
                continue
            try:
                la, lo = float(el["lat"]), float(el["lon"])
            except (KeyError, ValueError):
                continue
            if not in_bbox(la, lo):
                skipped_no_bbox.append((q, el.get("display_name", "")[:50]))
                continue
            name = (el.get("display_name", "").split(",")[0]).strip() or "?"
            if not name or name == "?":
                continue
            if norm(name) in silver_names:
                skipped_dup_name.append((q, name))
                continue
            is_dup_geom = False
            for sc in silver_coords:
                if haversine_km((la, lo), sc) < 1.0:
                    is_dup_geom = True
                    break
            if is_dup_geom:
                skipped_dup_geom.append((q, name))
                continue
            seen_osm_ids.add(unique)
            by_query_count[q] += 1
            additions.append({
                "id": f"water-attr-jakarta-osm-{osm_type}-{osm_id}",
                "nama": name,
                "kategori_kemenpar": [],
                "kategori_osm": f"{cls}/{typ}",
                "alamat": el.get("display_name", ""),
                "latitude": la,
                "longitude": lo,
                "koordinat_status": "OK",
                "koordinat_sumber_silver_di_swap": False,
                "sumber": f"Nominatim ({cls}/{typ}) osm_{osm_type}_{osm_id}",
                "periode_data": None,
                "klasifikasi_potensi": "",
                "deskripsi_potensi": "",
                "pengelola": "",
                "telepon": "",
                "importance": el.get("importance"),
            })

    summary = {
        "added_candidates": len(additions),
        "skipped_dup_name": len(skipped_dup_name),
        "skipped_dup_geom": len(skipped_dup_geom),
        "skipped_no_bbox": len(skipped_no_bbox),
        "skipped_irrelevant": len(skipped_irrelevant),
        "skipped_dup_name_examples": skipped_dup_name[:10],
        "skipped_dup_geom_examples": skipped_dup_geom[:10],
        "added_by_category": by_query_count,
    }
    out = {"summary": summary, "rows": additions}
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=0))
    print("\n=== SUMMARY ===")
    for k, v in summary.items():
        if isinstance(v, list):
            print(f"  {k}: {len(v)} (contoh: {v[:3]})")
        elif isinstance(v, dict):
            nonzero = {k: v for k, v in v.items() if v}
            if nonzero:
                print(f"  {k}: {nonzero}")
        else:
            print(f"  {k}: {v}")
    print(f"\nOutput: {OUTPUT_FILE.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
