"""Uji `data_api.shared.atlas_gabungan` terhadap golden platform-v2 dan quirk JavaScript yang ditiru.

Baris masukan dibentuk persis seperti `lake.bronze_file.*`: berkas `data/statis/*.json` dibaca lalu
dilewatkan konversi yang sama dengan ingest (`lakehouse/ingest/dispar_ingest/lake.py`: `safe_name`
untuk nama kolom, `to_text` untuk nilai, union kolom dengan `None` untuk kolom yang tak dimiliki baris).
"""

from __future__ import annotations

import json
import random
import re
from pathlib import Path
from typing import Any

import pytest

from data_api.shared import atlas_gabungan as ag

_DATA_API = Path(__file__).resolve().parents[3]
_STATIS = _DATA_API.parents[1] / "data" / "statis"
_GOLDEN = _DATA_API / "tests" / "golden"

# ── konversi ingest (tiruan lake.safe_name / lake.to_text / lake.build_table) ──

_SLUG_RE = re.compile(r"[^a-z0-9_]+")


def _safe_name(raw: str) -> str:
    name = _SLUG_RE.sub("_", str(raw).strip().lower()).strip("_")
    if not name:
        name = "kolom"
    if name[0].isdigit():
        name = f"k_{name}"
    return name[:200]


def _to_text(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, str):
        return v
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False, default=str)
    return str(v)


def ke_bronze(rows: list[dict[str, Any]]) -> list[dict[str, str | None]]:
    keys: list[str] = []
    for r in rows:
        for k in r:
            if _safe_name(k) not in keys:
                keys.append(_safe_name(k))
    hasil = []
    for r in rows:
        normal = {_safe_name(k): _to_text(v) for k, v in r.items()}
        hasil.append({k: normal.get(k) for k in keys})
    return hasil


def _bronze(nama: str) -> list[dict[str, str | None]]:
    return ke_bronze(json.loads((_STATIS / f"{nama}.json").read_text(encoding="utf-8")))


def _golden(nama: str) -> dict:
    return json.loads((_GOLDEN / f"{nama}.json").read_text(encoding="utf-8"))


def _tipe(x: Any) -> Any:
    """Struktur yang sama dengan nilai daun diganti nama tipenya (bedakan int/float/bool)."""
    if isinstance(x, dict):
        return {k: _tipe(v) for k, v in x.items()}
    if isinstance(x, list):
        return [_tipe(v) for v in x]
    return type(x).__name__


def _gci_dari_statis() -> dict:
    return ag.restoran_gci(
        _bronze("gci-venue-kurasi"),
        _bronze("gci-venue-osm"),
        _bronze("gci-venue-rating"),
        _bronze("gci-venue-alamat"),
        _bronze("gci-venue-harga"),
        _bronze("gci-resto-hotel"),
    )


# ── golden ────────────────────────────────────────────────────────────────────


def test_golden_restoran_gci():
    golden = _golden("atlas.restoran-gci")["data"]
    hasil = _gci_dari_statis()
    assert len(hasil["items"]) == 2577
    assert hasil == golden
    assert _tipe(hasil) == _tipe(golden)


def test_golden_direktori_restoran():
    golden = _golden("atlas.direktori-restoran")["data"]
    hasil = ag.direktori_restoran(_bronze("restoran-kurasi"), _bronze("restoran-osm"))
    assert len(hasil["items"]) == 604
    assert hasil == golden
    assert _tipe(hasil) == _tipe(golden)


def test_bentuk_bronze_sesuai_ingest():
    baris = _bronze("gci-venue-kurasi")[0]
    # Kolom huruf kecil, angka/boolean jadi string, kolom yang tak dimiliki baris = None.
    assert {"placeid", "reviewcount", "needsverify", "pricelevel"} <= baris.keys()
    assert baris["needsverify"] == "True"
    assert baris["rating"] == "5"
    rating = _bronze("gci-venue-rating")[0]
    assert rating["found"] == "True" and isinstance(rating["rating"], str)


# ── nameKey ───────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("nama", "kunci"),
    [
        ("Café Ñandú", "cafenandu"),
        ("Crème Brûlée", "cremebrulee"),
        ("McDonald's – Plaza Indonesia", "mcdonaldsplazaindonesia"),
        ("McDonald’s", "mcdonalds"),
        ("A&W (Kemang) #2", "awkemang2"),
        ("ﬁsh", "fish"),  # ligatur → NFKD
        ("Ｋｏｐｉ", "kopi"),  # lebar penuh → NFKD
        ("友福 가당", ""),  # non-Latin terbuang seluruhnya
    ],
)
def test_name_key(nama, kunci):
    assert ag.name_key(nama) == kunci


# ── metersBetween / Math.hypot / Math.cos ─────────────────────────────────────


