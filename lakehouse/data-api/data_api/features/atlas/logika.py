"""Logika empat subhalaman atlas statis dari baris Bronze, port Python murni dari platform-v2.

Restoran GCI dan Direktori Restoran ada di `shared/atlas_gabungan.py` (dipakai juga untuk hitungan).
Di sini:
  - `lib/events.ts` + memo `filtered` `EventsView` → `pertunjukan`
  - `lib/golf.ts` + memo `stats` `GolfView` → `golf`
  - `lib/souvenir.ts` + memo opsi/`stats` `SouvenirView` → `suvenir`
  - `lib/hotel.ts` + memo tren/KPI/daftar `HotelView` → `hotel`

Masukan = baris `lake.bronze_file.*` apa adanya (semua `str | None`, array berupa string JSON), dalam
urutan berkas sumbernya (sort JS stabil, jadi urutan masukan menentukan hasil saat seri).
"""

from __future__ import annotations

import json
import re

from data_api.shared.atlas_gabungan import Baris, kunci_kolasi
from data_api.shared.atlas_gabungan import _angka as angka
from data_api.shared.atlas_gabungan import _kunci_utf16 as kunci_utf16
from data_api.shared.atlas_gabungan import _uri as uri
from data_api.shared.format import to_fixed

# ── Pertunjukan & Budaya (events.ts) ──────────────────────────────────────────

EVENT_CATEGORIES = [
    "Konser Musik",
    "Festival Musik",
    "Seni Tari",
    "Teater / Musikal",
    "Orkestra / Klasik",
    "Seni Tradisional",
    "Seni Rupa",
    "Film",
    "Budaya",
    "Budaya Pop",
    "Fashion",
    "Fan Meeting",
]

BULAN = {
    "januari": 1,
    "februari": 2,
    "maret": 3,
    "april": 4,
    "mei": 5,
    "juni": 6,
    "juli": 7,
    "agustus": 8,
    "september": 9,
    "oktober": 10,
    "november": 11,
    "desember": 12,
}
_PERLU_VERIFIKASI = re.compile("perkiraan|kapasitas|target|estimasi|terjual", re.IGNORECASE)
_MUSIK = ("Konser Musik", "Festival Musik")


def event_date_sort(date: str) -> int:
    """`eventDateSort`: kunci kronologis dari teks tanggal (best-effort)."""
    iso = re.search(r"(\d{4})-(\d{2})-(\d{2})", date, re.ASCII)
    if iso:
        return int(iso[1] + iso[2] + iso[3])
    m = re.search(r"([a-z]+)\s+(\d{4})", date.lower(), re.ASCII)
    if m and BULAN.get(m[1]):
        return int(f"{m[2]}{BULAN[m[1]]:02d}00")
    y = re.search(r"(\d{4})", date, re.ASCII)
    if y:
        return int(f"{y[1]}0000")
    return 99999999


def event_year(date: str) -> str:
    """Tahun pertama `20xx` di teks tanggal (`eventYear` / filter `eventStats`)."""
    m = re.search(r"(20\d{2})", date, re.ASCII)
    return m[1] if m else ""


def pertunjukan(rows: list[Baris], tahun: str | None) -> dict:
    """Data `/v1/atlas/pertunjukan`: `GCI_EVENTS` (urut kronologis) pada satu tahun, plus `eventStats`."""
    events = sorted(rows, key=lambda e: event_date_sort(e["date"]))
    if tahun:
        events = [e for e in events if event_year(e["date"]) == tahun]
    items = [
        {
            "id": e["id"],
            "organizer": e["organizer"],
            "name": e["name"],
            "date": e["date"],
            "date_sort": event_date_sort(e["date"]),
            "venue": e["venue"],
            "type": e["type"],
            "visitors": e["visitors"],
            "visitors_needs_verify": bool(_PERLU_VERIFIKASI.search(e["note"])),
            "note": e["note"],
            "category": e["category"],
            "source": e.get("source"),
        }
        for e in events
    ]
    konser = sum(1 for e in events if e["category"] == "Konser Musik")
    festival = sum(1 for e in events if e["category"] == "Festival Musik")
    return {
        "items": items,
        "stats": {
            "total": len(events),
            "konser": konser,
            "festival": festival,
            "budaya": sum(1 for e in events if e["category"] not in _MUSIK),
        },
        "categories": list(EVENT_CATEGORIES),
    }


