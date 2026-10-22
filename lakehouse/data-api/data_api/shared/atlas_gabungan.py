"""Gabung + dedup dua halaman atlas restoran dari baris Bronze, port Python murni dari platform-v2.

Sumber yang diport (diikuti baris per baris, termasuk quirk-nya):
  - `platform-v2/lib/gci.ts` → `restoran_gci`: langkah 3 (entri OSM) dan langkah 4 (`dedupe` + urutan akhir).
    Langkah 1–2 (SEED → CURATED, pinjam alamat) sudah dikerjakan sebelum ekspor, jadi baris
    `gci_venue_kurasi` dipakai apa adanya.
  - `platform-v2/lib/restaurants.ts` (`:330-444`) → `direktori_restoran`: kurasi + OSM, saring DKI, helper URL.
  - `platform-v2/components/Dashboard.tsx` → memo `cuisineOptions`/`cityOptions` (tanpa "All") dan `stats`.

Masukan = baris `lake.bronze_file.*` apa adanya: `list[dict[str, str | None]]`, nama kolom sudah melalui
`safe_name` ingest (huruf kecil: `placeid`, `reviewcount`, `pricelevel`, `osmid`, `needsverify`, ...),
angka berupa `str()` Python ("4.5", "1476"), boolean "True"/"False", array berupa string JSON, kolom
yang tidak dimiliki sebuah baris = `None` (atau tidak ada sama sekali bila tak ada baris yang memilikinya).

Keputusan dan cara meniru perilaku JavaScript:
  - `deriveCityFromArea` (restaurants.ts) dan `deriveCity` (gci.ts) TIDAK dijalankan. `city` di Bronze adalah
    hasil ekspor `RESTAURANTS`/`GCI_RESTAURANTS` yang sudah memanggilnya; diperiksa pada data/statis
    (181 baris `restoran-kurasi`, 65 baris `gci-venue-kurasi`): fungsi itu menghasilkan nilai yang sama
    dengan `city` di setiap baris. Sidik jari kurasi di TS juga memakai `deriveCityFromArea(c.area)`, jadi
    sama dengan `city`. Kurasi luar DKI memang tidak ikut diekspor, tetapi sidik jarinya hanya bisa
    membuang OSM dengan kota yang sama (luar DKI), yang toh dibuang saringan DKI.
  - `nameKey`/`normName` (kodenya identik) → `name_key`: lower → NFKD → buang U+0300–U+036F → buang
    `[^a-z0-9]`.
  - `a.name.localeCompare(b.name)` (Node, ICU, locale en-US = kolasi root CLDR) → `kunci_kolasi`: tiruan UCA
    tiga tingkat. Primer: spasi < tanda baca (urutan tabel `_TANDA_BACA`, diambil dari Node) < simbol <
    mata uang < digit < huruf Latin < huruf lain < jamo Hangul < kana < Han; sekunder: diakritik hasil
    NFD (urutan `_DIAKRITIK`); tersier: huruf kecil < kapital. Tepat untuk ASCII, huruf Latin + diakritik
    terurai NFD, tanda kutip tipografis, Hangul, dan Han (semua karakter nama di data saat ini; dibuktikan
    di tes terhadap urutan yang direkam dari Node). Di luar itu (mis. ø æ ß, varian kompatibilitas seperti
    NBSP, aksara lain) hanya hampiran berurut code point di dalam kelompoknya.
  - `Array.prototype.sort()` tanpa pembanding dan `String.length` bekerja per unit UTF-16 → `_kunci_utf16`
    dan `_panjang_utf16`.
  - `metersBetween` ditiru bit-per-bit: `Math.hypot` dengan algoritma V8 (penjumlahan Kahan atas nilai yang
    diskalakan; `math.hypot` Python berbeda di ulp terakhir) dan `Math.cos` dengan `__kernel_cos` fdlibm
    yang dipakai V8 (untuk |lintang| <= 45 derajat; `math.cos` libm berbeda 1 ulp pada 5 dari 2.573 lintang
    OSM). Keduanya dicocokkan dengan Node pada data ini.
  - Rata-rata rating = `reduce` kiri-ke-kanan biasa, bukan `sum()` (Python 3.12 memakai penjumlahan terkompensasi).
  - Urutan masukan berpengaruh seperti di TS (sort stabil; entri pertama menang saat seri), jadi berikan
    baris Bronze dalam urutan berkas sumbernya.
"""

from __future__ import annotations