def _titik(lat, lng, **lain):
    return {"lat": lat, "lng": lng, **lain}


def test_meters_between_ambang_60m():
    a = _titik(-6.2, 106.8)
    assert ag.meters_between(a, a) == 0
    assert ag.meters_between(a, _titik(-6.2005, 106.8)) == pytest.approx(55.5)
    assert ag.meters_between(a, _titik(-6.2005, 106.8)) <= 60
    assert ag.meters_between(a, _titik(-6.2006, 106.8)) > 60
    assert ag.meters_between(a, _titik(None, 106.8)) == float("inf")
    assert ag.meters_between(_titik(-6.2, None), a) == float("inf")


def test_meters_between_asimetris_seperti_ts():
    # Kosinus memakai lintang argumen pertama.
    a, b = _titik(-6.0, 106.8), _titik(-7.0, 106.9)
    assert ag.meters_between(a, b) != ag.meters_between(b, a)


def test_hypot_dan_cos_bit_sama_dengan_v8():
    # Nilai acuan direkam dari Node 24 (`Math.hypot`, `Math.cos`); `math.hypot`/`math.cos` berbeda 1 ulp.
    assert ag._hypot_v8(52.13069423501035, -0.0047520135506729415) == 52.13069445159707
    assert ag._hypot_v8(28.044781743231884, -0.0048470847013421334) == 28.044782162101782
    assert ag._cos_v8((-6.18762 * 3.141592653589793) / 180) == 0.9941742763761849
    assert ag._cos_v8((-6.240144 * 3.141592653589793) / 180) == 0.9940750507566116


# ── localeCompare / sort() ────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "urutan_node",
    [
        # Diurutkan `a.localeCompare(b)` di Node 24 (ICU, en-US).
        ["e", "E", "é", "É", "è", "È", "ê", "ë"],
        ["a", "a b", "a b c", "a_b", "a-b", "a.b", "a'b", "a’b", "a1", "ab", "aB", "Ab", "AB", "ab c"],
        ["cote", "cOte", "Cote", "coté", "côte", "Côte", "côté"],
        ["ea", "Ea", "éa", "Éa", "eb"],
        ["a b", "a c", "a-b", "a-c", "ab", "ac"],
        ["McDonald’s", "McDonald's Pondok Cabe"],
        list(" _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$09aAzZ"),
        ["Zebra", "가", "금", "황", "友", "福"],
    ],
)
def test_kunci_kolasi_meniru_localecompare(urutan_node):
    acak = list(urutan_node)
    random.Random(0).shuffle(acak)
    assert sorted(acak, key=ag.kunci_kolasi) == urutan_node


def test_kunci_kolasi_seri_bila_hanya_beda_karakter_abaikan():
    # localeCompare === 0 → sort stabil mempertahankan urutan asal.
    assert ag.kunci_kolasi("ab") == ag.kunci_kolasi("a\x00b")


def test_sort_bawaan_per_unit_utf16():
    # U+FF5E (BMP) > U+1F600 (surrogate D83D) per unit UTF-16, kebalikan urutan code point.
    assert sorted(["😀", "～", "Z", "a"], key=ag._kunci_utf16) == ["Z", "a", "😀", "～"]
    assert ag._panjang_utf16("a😀") == 3


# ── dedupe dan urutan akhir GCI ───────────────────────────────────────────────


def _osm(id_, name, tier="Restoran", lat="-6.2", lng="106.8", **lain):
    return {
        "id": id_,
        "name": name,
        "cuisine": "X",
        "area": "Area",
        "city": "Jakarta Pusat",
        "tier": tier,
        "lat": lat,
        "lng": lng,
        "address": "",
        "osmid": f"node/{id_}",
        "hotel": None,
        **lain,
    }


def _rating(id_, rating, review, pid):
    return {"id": id_, "found": "True", "rating": rating, "reviewcount": review, "placeid": pid, "source": "Google"}


def _kurasi(id_, name, **lain):
    baris = {
        "id": id_,
        "name": name,
        "cuisine": "X",
        "area": "SCBD, Jakarta Selatan",
        "city": "Jakarta Selatan",
        "tier": "Restoran",
        "address": None,
        "hotel": None,
        "needsverify": None,
        "placeid": None,
        "rating": None,
        "reviewcount": None,
        "ratingsource": None,
        "pricelevel": None,
        "pricesource": None,
        "source": "curated",
    }
    return {**baris, **lain}


def _gci(kurasi=(), osm=(), rating=(), alamat=(), harga=(), resto=()):
    return ag.restoran_gci(list(kurasi), list(osm), list(rating), list(alamat), list(harga), list(resto))


def _ids(hasil):
    return [r["id"] for r in hasil["items"]]


