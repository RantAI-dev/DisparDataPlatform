#!/usr/bin/env python3
"""Phase 2A — Photon geocode venue dengan koordinat rusak dari Phase 1.

Sumber venue rusak: scripts/water_attractions_intermediate.json filter
`koordinat_status=out-of-range`. Untuk tiap venue, Photon forward search
"{nama}, Jakarta, Indonesia" + validasi bbox DKI-extended-Seribu.

Konvensi repo: Photon dipakai juga di scripts/geocode_photon_pass.py dengan
rate-limit 0.6 s/request. Cache ke scripts/water_attractions_intermediate.json.
Jalankan dari root.
"""
from __future__ import annotations
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path("/home/alfi/repos/DisparDataPlatform")
CACHE_FILE = REPO_ROOT / "scripts" / "water_attractions_intermediate.json"
DATASET_FILE = REPO_ROOT / "data" / "water-attractions-jakarta.json"
MIRROR_FILE = REPO_ROOT / "platform-v2" / "data" / "water-attractions-jakarta.json"

# Bbox DKI (extended ke utara untuk Seribu).
DKI_LAT_MIN, DKI_LAT_MAX = -6.51, -5.30
DKI_LON_MIN, DKI_LON_MAX = 106.38, 107.10

# Pattern nama venue yang BUKAN landmark daratan (filter negatif untuk geocode).
FOREIGN = re.compile(
    r"\b(JABODETABEK|PUNCAK|BANDUNG|BALI|BOGOR|DEPOK|TANGERANG|BEKASI|YOGYA|"
    r"THAILAND|SINGAPORE|MALAYSIA)\b",
    re.I,
)


def photon(q: str, lat: float = -6.2088, lon: float = 106.8456) -> dict | None:
    url = "https://photon.komoot.io/api/?" + urllib.parse.urlencode(
        {"q": q, "limit": 5, "lat": lat, "lon": lon}
    )
    req = urllib.request.Request(url, headers={"User-Agent": "DisparWaterAttractions/1.0 (research)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r)
    time.sleep(0.7)  # rate-limit sopan
    feats = data.get("features", [])
    # Terima kandidat pertama yang di-dalam bbox DKI.
    for f in feats:
        coords = f.get("geometry", {}).get("coordinates", [])
        if len(coords) < 2:
            continue
        lo, la = coords[0], coords[1]
        if not (DKI_LAT_MIN <= la <= DKI_LAT_MAX) or not (DKI_LON_MIN <= lo <= DKI_LON_MAX):
            continue
        props = f.get("properties", {})
        name_p = props.get("name") or ""
        addr_p = ", ".join(filter(None, [
            props.get("street"), props.get("suburb"), props.get("city"),
            props.get("state"), props.get("country"),
        ]))
        if FOREIGN.search(addr_p):
            continue
        return {
            "lat": la,
            "lon": lo,
            "name_photon": name_p,
            "display_name": props.get("display_name", ""),
            "osm_id": props.get("osm_id"),
            "osm_type": props.get("osm_type"),
        }
    return None


def main():
    cache = json.loads(CACHE_FILE.read_text())
    rows = cache["rows"]
    broken = [(i, r) for i, r in enumerate(rows) if r["koordinat_status"] != "OK"]
    print(f"== {len(broken)} venue(s) out-of-range, geocoding via Photon… ==")
    fixed = 0
    still_broken = []
    for i, r in broken:
        # Pakai nama asli silver; tambahkan "Kepulauan Seribu" untuk Pulau di Seribu.
        q = r["nama"]
        if r["nama"].upper().startswith("PULAU"):
            q = f"{r['nama']} Kepulauan Seribu Jakarta"
        elif r["nama"].upper().startswith("MASJID"):
            q = f"{r['nama']} Jakarta"
        else:
            q = f"{r['nama']} Jakarta Indonesia"
        print(f"  [{i}] {r['nama']!r} → query: {q!r}")
        res = photon(q)
        if res is None:
            print(f"      NOT FOUND")
            still_broken.append(r["nama"])
            continue
        rows[i]["latitude"] = res["lat"]
        rows[i]["longitude"] = res["lon"]
        rows[i]["koordinat_status"] = "OK (photon-fix)"
        rows[i]["koordinat_sumber_sumber"] = "Photon (OSM)"
        rows[i]["koordinat_photon_name"] = res["name_photon"]
        rows[i]["koordinat_photon_display"] = res["display_name"]
        rows[i]["koordinat_photon_osmid"] = res["osm_id"]
        rows[i]["koordinat_photon_osmtype"] = res["osm_type"]
        # Update summary fields in dataset later
        fixed += 1
        print(f"      → lat={res['lat']:.5f}, lon={res['lon']:.5f}")
    # Re-tally
    summary = {"OK": 0, "OK (photon-fix)": 0, "out-of-range": 0, "missing": 0}
    for r in rows:
        s = r["koordinat_status"]
        if s.startswith("OK"):
            summary["OK" if s == "OK" else "OK (photon-fix)"] = summary.get("OK" if s == "OK" else "OK (photon-fix)", 0) + 1
        else:
            summary[s] = summary.get(s, 0) + 1
    cache["coords_summary"] = summary
    cache["n_photon_fixed"] = fixed
    cache["still_broken"] = still_broken
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
    print(f"\nSummary: {summary}")
    print(f"Fixed: {fixed} | Still broken: {still_broken}")
    # Rewrite dataset JSON so /sdi sees updated data.
    d = json.loads(DATASET_FILE.read_text())
    d["rows"] = rows
    DATASET_FILE.write_text(json.dumps(d, ensure_ascii=False, indent=0))
    MIRROR_FILE.write_text(json.dumps(d, ensure_ascii=False, indent=0))
    print(f"Dataset rewritten: {DATASET_FILE.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