import json
import math
import re
import struct
import unicodedata
from urllib.parse import quote

Baris = dict[str, str | None]

# ── konstanta (gci.ts) ────────────────────────────────────────────────────────

# Hotel ★5 sengaja tidak ditampilkan (sudah dari JHA).
TIER_ORDER = ["Hotel ★4", "Hotel ★3", "Restoran", "Cafe"]

CITY_ORDER = [
    "Jakarta Pusat",
    "Jakarta Selatan",
    "Jakarta Utara",
    "Jakarta Barat",
    "Jakarta Timur",
    "Kepulauan Seribu",
]

_TIER_RANK = {"Hotel ★5": 0, "Hotel ★4": 1, "Hotel ★3": 2, "Restoran": 3, "Cafe": 4}

# ── konstanta (restaurants.ts, Dashboard.tsx) ─────────────────────────────────

DIREKTORI_CITY_ORDER = [
    "Central Jakarta",
    "South Jakarta",
    "North Jakarta",
    "West Jakarta",
    "East Jakarta",
    "Kepulauan Seribu",
]

# "Jakarta (Other)" = fallback kurasi saat sub-wilayah tak terbaca; dianggap DKI.
DKI_CITIES = frozenset([*DIREKTORI_CITY_ORDER, "Jakarta (Other)"])

# `cityOptions` di Dashboard memakai urutan sendiri yang juga memuat kota Bodetabek.
_URUTAN_KOTA_DASHBOARD = [*DIREKTORI_CITY_ORDER, "Tangerang", "Bekasi", "Depok", "Bogor"]

_LABEL_OSM = "OpenStreetMap — © OSM contributors"

# ── utilitas peniru JavaScript ────────────────────────────────────────────────

# Karakter yang dibuang `String.prototype.trim`.
_SPASI_JS = "\t\n\v\f\r " + "".join(
    map(chr, [0xA0, 0x1680, *range(0x2000, 0x200B), 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF])
)

_HOTEL_BINTANG = re.compile(r"\s*\(★[0-9]\)\s*\Z")  # `\Z`: `$` JS tanpa flag m tidak cocok sebelum "\n" akhir


def _angka(s: str | None) -> int | float | None:
    """String angka Bronze → angka; bilangan bulat tetap `int` seperti saat JSON sumbernya dibaca."""
    if s is None:
        return None
    return int(s) if re.fullmatch(r"-?[0-9]+", s) else float(s)


def _uri(s: str) -> str:
    """`encodeURIComponent`."""
    return quote(s, safe="!'()*-._~")


def _panjang_utf16(s: str) -> int:
    """`String.length` (jumlah unit UTF-16)."""
    return len(s.encode("utf-16-le")) // 2


def _kunci_utf16(s: str) -> bytes:
    """Kunci urut `Array.prototype.sort()` bawaan (perbandingan unit UTF-16)."""
    return s.encode("utf-16-be")


def name_key(s: str) -> str:
    """`nameKey` gci.ts = `normName` restaurants.ts: nama ternormalisasi untuk dedup."""
    s = unicodedata.normalize("NFKD", s.lower())
    s = re.sub("[\u0300-\u036f]", "", s)
    return re.sub("[^a-z0-9]+", "", s)


# Urutan ICU root, direkam dari Node (`localeCompare`, en-US). Karakter dalam satu grup tanda baca
# berbobot primer sama dan hanya berbeda di tingkat sekunder (mis. ' < U+2018 < U+2019).
_SPASI = "\t\n\v\f\r\u2028 "
_TANDA_BACA = [
    *"_-\u2013\u2014,;:!?.\u00b7",
    "'\u2018\u2019",
    '"\u201c\u201d',
    *"()[]{}@*/\\&#%`^+<=>|~",
]
_POSISI_TANDA_BACA = {c: (i, j) for i, grup in enumerate(_TANDA_BACA) for j, c in enumerate(grup)}
# Urutan sekunder diakritik (U+0301 akut, U+0300 grave, U+0306 breve, U+0302 sirkumfleks, ...).
_DIAKRITIK = [0x301, 0x300, 0x306, 0x302, 0x30C, 0x30A, 0x308, 0x30B, 0x303, 0x307, 0x327, 0x328, 0x304]
_KELOMPOK = 1 << 22