def test_dedupe_place_id_sama_simpan_nama_terpanjang_dan_kurasi_dulu():
    osm = [_osm("o1", "Kopi"), _osm("o2", "Kopi Kenangan Senayan", lat="-6.3"), _osm("o3", "Bistro Satu Dua")]
    rating = [_rating("o1", "4.5", "10", "P1"), _rating("o2", "4.5", "10", "P1"), _rating("o3", "4", "5", "P2")]
    assert _ids(_gci(osm=osm, rating=rating)) == ["o2", "o3"]
    # Kurasi menang atas OSM ber-place_id sama walau namanya lebih pendek.
    kur = [_kurasi("k1", "Bistro", placeid="P2", rating="4.9", reviewcount="1")]
    assert _ids(_gci(kurasi=kur, osm=osm, rating=rating)) == ["o2", "k1"]


def test_dedupe_tanpa_place_id_nama_sama_dan_dekat():
    osm = [
        _osm("a", "Kopi Kenangan!", lat="-6.2000", lng="106.8"),
        _osm("b", "KOPI KENANGAN", lat="-6.2003", lng="106.8"),  # ±33 m dari "a" → dibuang
        _osm("c", "Kopi Kenangan", lat="-6.2100", lng="106.8"),  # ±1,1 km → cabang lain, disimpan
        _osm("d", "Kopi Kenangan", lat=None, lng=None),  # tanpa koordinat → jarak tak hingga, disimpan
    ]
    assert sorted(_ids(_gci(osm=osm))) == ["a", "c", "d"]


def test_urutan_akhir_tier_rating_ulasan_nama():
    osm = [
        _osm("cafe", "Cafe A", tier="Cafe"),
        _osm("r-tanpa", "Zeta", lat="-6.1"),
        _osm("r-b", "beta", lat="-6.3"),
        _osm("r-B", "Beta", lat="-6.4"),
        _osm("r-ulasan", "Alpha", lat="-6.5"),
        _osm("h3", "Hotel Tiga", tier="Hotel ★3", hotel="Hotel Tiga (★3)"),
        _osm("h4", "Hotel Empat", tier="Hotel ★4", hotel="Hotel Empat (★4)"),
    ]
    rating = [
        _rating("r-b", "4", "100", "Pb"),
        _rating("r-B", "4", "100", "PB"),
        _rating("r-ulasan", "3", "500", "Pa"),
        _rating("cafe", "5", "999", "Pc"),
    ]
    assert _ids(_gci(osm=osm, rating=rating)) == ["h4", "h3", "r-ulasan", "r-b", "r-B", "r-tanpa", "cafe"]


def test_osm_dibuang_bila_sudah_dikurasi_dan_hotel_generik():
    kur = [_kurasi("k", "Food Exchange", tier="Hotel ★4", hotel="Novotel Jakarta Cikini (★4)")]
    osm = [
        _osm("dup", "FOOD-EXCHANGE"),  # nameKey sama dengan kurasi
        _osm("hotel", "Novotel Jakarta Cikini", tier="Hotel ★4", hotel="Novotel Jakarta Cikini (★4)"),
        _osm("resto", "Novotel Jakarta Cikini", tier="Restoran"),  # bukan tier Hotel → tetap
    ]
    hasil = _gci(kurasi=kur, osm=osm)
    assert sorted(_ids(hasil)) == ["k", "resto"]
    assert hasil["curated"] == 1


def test_gci_field_none_dan_enrichment():
    osm = [
        _osm("a", "Hotel Satu", tier="Hotel ★3", hotel=None, address="Jl. OSM 1"),
        _osm("b", "Warung", address=""),
        _osm("c", "Kedai", address="Jl. OSM 3", lat=None, lng=None),
    ]
    alamat = [{"id": "a", "address": None, "found": "False"}, {"id": "b", "address": "Jl. Google 2", "found": "True"}]
    harga = [{"id": "a", "pricelevel": None, "source": "Google", "found": "False"}]
    resto = [{"id": "a", "name": "Resto Dalam Hotel", "source": "https://contoh"}]
    items = {r["id"]: r for r in _gci(osm=osm, alamat=alamat, harga=harga, resto=resto)["items"]}
    a, b, c = items["a"], items["b"], items["c"]
    # Nama dari gci_resto_hotel; hotel jatuh ke nama OSM karena kolom hotel kosong.
    assert (a["name"], a["hotel"]) == ("Resto Dalam Hotel", "Hotel Satu")
    # Alamat Google None → fallback addr OSM; "" OSM → None → address_display = area.
    assert a["address"] == "Jl. OSM 1"
    assert (b["address"], b["address_display"]) == ("Jl. Google 2", "Jl. Google 2")
    assert a["price_level"] is None and a["price_source"] == "Google"
    assert a["rating"] is None and a["place_id"] is None and a["needs_verify"] is False
    assert a["maps_url"] == "https://www.google.com/maps/search/?api=1&query=-6.2,106.8"
    assert c["maps_url"] == "https://www.google.com/maps/search/?api=1&query=Kedai%20Area%20Jakarta"
    tanpa = _gci(osm=[_osm("x", "Y", address="")])["items"][0]
    assert (tanpa["address"], tanpa["address_display"]) == (None, "Area")