# ── Lapangan Golf (golf.ts) ───────────────────────────────────────────────────


def golf(rows: list[Baris]) -> dict:
    """Data `/v1/atlas/golf`: `GOLF_COURSES` + memo `stats` GolfView."""
    items = []
    for g in rows:
        lat, lng = angka(g["lat"]), angka(g["lng"])
        items.append(
            {
                "id": g["id"],
                "name": g["name"],
                "kind": g["kind"],
                "holes": angka(g.get("holes")),
                "par": angka(g.get("par")),
                "designer": g.get("designer"),
                "established": angka(g.get("established")),
                "membership": g.get("membership"),
                "city": g["city"],
                "area": g["area"],
                "address": g.get("address"),
                "lat": lat,
                "lng": lng,
                "website": g.get("website"),
                "description": g.get("description"),
                "highlights": json.loads(g["highlights"]),
                "sources": json.loads(g["sources"]),
                "maps_url": f"https://www.google.com/maps/search/?api=1&query={lat},{lng}",
            }
        )
    courses = [g for g in items if g["kind"] == "Course"]
    return {
        "items": items,
        "stats": {
            "total": len(items),
            "courses": len(courses),
            "ranges": len(items) - len(courses),
            "total_holes": sum(g["holes"] or 0 for g in courses),
        },
    }


# ── Toko Suvenir (souvenir.ts) ────────────────────────────────────────────────


def _suvenir_maps_url(s: dict) -> str:
    if s["lat"] is not None and s["lng"] is not None:
        return f"https://www.google.com/maps/search/?api=1&query={s['lat']},{s['lng']}"
    alamat = s["address"] if s["address"] is not None else "Jakarta"
    return f"https://www.google.com/maps/search/?api=1&query={uri(f'{s["name"]} {alamat}')}"


def _suvenir_embed_url(s: dict) -> str:
    if s["lat"] is not None and s["lng"] is not None:
        return f"https://www.google.com/maps?q={s['lat']},{s['lng']}&hl=id&z=17&output=embed"
    q = ", ".join(x for x in (s["name"], s["address"], "Jakarta") if x)
    return f"https://www.google.com/maps?q={uri(q)}&hl=id&z=16&output=embed"


def suvenir(rows: list[Baris]) -> dict:
    """Data `/v1/atlas/suvenir`: `SOUVENIR_SHOPS` + memo opsi wilayah/produk dan `stats` SouvenirView."""
    toko = [
        {
            "id": s["id"],
            "name": s["name"],
            "category": s["category"],
            "relevance": s["relevance"],
            "product": s.get("product"),
            "address": s.get("address"),
            "city": s.get("city"),
            "district": s.get("district"),
            "lat": angka(s.get("lat")),
            "lng": angka(s.get("lng")),
            "coord_source": s.get("coordsource"),
            "phone": s.get("phone"),
            "rating": angka(s.get("rating")),
            "reviews": angka(s.get("reviews")),
            "status": s.get("status"),
            "note": s.get("note"),
            "url": s.get("url"),
        }
        for s in rows
    ]
    rated = [s for s in toko if s["rating"] is not None]
    jumlah = 0
    for s in rated:  # `reduce` kiri-ke-kanan, bukan `sum()` terkompensasi
        jumlah += s["rating"]
    relevansi = [s["relevance"] for s in toko]
    produk = {s["product"] for s in toko if s["product"] and s["product"] != "?"}
    return {
        "items": [{**s, "maps_url": _suvenir_maps_url(s), "embed_url": _suvenir_embed_url(s)} for s in toko],
        "stats": {
            "total": len(toko),
            "ya": relevansi.count("Ya"),
            "sebagian": relevansi.count("Sebagian"),
            "tidak": relevansi.count("Tidak"),
            "belum_pasti": sum(1 for r in relevansi if r not in ("Ya", "Sebagian", "Tidak")),
            "avg_rating": jumlah / len(rated) if rated else 0,
            "geo": sum(1 for s in toko if s["lat"] is not None),
        },
        "products": sorted(produk, key=kunci_kolasi),
        "cities": sorted({s["city"] for s in toko if s["city"]}, key=kunci_utf16),
    }


