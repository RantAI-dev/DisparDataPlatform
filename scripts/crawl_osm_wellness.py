#!/usr/bin/env python3
"""Phase N — Inventaris venue wellness DKI Jakarta via Nominatim.

Wellness tourism = spa, pijat/refleksi, fitness/yoga/pilates, klinik
kecantikan/alternatif, beauty clinic. Sesuai UNWTO/GWI sub-sektor:
physical, mental, spiritual, medical, nutrition.

Mengikuti pola crawl_osm_water_attractions.py — bukan Overpass global
mirror (author catat: Overpass-api.de & overpass.osm.ch tidak konsisten
untuk DKI). Nominatim forward-search + filter kategori lebih andal.

Kategori OSM yang dipakai (sesuai RELEVANT_TYPES):
  - amenity=spa                     spa & pijat profesional
  - tourism=spa                     spa yang terdaftar sebagai attraction
  - leisure=fitness_centre          gym/fitness premium
  - leisure=sports_centre           sports club besar
  - shop=beauty                     beauty supply (skip; terlalu retail)
  - healthcare=alternative          klinik tradisional/alternatif
  - amenity=clinic                  klinik kecantikan/estetika
  - amenity=doctors                 praktek dokter (filter khusus)
  - shop=massage                    toko pijat
  - amenity=sauna                   sauna

Output:
  - data/wellness-jakarta-osm-additions.json  (cache + summary)
  - data/sekunder/wellness-jakarta.json       (final, format standar)
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
ADDITIONS_FILE = REPO_ROOT / "data" / "wellness-jakarta-osm-additions.json"
CRAWL_CACHE = REPO_ROOT / "scripts" / "osm_wellness_cache.json"

NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = "DisparWellnessCrawler/1.0 (research, dispar.rantai.dev)"
DKI_BBOX = (-6.51, 106.38, -5.30, 107.10)  # S, W, N, E (extended untuk Seribu)

# Tag/kategori OSM yang dianggap venue wellness.
# spa/fitness/sports/alternative/massage/dispensary/dietitian adalah high-signal.
# shop=beauty di-skip (terlalu retail; kebanyakan toko kosmetik, bukan venue).
# amenity=clinic sangat noisy di Indonesia — diizinkan tapi hanya jika name mengandung
# kata wellness/kecantikan/estetika/aesthetic/beauty/dental/skin.
RELEVANT_TYPES = {
    ("amenity", "spa"),
    ("tourism", "spa"),
    ("leisure", "fitness_centre"),
    ("leisure", "sports_centre"),
    ("leisure", "sports_hall"),
    ("leisure", "swimming_pool"),  # kolam renang spa/water therapy
    ("amenity", "sauna"),
    ("amenity", "massage"),
    ("shop", "massage"),
    ("healthcare", "alternative"),
    ("healthcare", "physiotherapist"),
    ("healthcare", "psychotherapist"),
    ("healthcare", "rehabilitation"),
    ("healthcare", "audiologist"),
    ("healthcare", "speech_therapist"),
    ("healthcare", "nutritionist"),
    ("amenity", "clinic"),
    ("amenity", "doctors"),
}

# Kata-kata di nama venue yang dianggap high-signal wellness.
WELLNESS_NAME_TOKENS = {
    "spa", "wellness", "beauty", "clinic", "klinik", "kecantikan",
    "fitness", "gym", "yoga", "pilates", "meditasi", "meditation",
    "reflexology", "refleksi", "pijat", "massage", "sauna", "skin",
    "aesthetic", "estetika", "dermatology", "dermatologi", "dental",
    "klinik gigi", "dokter", "doctor", "therapy", "terapi", "holistic",
    "homeopathy", "akupuntur", "acupuncture", "bekam", "chiropractic",
    "physiotherapy", "fisioterapi", "rehabilitation", "rehab",
    "diet", "nutrition", "nutrisi", "detox", "retreat",
    "barbershop", "salon", "hair", "rambut", "nail", "kuku",
    "eyelash", "brow", "makeup",
}

# Heuristik exclusion: nama venue yang jelas-jelas bukan wellness.
NON_WELLNESS_NAME_TOKENS = {
    "sekolah", "school", "universitas", "university", "kampus",
    "kantor", "office", "hotel ", "hotel," "apartemen", "apartment",
    "pusat perbelanjaan", "mall", "toko", "minimarket",
    "rumah makan", "restoran", "kafe", "cafe", "warung",
    "masjid", "mosque", "gereja", "church",
    "puskesmas", "rumah sakit", "hospital",
    "bank ", "bank,", "atm", "kantor pos",
}

# Query Nominatim — Indonesia & Inggris, broad → narrow, plus per-kotamadya.
QUERIES = [
    # broad
    "spa jakarta",
    "wellness jakarta",
    "wellness center jakarta",
    "beauty clinic jakarta",
    "fitness center jakarta",
    "gym jakarta",
    "yoga studio jakarta",
    "pilates jakarta",
    "klinik kecantikan jakarta",
    "klinik estetika jakarta",
    "pijat jakarta",
    "massage jakarta",
    "refleksi jakarta",
    "reflexology jakarta",
    "sauna jakarta",
    "skin care clinic jakarta",
    "dental clinic jakarta",
    "salon kecantikan jakarta",
    "barbershop jakarta",
    "nail art jakarta",
    # per-kotamadya
    "spa jakarta pusat",
    "spa jakarta selatan",
    "spa jakarta barat",
    "spa jakarta utara",
    "spa jakarta timur",
    "fitness jakarta pusat",
    "fitness jakarta selatan",
    "fitness jakarta utara",
    "fitness jakarta barat",
    "fitness jakarta timur",
    "beauty clinic jakarta pusat",
    "beauty clinic jakarta selatan",
    "beauty clinic jakarta utara",
    "klinik kecantikan jakarta pusat",
    "klinik kecantikan jakarta selatan",
    "klinik kecantikan jakarta utara",
    "klinik kecantikan jakarta barat",
    "klinik kecantikan jakarta timur",
    "yoga jakarta pusat",
    "yoga jakarta selatan",
    # specific (brand atau praktek)
    "Sensa Wellness Jakarta",
    "Sisterfields Spa",
    "ESPA at Pullman Jakarta",
    "Aman Spa Jakarta",
    "The Spa at Four Seasons Jakarta",
    "klinik gigi jakarta",
    "dokter gigi jakarta",
    "tukang gigi jakarta",
    "akupuntur jakarta",
    "acupuncture jakarta",
    "bekam jakarta",
    "chiropractic jakarta",
    "holistic jakarta",
    "homeopathy jakarta",
    "mental health clinic jakarta",
    "psikolog jakarta",
    "fisioterapi jakarta",
    "physiotherapy jakarta",
]


def in_bbox(lat: float, lon: float) -> bool:
    s, w, n, e = DKI_BBOX
    return s <= lat <= n and w <= lon <= e


def nominatim_search(q: str) -> list[dict]:
    params = {
        "q": q,
        "format": "json",
        "limit": "30",
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
        print(f"      HTTP {e.code} (rate-limit); sleep 5 s")
        time.sleep(5)
        return []
    except Exception as e:
        print(f"      error: {e!r}")
        return []
    time.sleep(1.2)  # 1 req/s ToS Nominatim
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


def is_likely_wellness(name: str, cat: tuple[str, str]) -> bool:
    """Filter nama venue yang masuk akal sebagai wellness."""
    n = norm(name)
    # kategori eksplisit spa/fitness/alternative → lolos otomatis
    high_signal_cats = {
        ("amenity", "spa"),
        ("tourism", "spa"),
        ("leisure", "fitness_centre"),
        ("leisure", "sports_centre"),
        ("amenity", "sauna"),
        ("amenity", "massage"),
        ("shop", "massage"),
        ("healthcare", "alternative"),
        ("healthcare", "physiotherapist"),
        ("healthcare", "psychotherapist"),
        ("healthcare", "rehabilitation"),
        ("healthcare", "nutritionist"),
    }
    if cat in high_signal_cats:
        return True
    # kategori lain → butuh kata wellness di nama
    if any(tok in n for tok in WELLNESS_NAME_TOKENS):
        # tapi skip kalau jelas non-wellness
        if any(tok in n for tok in NON_WELLNESS_NAME_TOKENS):
            return False
        return True
    return False


def main():
    if CRAWL_CACHE.exists():
        per_query = json.loads(CRAWL_CACHE.read_text())
        print(f"  cache hit: {CRAWL_CACHE.relative_to(REPO_ROOT)} ({len(per_query)} queries cached)")
    else:
        per_query = {}
        for i, q in enumerate(QUERIES):
            print(f"  [{i+1}/{len(QUERIES)}] q={q!r}")
            per_query[q] = nominatim_search(q)
            # save setiap batch 5 query (resume aman kalau putus)
            if (i + 1) % 5 == 0:
                CRAWL_CACHE.write_text(json.dumps(per_query, ensure_ascii=False, indent=0))
                print(f"    cached batch {i+1}")
        CRAWL_CACHE.write_text(json.dumps(per_query, ensure_ascii=False, indent=0))
        print(f"  fetched & cached: {len(per_query)} queries")

    seen = set()  # (osm_type, osm_id)
    by_query_count = {}
    skipped_no_bbox = []
    skipped_irrelevant = []
    skipped_non_wellness = []
    additions = []

    for q, items in per_query.items():
        by_query_count[q] = 0
        for el in items:
            cls, typ = get_category(el)
            osm_id = el.get("osm_id")
            osm_type = el.get("osm_type")
            unique = (osm_type, osm_id)
            if unique in seen:
                continue
            if (cls, typ) not in RELEVANT_TYPES:
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
            if not is_likely_wellness(name, (cls, typ)):
                skipped_non_wellness.append((q, name, f"{cls}/{typ}"))
                continue
            seen.add(unique)
            by_query_count[q] += 1
            additions.append({
                "id": f"wellness-jakarta-osm-{osm_type}-{osm_id}",
                "nama": name,
                "kategori_wellness": categorize(cls, typ),
                "kategori_osm": f"{cls}/{typ}",
                "alamat": el.get("display_name", ""),
                "latitude": la,
                "longitude": lo,
                "sumber": f"Nominatim ({cls}/{typ}) osm_{osm_type}_{osm_id}",
                "importance": el.get("importance"),
            })

    summary = {
        "total_queries": len(QUERIES),
        "added_unique": len(additions),
        "skipped_no_bbox": len(skipped_no_bbox),
        "skipped_irrelevant_cat": len(skipped_irrelevant),
        "skipped_non_wellness_name": len(skipped_non_wellness),
        "by_query_count": {q: c for q, c in by_query_count.items() if c},
    }
    out = {"summary": summary, "rows": additions}
    ADDITIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    ADDITIONS_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=0))
    print("\n=== SUMMARY ===")
    for k, v in summary.items():
        if isinstance(v, list):
            print(f"  {k}: {len(v)}")
        elif isinstance(v, dict):
            print(f"  {k}: {v}")
        else:
            print(f"  {k}: {v}")
    print(f"\nOutput: {ADDITIONS_FILE.relative_to(REPO_ROOT)}")


def categorize(cls: str, typ: str) -> str:
    """Pemetaan kategori wellness Indonesia-friendly untuk UI katalog."""
    if (cls, typ) in {("amenity", "spa"), ("tourism", "spa"), ("amenity", "massage"), ("shop", "massage")}:
        return "Spa & Pijat"
    if (cls, typ) in {("leisure", "fitness_centre"), ("leisure", "sports_centre"), ("leisure", "sports_hall")}:
        return "Fitness & Gym"
    if cls == "leisure" and typ == "swimming_pool":
        return "Aquatic & Water Therapy"
    if (cls, typ) in {("amenity", "sauna")}:
        return "Sauna & Thermal"
    if cls == "healthcare" and typ == "alternative":
        return "Pengobatan Tradisional & Alternatif"
    if cls == "healthcare" and typ in {"physiotherapist", "rehabilitation"}:
        return "Fisioterapi & Rehabilitasi"
    if cls == "healthcare" and typ in {"psychotherapist", "nutritionist"}:
        return "Kesehatan Mental & Nutrisi"
    if (cls, typ) in {("amenity", "clinic"), ("amenity", "doctors")}:
        return "Klinik Kecantikan & Estetika"
    return "Wellness Lainnya"


if __name__ == "__main__":
    main()