def test_gci_maps_url_encode_uri_component():
    r = {"name": "A&W’s (Ö) ~ok!", "area": "Kemang", "place_id": "PX", "lat": None, "lng": None}
    assert ag.gci_maps_url(r) == (
        "https://www.google.com/maps/search/?api=1&query=A%26W%E2%80%99s%20(%C3%96)%20~ok!%20Kemang&query_place_id=PX"
    )


# ── direktori ─────────────────────────────────────────────────────────────────


def _dir_kurasi(id_, name, city, area="Area", **lain):
    baris = {
        "id": id_,
        "name": name,
        "cuisine": "Italian",
        "category": "Food",
        "area": area,
        "city": city,
        "highlights": '["x"]',
        "sources": '[{"label":"L","url":"https://u"}]',
        "source": "curated",
    }
    return {**baris, **lain}


def _dir_osm(id_, name, city, **lain):
    baris = {
        "id": id_,
        "name": name,
        "cuisine": "Thai",
        "category": "Food",
        "area": "Jakarta",
        "city": city,
        "lat": "-6.2",
        "lng": "106.8",
        "osmid": f"node/{id_}",
    }
    return {**baris, **lain}


def test_direktori_filter_dki_dan_sidik_jari():
    kurasi = [
        _dir_kurasi("k1", "Pizza Marzano", "South Jakarta", rating="4.5"),
        _dir_kurasi("k2", "Chain Lain", "Jakarta (Other)", rating="4"),
    ]
    osm = [
        _dir_osm("o1", "PIZZA MARZANO", "South Jakarta"),  # sidik jari sama → dibuang
        _dir_osm("o2", "Pizza Marzano", "Central Jakarta"),  # kota lain → cabang berbeda, disimpan
        _dir_osm("o3", "Warung", "Tangerang"),  # luar DKI → dibuang
        _dir_osm("o4", "Kedai", "Outside DKI"),
    ]
    hasil = ag.direktori_restoran(kurasi, osm)
    assert [r["id"] for r in hasil["items"]] == ["k1", "k2", "o2"]
    assert hasil["cities"] == ["Central Jakarta", "South Jakarta", "Jakarta (Other)"]
    assert hasil["cuisines"] == ["Italian", "Thai"]
    assert hasil["stats"] == {"total": 3, "cuisines": 2, "rated": 2, "avg_rating": 4.25}
    o2 = hasil["items"][2]
    assert o2["highlights"] == [] and o2["rating"] is None and o2["address"] is None
    assert o2["sources"] == [
        {"label": "OpenStreetMap — © OSM contributors", "url": "https://www.openstreetmap.org/node/o2"}
    ]
    assert o2["embed_url"] == "https://www.google.com/maps?q=-6.2,106.8&hl=en&z=17&output=embed"


def test_direktori_url_tanpa_koordinat_dan_alamat_kosong():
    r = {"name": "Toscana", "address": "", "area": "Kemang", "lat": None, "lng": None}
    # `address ?? area` mempertahankan "" lalu `filter(Boolean)` membuangnya.
    assert ag.google_maps_url(r) == "https://www.google.com/maps/search/?api=1&query=Toscana%2C%20Jakarta"
    r["address"] = None
    assert (
        ag.maps_embed_url(r) == "https://www.google.com/maps?q=Toscana%2C%20Kemang%2C%20Jakarta&hl=en&z=16&output=embed"
    )


def test_direktori_rata_rata_tanpa_penjumlahan_terkompensasi():
    kurasi = [_dir_kurasi(f"k{i}", f"R{i}", "South Jakarta", rating=v) for i, v in enumerate(["0.1", "0.2", "0.3"])]
    # JS: ((0 + 0.1) + 0.2) + 0.3 = 0.6000000000000001; sum() Python 3.12 memberi 0.6.
    assert ag.direktori_restoran(kurasi, [])["stats"]["avg_rating"] == 0.6000000000000001 / 3


def test_get_city_list_dan_cuisine_list():
    restoran = [
        {"city": c, "cuisine": k}
        for c, k in [("Jakarta (Other)", "thai"), ("South Jakarta", "Thai"), ("Central Jakarta", "Ásian")]
    ]
    assert ag.get_city_list(restoran) == ["Central Jakarta", "South Jakarta", "Jakarta (Other)"]
    # sort() bawaan JS: per unit UTF-16, huruf besar sebelum kecil, beraksen paling akhir.
    assert ag.get_cuisine_list(restoran) == ["Thai", "thai", "Ásian"]
