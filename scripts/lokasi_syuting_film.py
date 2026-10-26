#!/usr/bin/env python3
"""Bangun dataset sekunder "Lokasi Syuting Film di DKI Jakarta".

Masukan: scripts/lokasi_syuting_film_temuan.json — pasangan (film layar lebar, lokasi syuting)
hasil kurasi riset publik (artikel berita, Wikipedia, wawancara produksi), tiap baris dengan URL
sumber dan kutipan bukti. Berkas ini adalah catatan bukti; tambah baris baru di sini lalu jalankan
ulang skrip. Satu pasangan boleh punya beberapa baris sumber; dataset memakai satu sumber terbaik.

Tiga tahap, masing-masing ber-cache di scripts/lokasi_syuting_film_cache.json (resume aman):
  1. verifikasi — buka URL sumber dan cek halamannya memuat judul film dan nama lokasi.
     Status: "terverifikasi" / "perlu review (<alasan>)" / "gagal dibuka (<alasan>)".
  2. geocode   — Nominatim (OSM) per nama lokasi unik, dibatasi kotak DKI. Kueri memakai kolom
     opsional "cari_osm" (nama objek OSM yang bersih) bila ada. Hasil area (kelurahan, kecamatan,
     kota), di luar DKI, atau "cari_osm_perkiraan": true (mis. hanya ruas jalannya) ditandai
     "(review)". Koreksi manual: ubah entri cache menjadi {"match": "manual", "lat": .., "lon": ..,
     "sumber": ..}; hasil yang sudah ada tidak dicari ulang, NOT FOUND dicoba lagi bila kuerinya berubah.
  3. bangun    — tulis data/sekunder/lokasi-syuting-film-jakarta.json + salinan platform-v2/data/.

Sopan: robots.txt dicek per domain, User-Agent jujur dengan kontak, jeda ±20% jitter, berhenti total
saat 403/429/tantangan Cloudflare dari Nominatim. Situs berita yang menolak hanya dicatat
"gagal dibuka" (barisnya tetap ada, ditandai perlu review), tidak dicoba ulang.

Jalankan dari root repo:  python3 scripts/lokasi_syuting_film.py [verifikasi|geocode|bangun|semua]
"""

from __future__ import annotations

import json
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from pathlib import Path

TEMUAN = Path("scripts/lokasi_syuting_film_temuan.json")
CACHE = Path("scripts/lokasi_syuting_film_cache.json")
KELUARAN = Path("data/sekunder/lokasi-syuting-film-jakarta.json")
CERMIN = Path("platform-v2/data/lokasi-syuting-film-jakarta.json")

UA = "DisparDataPlatform/1.0 (riset lokasi syuting film DKI Jakarta; +https://github.com/RantAI-dev/DisparDataPlatform)"
JEDA_DETIK = 1.5
# Kotak DKI Jakarta termasuk Kepulauan Seribu (Pulau Sebira di utara).
DKI = {"lat": (-6.40, -5.19), "lon": (106.38, 106.98)}
KATA_UMUM = {
    "museum", "taman", "jalan", "jl", "stasiun", "pulau", "kawasan", "gedung", "jakarta", "kota", "pasar",
    "masjid", "gereja", "hotel", "kampung", "pantai", "dan", "the", "of", "di", "lapangan", "halte", "area",
    "sekitar", "utara", "selatan", "barat", "timur", "pusat", "raya", "baru", "lama", "besar", "kecil",
}


def simpan(cache: dict) -> None:
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def jeda() -> None:
    time.sleep(JEDA_DETIK * random.uniform(0.8, 1.2))


_robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}