def _bobot(ch: str) -> tuple[int, int] | None:
    """Bobot (primer, sekunder) satu karakter dasar hasil NFD; `None` = sepenuhnya diabaikan."""
    cp = ord(ch)
    kat = unicodedata.category(ch)
    if ch in _SPASI:
        return _SPASI.index(ch), 1
    if kat in ("Cc", "Cf"):
        return None
    if kat[0] == "Z":
        return 0x100 + cp, 1
    if ch in _POSISI_TANDA_BACA:
        grup, varian = _POSISI_TANDA_BACA[ch]
        return _KELOMPOK + grup, 1 + varian
    if kat[0] == "P":
        return _KELOMPOK + 0x100 + cp, 1
    if kat == "Sc":
        return 3 * _KELOMPOK + cp, 1
    if kat[0] == "S":
        return 2 * _KELOMPOK + cp, 1
    if kat == "Nd":
        return 4 * _KELOMPOK + unicodedata.digit(ch), 1
    kecil = ch.lower()
    if len(kecil) == 1 and "a" <= kecil <= "z":
        return 5 * _KELOMPOK + ord(kecil), 1
    if 0x1100 <= cp <= 0x11FF:  # jamo Hangul (suku kata sudah diurai NFD)
        return 7 * _KELOMPOK + cp, 1
    if 0x3040 <= cp <= 0x30FF:
        return 8 * _KELOMPOK + cp, 1
    if unicodedata.name(ch, "").startswith(("CJK UNIFIED IDEOGRAPH", "CJK COMPATIBILITY IDEOGRAPH")):
        # Bobot implisit UCA: blok inti (U+4E00-U+9FFF) dan kompatibilitas sebelum ekstensi.
        inti = 0x4E00 <= cp <= 0x9FFF or 0xF900 <= cp <= 0xFAFF
        return 9 * _KELOMPOK + (0 if inti else 0x110000) + cp, 1
    return 6 * _KELOMPOK + cp, 1


def kunci_kolasi(s: str) -> tuple[tuple[int, ...], tuple[int, ...], tuple[int, ...]]:
    """Kunci urut peniru `String.prototype.localeCompare` (ICU root, tingkat tersier).

    Dua string dengan kunci sama dianggap `localeCompare(...) === 0`, sehingga sort stabil
    mempertahankan urutan sebelumnya, sama seperti V8.
    """
    primer: list[int] = []
    sekunder: list[int] = []
    tersier: list[int] = []
    for ch in unicodedata.normalize("NFD", s):
        if unicodedata.category(ch) == "Mn":
            cp = ord(ch)
            sekunder.append(0x10 + (_DIAKRITIK.index(cp) if cp in _DIAKRITIK else 0x100 + cp))
            tersier.append(1)
            continue
        bobot = _bobot(ch)
        if bobot is None:
            continue
        primer.append(bobot[0])
        sekunder.append(bobot[1])
        tersier.append(2 if ch != ch.lower() else 1)
    return tuple(primer), tuple(sekunder), tuple(tersier)


# Koefisien polinomial `__kernel_cos` fdlibm (dipakai V8 untuk `Math.cos`).
_C1 = 4.16666666666666019037e-02
_C2 = -1.38888888888741095749e-03
_C3 = 2.48015872894767294178e-05
_C4 = -2.75573143513906633035e-07
_C5 = 2.08757232129817482790e-09
_C6 = -1.13596475577881948265e-11


def _hypot_v8(*nilai: float) -> float:
    """`Math.hypot` versi V8: skala dengan nilai mutlak terbesar lalu penjumlahan Kahan."""
    mutlak = [abs(v) for v in nilai]
    maks = max(mutlak)
    if maks == 0:
        return 0.0
    jumlah = 0.0
    kompensasi = 0.0
    for v in mutlak:
        n = v / maks
        suku = n * n - kompensasi
        sementara = jumlah + suku
        kompensasi = (sementara - jumlah) - suku
        jumlah = sementara
    return math.sqrt(jumlah) * maks


def _cos_v8(x: float) -> float:
    """`Math.cos` V8 (fdlibm `__kernel_cos`) untuk |x| <= pi/4, yaitu lintang dalam +-45 derajat.

    Di luar rentang itu V8 mereduksi argumen dulu; dipakai `math.cos` (libm) yang bisa berbeda <= 1 ulp.
    """
    ix = (struct.unpack(">q", struct.pack(">d", x))[0] >> 32) & 0x7FFFFFFF
    if ix > 0x3FE921FB:
        return math.cos(x)
    if ix < 0x3E400000 and int(x) == 0:
        return 1.0
    z = x * x
    r = z * (_C1 + z * (_C2 + z * (_C3 + z * (_C4 + z * (_C5 + z * _C6)))))
    if ix < 0x3FD33333:
        return 1.0 - (0.5 * z - z * r)
    qx = 0.28125 if ix > 0x3FE90000 else struct.unpack(">d", struct.pack(">q", (ix - 0x00200000) << 32))[0]
    return (1.0 - qx) - ((0.5 * z - qx) - z * r)


