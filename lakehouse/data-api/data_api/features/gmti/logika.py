"""Logika `/gmti` dari baris Bronze, port Python murni dari platform-v2.

Sumber yang diport: `lib/gmti.ts` (pilar, `gmtiMapsUrl`), memo `GmtiView` (pool tab, opsi kota/jenis,
`filtered`, award), dan perhitungan `GMTI_META` di `scripts/build-gmti.ts` (konstanta itu tidak diekspor
ke Bronze, jadi angkanya dihitung ulang di sini dari `gmti_ibadah`, `gmti_tempat`, `gmti_kecamatan`).
Masukan = baris `lake.bronze_file.*` apa adanya, dalam urutan berkas sumbernya.
"""

from __future__ import annotations

import re

from data_api.shared import peta
from data_api.shared.atlas_gabungan import _SPASI_JS, Baris, kunci_kolasi
from data_api.shared.atlas_gabungan import _angka as angka
from data_api.shared.atlas_gabungan import _uri as uri

PILLARS = ["ibadah", "makan", "menginap", "destinasi", "program"]
PILLAR_LABEL = {
    "ibadah": "Ibadah",
    "makan": "Makan & minum",
    "menginap": "Menginap",
    "destinasi": "Destinasi & fasilitas",
    "program": "Program dan Event",
}
PILLAR_DESC = {
    "ibadah": "Masjid & mushalla terdaftar SIMAS Kemenag se-DKI Jakarta.",
    "makan": "Restoran, RPH, dan produk kuliner bersertifikat halal BPJPH/LPPOM MUI.",
    "menginap": "Hotel syariah & ramah muslim — arah kiblat, mushalla, tempat wudhu.",
    "destinasi": "Mall, bandara, dan situs warisan Islam dengan fasilitas ramah muslim.",
    "program": "Program, event, festival, kampung wisata, dan inovasi pendukung.",
}
PILLAR_COLOR = {
    "ibadah": "#0f7b6c",
    "makan": "#ed6b23",
    "menginap": "#7048b6",
    "destinasi": "#1e6bb8",
    "program": "#c2185b",
}
NON_SIGNATURE_TIPOLOGI = ("Masjid Jami", "Mushalla Perumahan")

# Kepala berkas `gmti-ibadah.json` (source/sourceUrl/fetchedAt) tidak ikut ke Bronze, yang hanya memuat
# baris. Nilainya disalin dari `GMTI_META`: metadata sumber, bukan angka.
SUMBER = "SIMAS Kemenag RI — Sistem Informasi Masjid"
SUMBER_URL = "https://simas.kemenag.go.id/page/profilmasjid"
DIAMBIL = "2026-08-31T13:42:12.938Z"


def maps_url(p: dict) -> str:
    """`gmtiMapsUrl`."""
    if p["lat"] is not None and p["lon"] is not None:
        return f"https://www.google.com/maps/search/?api=1&query={p['lat']},{p['lon']}"
    q = ", ".join(x for x in (p["name"], p["address"], p["city"], "Jakarta") if x)
    return f"https://www.google.com/maps/search/?api=1&query={uri(q)}"


def _kosong(s: str | None) -> str | None:
    """Kolom opsional: "" di berkas sumber sama dengan tidak ada (`clean` build-gmti)."""
    return s if s else None