# ── Hotel & Akomodasi (hotel.ts, HotelView.tsx) ───────────────────────────────

BINTANG_ORDER = ["BINTANG 1", "BINTANG 2", "BINTANG 3", "BINTANG 4", "BINTANG 5"]

# `HOTEL_META.built`/`sources`: metadata build `scripts/build-hotel.ts`, tidak ada di Bronze (teks tampilan).
HOTEL_BUILT = "2026-09-09"
HOTEL_SOURCES = [
    "Satu Data Jakarta — Rekapitulasi Usaha & Kamar Hotel",
    "Satu Data Jakarta / BPS — Tingkat Penghunian Kamar Hotel Berbintang",
    "Satu Data Jakarta / BPS — Rata-rata Lama Menginap Wisman & Wisnus Hotel Berbintang",
]


def _rata(nilai: list[float]) -> float:
    jumlah = 0.0
    for v in nilai:
        jumlah += v
    return jumlah / len(nilai) if nilai else 0


def hotel(registri: list[Baris], tpk: list[Baris], los: list[Baris]) -> dict:
    """Data `/v1/atlas/hotel`: memo tren TPK/LoS, KPI, dan daftar HotelView."""
    reg = [
        {
            "nama": h["nama"],
            "jenis_usaha": h["jenis_usaha"],
            "golongan": h["golongan"],
            "kamar": angka(h["kamar"]),
            "alamat": h["alamat"],
            "wilayah": h["wilayah"],
            "periode": h["periode"],
        }
        for h in registri
    ]
    tpk_rows = [(r["periode"], r["bintang"], angka(r["nilai"])) for r in tpk]
    los_rows = [(r["periode"], r["tamu"], angka(r["nilai"])) for r in los]

    periods = sorted({p for p, _, _ in tpk_rows}, key=kunci_utf16)
    idx = {p: i for i, p in enumerate(periods)}
    seri_tpk = []
    for b in (b for b in BINTANG_ORDER if any(r[1] == b for r in tpk_rows)):
        data: list[float | None] = [None] * len(periods)
        for p, bintang, nilai in tpk_rows:
            if bintang == b:
                data[idx[p]] = nilai
        seri_tpk.append({"name": b.replace("BINTANG", "Bintang", 1), "data": data})

    periods_los = sorted({p for p, _, _ in los_rows}, key=kunci_utf16)
    idx_los = {p: i for i, p in enumerate(periods_los)}

    def rata_per_periode(tamu: str) -> list[float | None]:
        jumlah = [0.0] * len(periods_los)
        n = [0] * len(periods_los)
        for p, t, nilai in los_rows:
            if t == tamu:
                jumlah[idx_los[p]] += nilai
                n[idx_los[p]] += 1
        return [float(to_fixed(s / c, 2)) if c else None for s, c in zip(jumlah, n, strict=True)]

    occ_period = periods[-1] if periods else None
    los_period = periods_los[-1] if periods_los else None
    kode = [h["periode"] for h in reg]
    return {
        "built": HOTEL_BUILT,
        "registry_period": f"{min(kode, key=kunci_utf16)}–{max(kode, key=kunci_utf16)}" if kode else "",
        "sources": list(HOTEL_SOURCES),
        "kpi": {
            "hotels": len(reg),
            "rooms": sum(h["kamar"] for h in reg),
            "occupancy_latest": _rata([v for p, _, v in tpk_rows if p == occ_period]),
            "occupancy_period": occ_period,
            "los_latest": _rata([v for p, _, v in los_rows if p == los_period]),
            "los_period": los_period,
        },
        "tpk_chart": {"periods": periods, "series": seri_tpk},
        "los_chart": {
            "periods": periods_los,
            "series": [
                {"name": "Wisman", "data": rata_per_periode("WISATAWAN MANCANEGARA")},
                {"name": "Wisnus", "data": rata_per_periode("WISATAWAN NUSANTARA")},
            ],
        },
        "registry": sorted(reg, key=lambda h: -h["kamar"]),
        "filters": {
            "wilayah": sorted({h["wilayah"] for h in reg if h["wilayah"]}, key=kunci_utf16),
            "golongan": sorted({h["golongan"] for h in reg if h["golongan"]}, key=kunci_utf16),
        },
    }