def _js_trim_kosong(s: str) -> bool:
    return not s.strip(_SPASI_JS)


# ── Restoran GCI (gci.ts) ─────────────────────────────────────────────────────


def meters_between(a: dict, b: dict) -> float:
    """`metersBetween`: jarak meter kasar (asimetris: kosinus memakai lintang `a`)."""
    if a["lat"] is None or a["lng"] is None or b["lat"] is None or b["lng"] is None:
        return math.inf
    dx = (a["lat"] - b["lat"]) * 111000
    dy = (a["lng"] - b["lng"]) * 111000 * _cos_v8((a["lat"] * math.pi) / 180)
    return _hypot_v8(dx, dy)


def gci_maps_url(r: dict) -> str:
    """`gciMapsUrl`: place_id bila ada, lalu koordinat, terakhir pencarian nama+area.

    Koordinat dicetak dengan `str()`; sama dengan `String(number)` JS kecuali notasi eksponen (|x| < 1e-4),
    yang tidak terjadi untuk koordinat Jakarta.
    """
    if r["place_id"]:
        q = _uri(f"{r['name']} {r['area']}")
        return f"https://www.google.com/maps/search/?api=1&query={q}&query_place_id={r['place_id']}"
    if r["lat"] is not None and r["lng"] is not None:
        return f"https://www.google.com/maps/search/?api=1&query={r['lat']},{r['lng']}"
    q = _uri(f"{r['name']} {r['area']} Jakarta")
    return f"https://www.google.com/maps/search/?api=1&query={q}"


def gci_address(r: dict) -> str:
    """`gciAddress`: alamat jalan bila ada (dan tidak kosong setelah trim), jika tidak kawasan."""
    return r["address"] if r["address"] and not _js_trim_kosong(r["address"]) else r["area"]


def gci_stats(items: list[dict]) -> dict:
    """`gciStats`."""
    return {
        "total": len(items),
        "rated": sum(1 for r in items if r["rating"] is not None),
        "hotel": sum(1 for r in items if r["tier"].startswith("Hotel")),
        "cafe": sum(1 for r in items if r["tier"] == "Cafe"),
        "restoran": sum(1 for r in items if r["tier"] == "Restoran"),
    }


def _gci_kurasi(b: Baris) -> dict:
    return {
        "id": b["id"],
        "name": b["name"],
        "cuisine": b["cuisine"],
        "area": b["area"],
        "address": b.get("address"),
        "city": b["city"],
        "hotel": b.get("hotel"),
        "tier": b["tier"],
        "source": "curated",
        "lat": _angka(b.get("lat")),
        "lng": _angka(b.get("lng")),
        "rating": _angka(b.get("rating")),
        "review_count": _angka(b.get("reviewcount")),
        "rating_source": b.get("ratingsource"),
        "place_id": b.get("placeid"),
        "price_level": b.get("pricelevel"),
        "price_source": b.get("pricesource"),
        "needs_verify": b.get("needsverify") == "True",
    }


def _dedupe(daftar: list[dict]) -> list[dict]:
    """`dedupe`: place_id sama → satu; tanpa place_id → buang bila nameKey sama DAN ≤ 60 m."""
    # Kurasi dulu, lalu nama paling deskriptif (terpanjang).
    ranked = sorted(daftar, key=lambda r: (0 if r["source"] == "curated" else 1, -_panjang_utf16(r["name"])))
    seen_pid: set[str] = set()
    kept: list[dict] = []
    tanpa_pid: dict[str, list[dict]] = {}  # entri `kept` tanpa place_id, per nameKey
    for r in ranked:
        if r["place_id"]:
            if r["place_id"] in seen_pid:
                continue
            seen_pid.add(r["place_id"])
            kept.append(r)
            continue
        k = name_key(r["name"])
        if any(meters_between(o, r) <= 60 for o in tanpa_pid.get(k, [])):
            continue
        tanpa_pid.setdefault(k, []).append(r)
        kept.append(r)
    # Urutan tampil: per tier, ber-rating dulu, ulasan terbanyak, lalu nama.
    kept.sort(
        key=lambda r: (
            _TIER_RANK[r["tier"]],
            1 if r["rating"] is None else 0,
            -(r["review_count"] if r["review_count"] is not None else 0),
            kunci_kolasi(r["name"]),
        )
    )
    return kept