def boleh(url: str) -> bool:
    asal = "{0.scheme}://{0.netloc}".format(urllib.parse.urlsplit(url))
    if asal not in _robots:
        rp = urllib.robotparser.RobotFileParser(asal + "/robots.txt")
        try:
            req = urllib.request.Request(asal + "/robots.txt", headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                rp.parse(r.read().decode("utf-8", "replace").splitlines())
        except Exception:  # noqa: BLE001 — robots.txt tidak ada/tak terbaca: anggap tidak dibatasi
            rp = None
        _robots[asal] = rp
    rp = _robots[asal]
    return True if rp is None else rp.can_fetch(UA, url)


def ambil(url: str) -> tuple[int | None, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "id,en"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read(3_000_000).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:  # noqa: BLE001
        return None, type(e).__name__


def teks_halaman(html: str) -> str:
    html = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", html)
    return norm(re.sub(r"<[^>]+>", " ", html))


def token_lokasi(lokasi: str) -> list[str]:
    return [t for t in norm(lokasi).split() if len(t) >= 4 and t not in KATA_UMUM]


def kunci_baris(r: dict) -> str:
    return f"{norm(r['judul_film'])}|{norm(r['lokasi'])}|{r['sumber_url']}"


# ── 1. verifikasi sumber ──────────────────────────────────────────────────────


def verifikasi(temuan: list[dict], cache: dict) -> None:
    sumber = cache.setdefault("sumber", {})
    for i, r in enumerate(temuan):
        k = kunci_baris(r)
        if k in sumber:
            continue
        url = r["sumber_url"]
        if not boleh(url):
            sumber[k] = {"status": "perlu review (robots.txt melarang, tidak dibuka)"}
        else:
            kode, html = ambil(url)
            jeda()
            if kode != 200:
                sumber[k] = {"status": f"gagal dibuka (HTTP {kode or html})"}
            else:
                t = teks_halaman(html)
                film_ada = norm(r["judul_film"]) in t
                lok = token_lokasi(r["lokasi"])
                lok_ada = not lok or any(x in t for x in lok)
                if film_ada and lok_ada:
                    status = "terverifikasi"
                else:
                    kurang = [n for n, ada in (("judul film", film_ada), ("nama lokasi", lok_ada)) if not ada]
                    status = f"perlu review ({' & '.join(kurang)} tidak ditemukan di halaman)"
                sumber[k] = {"status": status}
        if (i + 1) % 10 == 0:
            simpan(cache)
    simpan(cache)


# ── 2. geocode lokasi ─────────────────────────────────────────────────────────


def di_dki(lat: float, lon: float) -> bool:
    return DKI["lat"][0] <= lat <= DKI["lat"][1] and DKI["lon"][0] <= lon <= DKI["lon"][1]


def geocode(temuan: list[dict], cache: dict) -> None:
    lokasi = cache.setdefault("lokasi", {})
    unik: dict[str, dict] = {}
    for r in temuan:
        unik.setdefault(norm(r["lokasi"]), r)
    for i, (k, r) in enumerate(unik.items()):
        q = r.get("cari_osm") or ", ".join(
            x for x in (r["lokasi"], r.get("kawasan"), r.get("kota_administrasi") or "Jakarta") if x
        )
        # Hasil yang sudah ada tidak dicari ulang; NOT FOUND dicoba lagi hanya kalau kuerinya berubah.
        if k in lokasi and (lokasi[k]["match"] != "NOT FOUND" or lokasi[k]["query"] == q):
            continue
        qs = urllib.parse.urlencode(
            {"q": q, "format": "jsonv2", "limit": 1, "countrycodes": "id", "addressdetails": 1,
             "viewbox": "106.38,-5.19,106.98,-6.40", "bounded": 1}
        )
        kode, body = ambil("https://nominatim.openstreetmap.org/search?" + qs)
        jeda()
        if kode in (403, 429) or (kode == 200 and "cf-chl" in body):
            simpan(cache)
            sys.exit(f"Nominatim menolak (HTTP {kode}); berhenti total sesuai aturan sopan. Cache tersimpan.")
        hasil = json.loads(body) if kode == 200 and body.strip().startswith("[") else []
        if not hasil:
            lokasi[k] = {"match": "NOT FOUND", "query": q}
        else:
            h = hasil[0]
            lat, lon = float(h["lat"]), float(h["lon"])
            area = h.get("addresstype") in ("city", "county", "state", "suburb", "city_district", "village",
                                            "municipality", "quarter", "neighbourhood")
            ragu = area or not di_dki(lat, lon) or bool(r.get("cari_osm_perkiraan"))
            lokasi[k] = {
                "match": "nominatim (review)" if ragu else "nominatim",
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "osm": f"{h.get('osm_type')}/{h.get('osm_id')}",
                "tipe": h.get("addresstype") or h.get("type"),
                "display": h.get("display_name", "")[:160],
                "query": q,
            }
        if (i + 1) % 10 == 0:
            simpan(cache)
    simpan(cache)


# ── 3. bangun dataset ─────────────────────────────────────────────────────────

KOLOM = [
    ("nama", "Lokasi Syuting", "string", "Nama tempat syuting spesifik"),
    ("judul_film", "Judul Film", "string", "Film layar lebar (bioskop)"),
    ("tahun_rilis", "Tahun Rilis", "number", None),
    ("kawasan", "Kawasan", "string", None),
    ("kota", "Kota Administrasi", "string", None),
    ("lat", "Lintang", "number", None),
    ("lon", "Bujur", "number", None),
    ("koordinat_status", "Status Koordinat", "string", "nominatim / nominatim (review) / manual / NOT FOUND"),
    ("koordinat_sumber", "Sumber Koordinat", "string", "Objek OSM atau keterangan koreksi manual"),
    ("keyakinan", "Keyakinan Bukti", "string", "tinggi = film dan lokasi disebut tegas; sedang = samar"),
    ("verifikasi_sumber", "Verifikasi Sumber", "string", "Hasil pengecekan otomatis halaman sumber"),
    ("kutipan", "Kutipan Bukti", "string", "Potongan kalimat sumber (maks 25 kata)"),
    ("sumber_judul", "Judul Sumber", "string", None),
    ("sumber_url", "URL Sumber", "string", None),
]


def bangun(temuan: list[dict], cache: dict) -> None:
    lokasi = cache.get("lokasi", {})
    sumber = cache.get("sumber", {})
    status = lambda r: sumber.get(kunci_baris(r), {}).get("status", "belum diverifikasi")  # noqa: E731
    # Satu baris per (film, lokasi): sumber terverifikasi menang, lalu bukti "tinggi", lalu urutan berkas.
    skor = lambda x: (status(x) == "terverifikasi", x["keyakinan"] == "tinggi")  # noqa: E731
    terbaik: dict[tuple[str, str], dict] = {}
    for r in temuan:
        k = (norm(r["judul_film"]), norm(r["lokasi"]))
        if k not in terbaik or skor(r) > skor(terbaik[k]):
            terbaik[k] = r
    rows = []
    for r in sorted(terbaik.values(), key=lambda x: (x.get("tahun_rilis") or 9999, norm(x["judul_film"]), norm(x["lokasi"]))):
        g = lokasi.get(norm(r["lokasi"]), {})
        rows.append(
            {
                "nama": r["lokasi"],
                "judul_film": r["judul_film"],
                "tahun_rilis": r.get("tahun_rilis"),
                "kawasan": r.get("kawasan") or "",
                "kota": r.get("kota_administrasi") or "",
                "lat": g.get("lat"),
                "lon": g.get("lon"),
                "koordinat_status": g.get("match", "belum di-geocode"),
                "koordinat_sumber": g.get("sumber") or g.get("osm") or "",
                "keyakinan": r["keyakinan"],
                "verifikasi_sumber": status(r),
                "kutipan": r["kutipan"],
                "sumber_judul": r.get("sumber_judul") or "",
                "sumber_url": r["sumber_url"],
            }
        )
    film = {norm(r["judul_film"]) for r in rows}
    dataset = {
        "slug": "lokasi-syuting-film-jakarta",
        "title": "Lokasi Syuting Film di DKI Jakarta",
        "description": (
            f"Sebaran {len({norm(r['nama']) for r in rows})} lokasi syuting dari {len(film)} film layar lebar "
            "(nasional dan internasional) di DKI Jakarta beserta tahun rilisnya. Kurasi riset publik (artikel "
            "berita, Wikipedia, wawancara produksi); setiap baris menyertakan URL sumber dan kutipan bukti. "
            "Koordinat dari OpenStreetMap (Nominatim), baris ragu ditandai review."
        ),
        "tags": ["film", "lokasi-syuting", "perfilman", "ekraf", "jakarta", "kurasi-riset", "nominatim-osm", "sekunder"],
        "columns": [{"key": k, "label": lbl, "type": t, "description": d} for k, lbl, t, d in KOLOM],
        "rows": rows,
    }
    teks = json.dumps(dataset, ensure_ascii=False, indent=2) + "\n"
    KELUARAN.write_text(teks, encoding="utf-8")
    CERMIN.write_text(teks, encoding="utf-8")
    hitung = lambda kolom: {v: sum(1 for r in rows if r[kolom] == v) for v in sorted({r[kolom] for r in rows})}  # noqa: E731
    print(f"{len(rows)} baris, {len(film)} film → {KELUARAN} (+ {CERMIN})")
    print("koordinat:", hitung("koordinat_status"))
    print("verifikasi:", hitung("verifikasi_sumber"))


def main() -> int:
    tahap = sys.argv[1] if len(sys.argv) > 1 else "semua"
    temuan = json.loads(TEMUAN.read_text(encoding="utf-8"))
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    if tahap in ("verifikasi", "semua"):
        verifikasi(temuan, cache)
    if tahap in ("geocode", "semua"):
        geocode(temuan, cache)
    if tahap in ("bangun", "semua"):
        bangun(temuan, cache)
    return 0


if __name__ == "__main__":
    sys.exit(main())