def ringkasan(ibadah: list[Baris], tempat: list[Baris], kec: list[Baris], tipologi: list[Baris], capaian: list[Baris]):
    """Data `/v1/gmti/ringkasan`: `GMTI_META` dihitung ulang, pilar, agregat kecamatan/tipologi, capaian."""
    kunci_poligon = {k for k, _, _ in peta.kecamatan()}
    agg = [
        {
            "kecamatan": r["kecamatan"],
            "kota": r["kota"],
            "geo_key": r["geokey"],
            "masjid": angka(r["masjid"]),
            "mushalla": angka(r["mushalla"]),
            "total": angka(r["total"]),
        }
        for r in kec
    ]
    halal = [t for t in tempat if t["pillar"] != "ibadah"]
    cap = [
        {
            "nama": c["nama"],
            "pemberi": c.get("pemberi"),
            "tahun": c.get("tahun"),
            "tingkat": c.get("tingkat"),
            "deskripsi": c.get("deskripsi"),
        }
        for c in capaian
    ]
    award = next((c for c in cap if re.search("GMTI", c["nama"], re.IGNORECASE)), cap[0] if cap else None)
    return {
        "meta": {
            "source": SUMBER,
            "source_url": SUMBER_URL,
            "fetched_at": DIAMBIL,
            "ibadah_total": len(ibadah),
            "masjid": sum(1 for r in ibadah if r["jenis"] == "masjid"),
            "mushalla": sum(1 for r in ibadah if r["jenis"] == "mushalla"),
            "ibadah_non_signature": sum(1 for r in ibadah if r["tipologi"] in NON_SIGNATURE_TIPOLOGI),
            "ibadah_signature": sum(1 for r in ibadah if r["tipologi"] not in NON_SIGNATURE_TIPOLOGI),
            "ibadah_berkoordinat": sum(1 for t in tempat if t["pillar"] == "ibadah"),
            "halal_total": len(halal),
            "halal_berkoordinat": sum(1 for t in halal if t.get("lat") is not None and t.get("lon") is not None),
            "kecamatan": len(agg),
            "kecamatan_tanpa_poligon": [a["kecamatan"] for a in agg if a["geo_key"] not in kunci_poligon],
            "tanpa_kecamatan": sum(1 for r in ibadah if not _kosong(r.get("kecamatan"))),
        },
        "pillars": [
            {"id": p, "label": PILLAR_LABEL[p], "desc": PILLAR_DESC[p], "color": PILLAR_COLOR[p]} for p in PILLARS
        ],
        "kecamatan": agg,
        "tipologi": [{"tipologi": t["tipologi"], "jenis": t["jenis"], "count": angka(t["count"])} for t in tipologi],
        "capaian": cap,
        "award": award,
    }


def _tempat_ibadah(r: Baris) -> dict:
    """Pemetaan baris `gmti-ibadah.json` → `GmtiPlace` (callback `loadIbadah` GmtiView)."""
    return {
        "id": f"simas-{r['id']}",
        "name": r["name"],
        "pillar": "ibadah",
        "kind": r["tipologi"],
        "dataset": "SIMAS Kemenag",
        "href": None,
        "address": r.get("address"),
        "city": r.get("kota"),
        "district": r.get("kecamatan"),
        "lat": angka(r.get("lat")),
        "lon": angka(r.get("lon")),
        "cert": None,
        "note": None,
    }


def _tempat_halal(t: Baris) -> dict:
    return {
        "id": t["id"],
        "name": t["name"],
        "pillar": t["pillar"],
        "kind": t["kind"],
        "dataset": t["dataset"],
        "href": t.get("href"),
        "address": t.get("address"),
        "city": t.get("city"),
        "district": t.get("district"),
        "lat": angka(t.get("lat")),
        "lon": angka(t.get("lon")),
        "cert": t.get("cert"),
        "note": t.get("note"),
    }


def pool(pilar: str, ibadah: list[Baris], tempat: list[Baris]) -> list[dict]:
    """Memo `pool` GmtiView: ibadah (urutan berkas) lalu halal (urutan `GMTI_PLACES`)."""
    halal = [_tempat_halal(t) for t in tempat if t["pillar"] != "ibadah"]
    if pilar == "semua":
        return [*(_tempat_ibadah(r) for r in ibadah), *halal]
    if pilar == "ibadah":
        return [_tempat_ibadah(r) for r in ibadah]
    return [p for p in halal if p["pillar"] == pilar]


def facets(daftar: list[dict]) -> dict:
    """Memo `cityOptions`/`kindOptions` (tanpa "All"): dari pool tab, sebelum filter."""
    return {
        "kota": sorted({p["city"] for p in daftar if p["city"]}, key=kunci_kolasi),
        "jenis": sorted({p["kind"] for p in daftar if p["kind"]}, key=kunci_kolasi),
    }


def saring(daftar: list[dict], kota: str | None, jenis: str | None, q: str | None) -> list[dict]:
    """Memo `filtered` GmtiView: kota dan jenis persis, `q` substring huruf kecil atas enam kolom."""
    needle = (q or "").strip(_SPASI_JS).lower()

    def cocok(p: dict) -> bool:
        if kota and p["city"] != kota:
            return False
        if jenis and p["kind"] != jenis:
            return False
        if not needle:
            return True
        kolom = (p["name"], p["kind"], p["address"], p["city"], p["district"], p["cert"])
        return any(needle in v.lower() for v in kolom if v)

    return [p for p in daftar if cocok(p)]