def restoran_gci(
    kurasi: list[Baris],
    osm: list[Baris],
    rating: list[Baris],
    alamat: list[Baris],
    harga: list[Baris],
    resto_hotel: list[Baris],
) -> dict:
    """Data `/v1/atlas/restoran-gci`: kurasi + OSM, didedup dan diurutkan seperti `GCI_RESTAURANTS`."""
    rating_per_id = {b["id"]: b for b in rating}
    alamat_per_id = {b["id"]: b for b in alamat}
    harga_per_id = {b["id"]: b for b in harga}
    resto_per_id = {b["id"]: b for b in resto_hotel}

    curated = [_gci_kurasi(b) for b in kurasi]
    curated_keys = {name_key(r["name"]) for r in curated}
    # Hotel yang restorannya sudah dikurasi bernama: baris hotel-generik OSM-nya dilewati.
    curated_hotel_keys = {name_key(_HOTEL_BINTANG.sub("", r["hotel"], count=1)) for r in curated if r["hotel"]}

    osm_list: list[dict] = []
    for o in osm:
        if name_key(o["name"]) in curated_keys:
            continue
        if o["tier"].startswith("Hotel") and name_key(o["name"]) in curated_hotel_keys:
            continue
        rt = rating_per_id.get(o["id"])
        found = rt is not None and rt.get("found") == "True"
        resto = resto_per_id[o["id"]].get("name") if o["id"] in resto_per_id else None
        al = alamat_per_id.get(o["id"])
        alamat_google = al.get("address") if al is not None else None
        hr = harga_per_id.get(o["id"])
        hotel = o.get("hotel")
        osm_list.append(
            {
                "id": o["id"],
                "name": resto if resto is not None else o["name"],
                "cuisine": o["cuisine"],
                "area": o["area"],
                # Alamat Google lebih akurat; fallback ke addr:* OSM ("" → tidak ada).
                "address": alamat_google if alamat_google is not None else (o.get("address") or None),
                "city": o["city"],
                "hotel": (hotel if hotel is not None else o["name"]) if resto else hotel,
                "tier": o["tier"],
                "source": "osm",
                "lat": _angka(o.get("lat")),
                "lng": _angka(o.get("lng")),
                "rating": _angka(rt.get("rating")) if found else None,
                "review_count": _angka(rt.get("reviewcount")) if found else None,
                "rating_source": "Google" if found else None,
                "place_id": rt.get("placeid") if found else None,
                "price_level": hr.get("pricelevel") if hr is not None else None,
                "price_source": hr.get("source") if hr is not None else None,
                "needs_verify": False,
            }
        )

    hasil = _dedupe([*curated, *osm_list])
    items = [
        {
            "id": r["id"],
            "name": r["name"],
            "cuisine": r["cuisine"],
            "area": r["area"],
            "address": r["address"],
            "address_display": gci_address(r),
            "city": r["city"],
            "hotel": r["hotel"],
            "tier": r["tier"],
            "source": r["source"],
            "lat": r["lat"],
            "lng": r["lng"],
            "rating": r["rating"],
            "review_count": r["review_count"],
            "rating_source": r["rating_source"],
            "place_id": r["place_id"],
            "price_level": r["price_level"],
            "price_source": r["price_source"],
            "needs_verify": r["needs_verify"],
            "maps_url": gci_maps_url(r),
        }
        for r in hasil
    ]
    return {
        "items": items,
        "stats": gci_stats(hasil),
        "curated": len(curated),  # GCI_CURATED_COUNT
        "tiers": list(TIER_ORDER),
        "cities": list(CITY_ORDER),
    }


# ── Direktori restoran (restaurants.ts) ───────────────────────────────────────


def _sidik_jari(name: str, city: str) -> str:
    """`fingerprint`: nama ternormalisasi + kota."""
    return f"{name_key(name)}|{city.lower()}"


def _teks_lokasi(r: dict) -> str:
    """`[name, address ?? area, "Jakarta"].filter(Boolean).join(", ")`."""
    alamat = r["address"] if r["address"] is not None else r["area"]
    return ", ".join(x for x in (r["name"], alamat, "Jakarta") if x)


def google_maps_url(r: dict) -> str:
    """`googleMapsUrl`."""
    if r["lat"] is not None and r["lng"] is not None:
        return f"https://www.google.com/maps/search/?api=1&query={r['lat']},{r['lng']}"
    return f"https://www.google.com/maps/search/?api=1&query={_uri(_teks_lokasi(r))}"


def maps_embed_url(r: dict) -> str:
    """`mapsEmbedUrl`."""
    if r["lat"] is not None and r["lng"] is not None:
        return f"https://www.google.com/maps?q={r['lat']},{r['lng']}&hl=en&z=17&output=embed"
    return f"https://www.google.com/maps?q={_uri(_teks_lokasi(r))}&hl=en&z=16&output=embed"


def get_cuisine_list(restoran: list[dict]) -> list[str]:
    """`getCuisineList` (= memo `cuisineOptions` Dashboard tanpa "All")."""
    return sorted({r["cuisine"] for r in restoran}, key=_kunci_utf16)


def _urut_kota(restoran: list[dict], urutan: list[str]) -> list[str]:
    hadir = {r["city"] for r in restoran}
    ordered = [c for c in urutan if c in hadir]
    ordered += [c for c in sorted(hadir, key=_kunci_utf16) if c not in ordered]
    return ordered


def get_city_list(restoran: list[dict]) -> list[str]:
    """`getCityList`: kota DKI sesuai `CITY_ORDER`, lalu sisanya alfabetis."""
    return _urut_kota(restoran, DIREKTORI_CITY_ORDER)


def _direktori_kurasi(b: Baris) -> dict:
    return {
        "id": b["id"],
        "name": b["name"],
        "cuisine": b["cuisine"],
        "category": b["category"],
        "area": b["area"],
        "city": b["city"],
        "address": b.get("address"),
        "price_range": b.get("pricerange"),
        "price_note": b.get("pricenote"),
        "rating": _angka(b.get("rating")),
        "review_count": _angka(b.get("reviewcount")),
        "rating_source": b.get("ratingsource"),
        "highlights": json.loads(b["highlights"]),
        "description": b.get("description"),
        "sources": json.loads(b["sources"]),
        "source": "curated",
        "lat": _angka(b.get("lat")),
        "lng": _angka(b.get("lng")),
        "osm_id": b.get("osmid"),
        "phone": b.get("phone"),
        "website": b.get("website"),
    }


def _direktori_osm(o: Baris) -> dict:
    """`osmToRestaurant`."""
    return {
        "id": o["id"],
        "name": o["name"],
        "cuisine": o["cuisine"],
        "category": o["category"],
        "area": o["area"],
        "city": o["city"],
        "address": o.get("address"),
        "price_range": None,
        "price_note": None,
        "rating": None,
        "review_count": None,
        "rating_source": None,
        "highlights": [],
        "description": None,
        "sources": [{"label": _LABEL_OSM, "url": f"https://www.openstreetmap.org/{o.get('osmid')}"}],
        "source": "osm",
        "lat": _angka(o.get("lat")),
        "lng": _angka(o.get("lng")),
        "osm_id": o.get("osmid"),
        "phone": o.get("phone"),
        "website": o.get("website"),
    }


def direktori_restoran(kurasi: list[Baris], osm: list[Baris]) -> dict:
    """Data `/v1/atlas/direktori-restoran`: `RESTAURANTS` + opsi filter dan stats Dashboard."""
    curated = [_direktori_kurasi(b) for b in kurasi]
    sidik_kurasi = {_sidik_jari(r["name"], r["city"]) for r in curated}
    osm_list = [_direktori_osm(o) for o in osm if _sidik_jari(o["name"], o["city"]) not in sidik_kurasi]
    restoran = [r for r in curated if r["city"] in DKI_CITIES] + [r for r in osm_list if r["city"] in DKI_CITIES]

    rated = [r for r in restoran if r["rating"] is not None]
    jumlah = 0
    for r in rated:
        jumlah += r["rating"]
    return {
        "items": [{**r, "maps_url": google_maps_url(r), "embed_url": maps_embed_url(r)} for r in restoran],
        "stats": {
            "total": len(restoran),
            "cuisines": len({r["cuisine"] for r in restoran}),
            "rated": len(rated),
            "avg_rating": jumlah / len(rated) if rated else 0,
        },
        "cities": _urut_kota(restoran, _URUTAN_KOTA_DASHBOARD),
        "cuisines": get_cuisine_list(restoran),
    }
