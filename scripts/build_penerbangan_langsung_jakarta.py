#!/usr/bin/env python3
"""Bangun dataset rute penerbangan nonstop yang terhubung ke Jakarta (CGK/WIII).

Menutup gap indikator GPCI `AC-DF` "Kota dengan penerbangan langsung internasional"
yang selama ini berstatus `dataAvailable: false`.

Sumber (semua terbuka):
  1. Wikipedia EN  "Soekarno-Hatta International Airport" §Passenger   — primer
  2. Wikipedia ID  "Bandar Udara Internasional Soekarno-Hatta" §Terminal penumpang
  3. OpenFlights routes.dat / airports.dat / airlines.dat (ODbL)      — silang + kode
  4. Wikidata wbgetentities (P238 IATA, P239 ICAO, P17 negara)        — pelabelan
  5. OpenSky Network /flights/arrival?airport=WIII                     — terukur

Keluaran: data/sekunder/penerbangan-langsung-jakarta.json
Cache/resume: scripts/penerbangan_cache.json (tiap entri menyimpan STATUS)

Jalankan dari root repo:
    python3 scripts/build_penerbangan_langsung_jakarta.py
"""

from __future__ import annotations

import csv
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", "penerbangan_cache.json")
OUT = os.path.join(ROOT, "data", "sekunder", "penerbangan-langsung-jakarta.json")

UA = "DisparDataPlatform-research/1.0 (kontak: repo Dinas-Pariwisata; riset rute penerbangan nonstop CGK)"
CGK_ICAO, CGK_IATA = "WIII", "CGK"
INDONESIA_QID = "Q252"

# OurAirports memuat ISO 3166-1 alpha-2 ('CN'), sedangkan Wikidata/OpenFlights
# memuat nama negara. Deliverable tidak boleh mencampur keduanya — satu kolom,
# satu konvensi. Dipakai untuk negara yang belum punya nama dari sumber lain.
ISO2_KE_NEGARA = {
    "AE": "Uni Emirat Arab", "AF": "Afganistan", "AU": "Australia",
    "BD": "Bangladesh", "BH": "Bahrain", "BN": "Brunei Darussalam",
    "BT": "Bhutan", "CA": "Kanada", "CH": "Swiss", "CN": "Tiongkok",
    "DE": "Jerman", "EG": "Mesir", "ES": "Spanyol", "ET": "Ethiopia",
    "FR": "Perancis", "GB": "Inggris", "HK": "Hong Kong", "ID": "India",
    "IE": "Irlandia", "IL": "Israel", "IN": "India", "IT": "Italia",
    "JP": "Jepang", "KH": "Kamboja", "KR": "Korea Selatan", "KW": "Kuwait",
    "LA": "Laos", "LK": "Sri Lanka", "LU": "Luksemburg", "MM": "Myanmar",
    "MO": "Makau", "MV": "Maladewa", "MX": "Meksiko", "MY": "Malaysia",
    "NG": "Nigeria", "NL": "Belanda", "NP": "Nepal", "NZ": "Selandia Baru",
    "OM": "Oman", "PH": "Filipina", "PK": "Pakistan", "PL": "Polandia",
    "PT": "Portugal", "QA": "Qatar", "RU": "Rusia", "SA": "Arab Saudi",
    "SE": "Swedia", "SG": "Singapura", "TH": "Thailand", "TR": "Turki",
    "TW": "Taiwan", "UA": "Ukraina", "US": "Amerika Serikat",
    "UZ": "Uzbekistan", "VN": "Vietnam", "ZA": "Afrika Selatan",
}


def normalkan_negara(nilai: str) -> str:
    """Samakan nama negara: ISO 2 huruf -> nama Indonesia, spasi dirapikan."""
    v = (nilai or "").strip()
    if not v:
        return ""
    if len(v) == 2 and v.isalpha():
        return ISO2_KE_NEGARA.get(v.upper(), v.upper())
    return v

# Jendela observasi OpenSky. Endpoint hanya mengembalikan data yang sudah
# diproses batch semalam, jadi berakhir kemarin. Batas 2 hari per permintaan.
OPENSKY_HARI = 7


# ───────────────────────── cache + HTTP ─────────────────────────

def muat_cache() -> dict:
    """Muat cache; kalau kosong/rusak, mulai dari kosong — jangan blokir run.

    Resume adalah syarat wajib, tapi cache adalah alat bantu, bukan sumber
    kebenaran. Satu berkas terpotong tidak boleh menghentikan seluruh build.
    """
    if not os.path.exists(CACHE) or os.path.getsize(CACHE) == 0:
        return {"sumber": {}, "wikidata": {}, "opensky": {}, "maskapai": {}}
    try:
        with open(CACHE, encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError, ValueError) as e:
        print(f"  cache rusak ({type(e).__name__}) — diabaikan, mulai dari kosong")
        return {"sumber": {}, "wikidata": {}, "opensky": {}, "maskapai": {}}
    if not isinstance(data, dict):
        return {"sumber": {}, "wikidata": {}, "opensky": {}, "maskapai": {}}
    for kunci in ("sumber", "wikidata", "opensky", "maskapai"):
        data.setdefault(kunci, {})
    return data


def simpan_cache(cache: dict) -> None:
    cache["meta"] = {
        "diperbarui": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "entri_wikidata": len(cache.get("wikidata", {})),
        "chunk_opensky": len(cache.get("opensky", {})),
    }
    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=0)


def ambil(url: str, *, binary: bool = False, percobaan: int = 3, data: bytes | None = None):
    """GET/POST dengan UA jujur, retry, dan mundur saat 429."""
    headers = {"User-Agent": UA, "Accept": "*/*"}
    if data is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    for i in range(percobaan):
        try:
            req = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=90) as r:
                body = r.read()
            return body if binary else body.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                # 429 = kuota habis, 403 = dilarang. Jangan dipaksa: mundur.
                if e.code == 429 and i < percobaan - 1:
                    tunda = int(e.headers.get("X-Rate-Limit-Retry-After-Seconds") or 60)
                    print(f"    429, mundur {tunda}s ...")
                    time.sleep(tunda)
                    continue
                raise
            if i == percobaan - 1:
                raise
            time.sleep(2 * (i + 1))
        except Exception:
            if i == percobaan - 1:
                raise
            time.sleep(2 * (i + 1))


# ───────────────────────── 1. Wikipedia ─────────────────────────

REF_RE = re.compile(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", re.S | re.I)
KOMEN_RE = re.compile(r"<!--.*?-->", re.S)
TPL_RE = re.compile(r"\{\{[^{}]*\}\}")
LINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def bersih_markup(s: str) -> str:
    """Buang penekanan wiki ('''bold''', ''italic'') dan spasi berlebih."""
    return re.sub(r"'{2,}", "", s).strip()


def ekstrak_blok(wt: str, nama: str) -> str:
    """Ambil {{nama ... }} utuh, menghormati kurung kurawal bersarang.

    `str.find('}}')` memotong di template pertama yang bersarang (mis. {{cn|...}}),
    jadi keseimbangan kurung wajib dihitung.
    """
    i = wt.find("{{" + nama)
    if i < 0:
        return ""
    kedalaman = 0
    j = i
    while j < len(wt) - 1:
        if wt[j:j + 2] == "{{":
            kedalaman += 1
            j += 2
            continue
        if wt[j:j + 2] == "}}":
            kedalaman -= 1
            j += 2
            if kedalaman == 0:
                return wt[i:j]
            continue
        j += 1
    return wt[i:]


def bersihkan_teks(s: str) -> str:
    s = REF_RE.sub("", s)
    for _ in range(4):  # template bersarang
        s2 = TPL_RE.sub("", s)
        if s2 == s:
            break
        s = s2
    return s


def judul_wikipedia(host: str, judul: str) -> dict:
    """Ambil wikitext + id revisi untuk sitasi."""
    q = urllib.parse.urlencode({
        "action": "parse", "page": judul, "prop": "wikitext|revid",
        "format": "json", "formatversion": "2",
    })
    d = json.loads(ambil(f"https://{host}/w/api.php?{q}"))
    p = d["parse"]
    return {"wikitext": p["wikitext"], "revid": p.get("revid"), "title": p.get("title")}


def cari_bagian(host: str, judul: str, kata_kunci: str) -> int:
    q = urllib.parse.urlencode({
        "action": "parse", "page": judul, "prop": "sections",
        "format": "json", "formatversion": "2",
    })
    d = json.loads(ambil(f"https://{host}/w/api.php?{q}"))
    for s in d["parse"]["sections"]:
        if kata_kunci.lower() in s["line"].lower():
            return int(s["index"])
    raise RuntimeError(f"bagian {kata_kunci!r} tidak ditemukan di {host}/{judul}")


def wikitext_bagian(host: str, judul: str, kata_kunci: str) -> dict:
    idx = cari_bagian(host, judul, kata_kunci)
    q = urllib.parse.urlencode({
        "action": "parse", "page": judul, "prop": "wikitext|revid",
        "section": idx, "format": "json", "formatversion": "2",
    })
    d = json.loads(ambil(f"https://{host}/w/api.php?{q}"))
    p = d["parse"]
    return {"wikitext": p["wikitext"], "revid": p.get("revid"), "section_index": idx}


def parse_daftar_destinasi(wt: str) -> list[dict]:
    """Parse blok {{Airport-dest-list}} menjadi [{maskapai, tujuan:[{nama,artikel,status}]}].

    Dua jebakan yang sudah menjatuhkan parser sebelumnya:
      1. Ref/template harus dibersihkan di SELURUH blok sebelum dipotong per baris.
         Kalau dibalik, <ref> yang membentang antar baris menyisakan <ref>
         menggantung dan baris berikutnya tak lagi diawali `| [[`.
      2. Pemisah antar baris TIDAK seragam: ada `<!--+-->`, `<!-- -->`, dan
         variasi lain. Memakai split per pemisah akan menggabungkan dua maskapai
         dalam satu potongan lalu regex hanya mengambil yang pertama. Jadi baris
         dicari dengan finditer atas awalan `| [[`, bukan dipotong per pemisah.
    """
    blok = ekstrak_blok(wt, "Airport-dest-list")
    if not blok:
        return []
    awal = blok.find("Airport-dest-list")
    dalam = blok[awal + len("Airport-dest-list"):].rstrip()
    if dalam.endswith("}}"):
        dalam = dalam[:-2]

    dalam = REF_RE.sub("", dalam)
    dalam = KOMEN_RE.sub("\n", dalam)
    for _ in range(5):
        d2 = TPL_RE.sub("", dalam)
        if d2 == dalam:
            break
        dalam = d2

    BARIS_RE = re.compile(
        r"\|\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]\s*\|\s*(.*?)(?=\n\s*\|\s*\[\[|\Z)",
        re.S,
    )
    baris = []
    for m in BARIS_RE.finditer(dalam):
        artikel_maskapai = m.group(1).strip()
        nama_maskapai = bersih_markup((m.group(2) or m.group(1)).strip())
        nama_maskapai = re.sub(r"\s*\([^)]*\)\s*$", "", nama_maskapai).strip()
        sisa = m.group(3)

        tujuan, terkini = [], None
        for token in re.split(r"(\[\[[^\]]+\]\])", sisa):
            if not token:
                continue
            if token.startswith("[["):
                lm = LINK_RE.fullmatch(token)
                if not lm:
                    continue
                tujuan.append({
                    "artikel": lm.group(1).strip(),
                    "nama": bersih_markup((lm.group(2) or lm.group(1)).strip()),
                    "status": "",
                })
                terkini = tujuan[-1]
            elif terkini is not None:
                st = " ".join(
                    x.strip() for x in re.findall(r"\(([^)]*)\)", token) if x.strip()
                )
                if st and not terkini["status"]:
                    terkini["status"] = bersih_markup(st)
        if tujuan:
            baris.append({
                "maskapai": nama_maskapai,
                "artikel_maskapai": artikel_maskapai,
                "tujuan": tujuan,
            })
    return baris


# ───────────────────────── 2. OpenFlights ─────────────────────────

OF_BASE = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/"


def muat_openflights(cache: dict) -> tuple[list, dict, dict]:
    """Kembalikan (routes_by_cgk, airports_by_iata, airlines_by_callsign).

    `airports.dat` dan `airlines.dat` adalah CSV berkutip — nama bandara bisa
    mengandung koma. `split(',')` akan menggeser kolom dan menempelkan kutip
    pada kode IATA (key `"CGK"` bukan `CGK`), sehingga seluruh lookup meleset.
    `routes.dat` polos tanpa kutip; keduanya tetap dibaca lewat `csv`.
    """
    s = cache["sumber"]
    routes_txt = ambil(OF_BASE + "routes.dat")
    airports_txt = ambil(OF_BASE + "airports.dat")
    airlines_txt = ambil(OF_BASE + "airlines.dat")

    def baris_csv(teks: str):
        return csv.reader(io.StringIO(teks), delimiter=",", quotechar='"')

    airports_by_iata, airports_by_icao = {}, {}
    for f in baris_csv(airports_txt):
        if len(f) < 6:
            continue
        rec = {
            "id": f[0], "nama": f[1], "kota": f[2], "negara": f[3],
            "iata": f[4].strip(), "icao": f[5].strip(),
        }
        if rec["iata"] and rec["iata"] != "\\N":
            airports_by_iata[rec["iata"]] = rec
        if rec["icao"] and rec["icao"] != "\\N":
            airports_by_icao[rec["icao"]] = rec

    airlines_by_callsign, airlines_by_iata, airlines_by_icao = {}, {}, {}
    for f in baris_csv(airlines_txt):
        if len(f) < 7:
            continue
        rec = {"nama": f[1], "iata": f[3].strip(), "icao": f[4].strip(),
               "callsign": f[5].strip(), "negara": f[6]}
        if rec["callsign"] and rec["callsign"] != "\\N":
            airlines_by_callsign[rec["callsign"].upper()] = rec
        if rec["iata"] and rec["iata"] != "\\N":
            airlines_by_iata[rec["iata"]] = rec
        if rec["icao"] and rec["icao"] != "\\N":
            airlines_by_icao[rec["icao"].upper()] = rec

    routes = []
    for f in baris_csv(routes_txt):
        if len(f) < 7:
            continue
        src, dst = f[2].strip(), f[4].strip()
        if CGK_IATA not in (src, dst):
            continue
        lawan = dst if src == CGK_IATA else src
        routes.append({
            "maskapai_kode": f[0].strip(),
            "lawan_iata": lawan,
            "codeshare": f[6].strip() == "Y",
        })

    s["openflights"] = {
        "status": "ok",
        "jumlah_rute_cgk": len(routes),
        "jumlah_bandara": len(airports_by_iata),
        "jumlah_maskapai": len(airlines_by_callsign),
        "diambil": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    simpan_cache(cache)
    return routes, airports_by_iata, airlines_by_callsign, airlines_by_icao


OURAIRPORTS = "https://davidmegginson.github.io/ourairports-data/airports.csv"


def muat_ourairports() -> dict:
    """Fallback bandara dari OurAirports (publik, lebih mutakhir dari OpenFlights).

    OpenFlights routes.dat adalah snapshot ~2017; bandara yang dibuka setelahnya
    (YIA Yogyakarta 2019, DHX Kediri 2024, TFU Chengdu Tianfu 2021, dll.) tidak
    ada di sana, sehingga kolom `kota`/`kode_icao` kosong. OurAirports memuat
    `municipality` dan kode IATA/ICAO untuk bandara-bandara ini.

    Juga menutup kasus judul artikel Wikipedia yang red link: Wikipedia ID
    mencantumkan 'Bandar Udara Internasional Hehua Zhangjiajie' yang tidak ada,
    sementara OurAirports punya bandaranya dengan IATA DYG.
    """
    hasil = {"by_iata": {}, "by_icao": {}, "daftar": []}
    try:
        teks = ambil(OURAIRPORTS, binary=True).decode("utf-8", "replace")
    except Exception as e:
        print(f"  OurAirports tidak terjangkau ({e}); fallback kota/ICAO nonaktif")
        return hasil
    for f in csv.reader(io.StringIO(teks), delimiter=",", quotechar='"'):
        if len(f) < 15:
            continue
        iata, icao = f[13].strip(), f[14].strip()
        rec = {"nama": f[3], "kota": f[10].strip(), "negara": f[8],
               "iata": iata, "icao": icao,
               "terjadwal": f[11].strip().lower() == "yes"}
        hasil["daftar"].append(rec)
        if iata:
            hasil["by_iata"][iata] = rec
        if icao:
            hasil["by_icao"].setdefault(icao, rec)
    return hasil


def cari_bandara_dengan_nama(oa: dict, nama: str):
    """Cocokkan nama bandara kasar (mis. 'Zhangjiajie') ke OurAirports.

    Dipakai hanya sebagai jaring pengaman terakhir ketika Wikidata tidak
    memberi kode. Mengutamakan bandara yang punya IATA dan terjadwal.
    """
    if not nama:
        return None
    n = nama.lower().strip()
    if len(n) < 4:
        return None
    kandidat = [r for r in oa.get("daftar", []) if r.get("nama") and n in r["nama"].lower()]
    if not kandidat:
        # potong penunjuk jenis: 'Bandar Udara Internasional X' -> 'x'
        n2 = re.sub(r"^(bandar udara internasional|bandar udara|international airport|airport)\s+",
                    "", n).strip()
        if n2 and n2 != n:
            kandidat = [r for r in oa.get("daftar", []) if r.get("nama") and n2 in r["nama"].lower()]
    if not kandidat:
        return None
    kandidat.sort(key=lambda r: (not r.get("iata"), not r.get("terjadwal")))
    return kandidat[0]


# ───────────────────────── 3. Wikidata ─────────────────────────

def qid_halaman(host: str, judul2artikel: list[str]) -> dict[str, str]:
    """artikel -> QID, batch 50."""
    hasil = {}
    unik = [x for x in dict.fromkeys(judul2artikel) if x]
    for a in range(0, len(unik), 50):
        potong = unik[a:a + 50]
        q = urllib.parse.urlencode({
            "action": "query", "titles": "|".join(potong),
            "prop": "pageprops", "ppprop": "wikibase_item",
            "redirects": "1", "format": "json", "formatversion": "2",
        })
        d = json.loads(ambil(f"https://{host}/w/api.php?{q}"))
        judul_ke = {x["from"]: x["to"] for x in d["query"].get("redirects", [])}
        for p in d["query"]["pages"]:
            qid = (p.get("pageprops") or {}).get("wikibase_item")
            if qid:
                hasil[p["title"]] = qid
        # pertahankan pemetaan artikel asal -> QID lewat judul hasil redirect
        for asal, tujuan in judul_ke.items():
            if tujuan in hasil:
                hasil[asal] = hasil[tujuan]
        time.sleep(0.15)
    return hasil


def _daftar_entitas(d: dict) -> list[dict]:
    """wbgetentities mengembalikan `entities` sebagai dict (formatversion=2) atau list."""
    e = d.get("entities")
    if isinstance(e, dict):
        return [v for v in e.values() if isinstance(v, dict)]
    if isinstance(e, list):
        return [v for v in e if isinstance(v, dict)]
    return []


def _ambil_entitas(qids: list[str]) -> list[dict]:
    """wbgetentities melempar error keseluruhan bila satu pun QID hilang — jadi belah batch.

    Rekursif: batch lolos → ambil semua; batch gagal → belah dua sampai QID
    yang bermasalah terisolasi lalu ditandai `missing`.
    """
    if not qids:
        return []
    q = urllib.parse.urlencode({
        "action": "wbgetentities", "ids": "|".join(qids),
        "props": "claims", "format": "json", "formatversion": "2",
    })
    try:
        d = json.loads(ambil(f"https://www.wikidata.org/w/api.php?{q}"))
    except urllib.error.HTTPError:
        d = {"error": {"info": "http"}}
    if "error" in d:
        if len(qids) == 1:
            return [{"id": qids[0], "missing": True}]
        tengah = len(qids) // 2
        return _ambil_entitas(qids[:tengah]) + _ambil_entitas(qids[tengah:])
    return _daftar_entitas(d)


def prop_wikidata(qids: list[str], cache: dict) -> dict[str, dict]:
    """QID -> {iata, icao, negara_qid, negara} dengan cache status."""
    wd = cache["wikidata"]
    perlu = [q for q in dict.fromkeys(qids) if q and (
        wd.get(q, {}).get("status") != "ok" or "callsign_icao" not in wd.get(q, {}))]
    for a in range(0, len(perlu), 40):
        potong = perlu[a:a + 40]
        for e in _ambil_entitas(potong):
            qid = e.get("id")
            if not qid or e.get("missing"):
                wd[qid or f"tanpa-id-{a}"] = {"status": "hilang"}
                continue
            cl = e.get("claims", {})

            def satu(pid):
                for c in cl.get(pid, []):
                    v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
                    if isinstance(v, dict):
                        v = v.get("id") or v.get("text")
                    if v:
                        return v
                return ""
            wd[qid] = {
                "status": "ok",
                "iata": satu("P238"),
                "icao": satu("P239"),
                # maskapai memakai P230 'callsign' untuk kode ICAO 3 huruf
                # (SIA/AXM/GIA); P239 hanya untuk bandara. Tanpa ini seluruh
                # pencocokan callsign OpenSky selalu nihil.
                "callsign_icao": satu("P230"),
                "negara_qid": satu("P17"),
                "negara": "",
            }
        simpan_cache(cache)
        time.sleep(0.2)

    # label negara, sekali jalan
    nq = {wd[q]["negara_qid"] for q in wd if isinstance(wd.get(q), dict) and wd[q].get("negara_qid")}
    nq = {x for x in nq if x and wd.get("negara_label:" + x, {}).get("status") != "ok"}
    if nq:
        q = urllib.parse.urlencode({
            "action": "wbgetentities", "ids": "|".join(sorted(nq)),
            "props": "labels", "languages": "id|en", "format": "json", "formatversion": "2",
        })
        d = json.loads(ambil(f"https://www.wikidata.org/w/api.php?{q}"))
        for e in _daftar_entitas(d):
            lab = (e.get("labels") or {}).get("id") or (e.get("labels") or {}).get("en") or {}
            cache["wikidata"]["negara_label:" + (e.get("id") or "")] = {
                "status": "ok", "label": lab.get("value", "") if isinstance(lab, dict) else "",
            }
        simpan_cache(cache)

    for q, v in list(wd.items()):
        if isinstance(v, dict) and v.get("status") == "ok" and v.get("negara_qid") and not v.get("negara"):
            lab = wd.get("negara_label:" + v["negara_qid"], {}).get("label", "")
            if lab:
                v["negara"] = lab
    simpan_cache(cache)  # isi `negara` harus ikut tersimpan, bukan hanya di memori
    return wd


# ───────────────────────── 4. OpenSky ─────────────────────────

def ambil_opensky(cache: dict, kred: dict) -> dict:
    """Kembalikan {icao_asal: {jumlah, callsigns}} dari kedatangan WIII.

    Batas API bukan 48 jam melainkan **2 partisi hari kalender**; rentang 48 jam
    yang tidak rata tengah malam UTC akan menyentuh hari ketiga dan ditolak 400.
    Maka jendela dibuat rata tengah malam UTC: [D 00:00, D+1 23:59:59].
    """
    tok = os.environ.get("OPENSKY_TOKEN") or minta_token_opensky(kred)

    # hari penuh terakhir yang sudah diproses batch = kemarin;
    # berhenti di awal kemarin supaya aman dari hari yang belum lengkap.
    kini = datetime.now(timezone.utc)
    akhir = (kini - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    mulai = akhir - timedelta(days=OPENSKY_HARI)

    jendela: list[tuple[int, int]] = []
    p = mulai
    while p < akhir:
        q = min(p + timedelta(days=2), akhir)
        # akhir eksklusif; pakai detik terakhir hari kedua supaya 2 partisi penuh
        jendela.append((int(p.timestamp()), int(q.timestamp()) - 1))
        p = q

    agg: dict[str, dict] = defaultdict(
        lambda: {"jumlah": 0, "callsigns": Counter(), "per_maskapai": Counter()})

    for awal, akhir_j in jendela:
        kunci = f"{CGK_ICAO}_{datetime.fromtimestamp(awal, timezone.utc):%Y-%m-%d}"
        entri = cache["opensky"].get(kunci, {})
        if entri.get("status") != "ok":
            url = (f"https://opensky-network.org/api/flights/arrival"
                   f"?airport={CGK_ICAO}&begin={awal}&end={akhir_j}")
            try:
                req = urllib.request.Request(url, headers={
                    "User-Agent": UA,
                    "Authorization": f"Bearer {tok}",
                })
                with urllib.request.urlopen(req, timeout=90) as r:
                    sisa = r.headers.get("X-Rate-Limit-Remaining")
                    body = r.read().decode("utf-8", "replace")
                print(f"    OpenSky {kunci}: sisa kredit {sisa}")
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    tunda = int(e.headers.get("X-Rate-Limit-Retry-After-Seconds") or 120)
                    print(f"    429, mundur {tunda}s ...")
                    time.sleep(tunda)
                    continue
                if e.code == 401:
                    # token kedaluwarsa (30 menit) — segarkan lalu ulangi chunk ini
                    print("    401, token disegarkan ...")
                    tok = minta_token_opensky(kred)
                    continue
                print(f"    {kunci}: gagal {e.code} — {e.read().decode()[:100]}")
                cache["opensky"][kunci] = {"status": f"gagal_{e.code}"}
                simpan_cache(cache)
                continue

            try:
                penerbangan = json.loads(body) if body else []
            except json.JSONDecodeError:
                penerbangan = []

            asal, cs = Counter(), Counter()
            per_asal_maskapai: dict[str, Counter] = defaultdict(Counter)
            n_null = 0
            for p in penerbangan:
                o = p.get("estDepartureAirport")
                if not o:
                    n_null += 1
                    continue
                asal[o] += 1
                cal = (p.get("callsign") or "").strip()
                if cal:
                    # 3 huruf pertama callsign = kode ICAO maskapai
                    cs[o + "|" + cal[:3].upper()] += 1
                    per_asal_maskapai[o][cal[:3].upper()] += 1
            cache["opensky"][kunci] = {
                "status": "ok",
                "mulai": awal, "selesai": akhir_j,
                "jumlah_penerbangan": len(penerbangan),
                "tanpa_asal": n_null,
                "asal": dict(asal),
                "callsign": dict(cs),
                "per_maskapai": {o: dict(c) for o, c in per_asal_maskapai.items()},
            }
            simpan_cache(cache)

        for o, n in cache["opensky"][kunci].get("asal", {}).items():
            agg[o]["jumlah"] += n
        # field `callsign` menyimpan {bandara|KODE_ICAO_MASKAPAI: n} — sudah cukup
        # untuk agregasi per maskapai, termasuk bagi entri cache lama yang belum
        # punya `per_maskapai`. Jadi tidak perlu fetch ulang.
        for k, n in cache["opensky"][kunci].get("callsign", {}).items():
            o, pre = k.split("|", 1)
            agg[o]["callsigns"][pre] += n
            agg[o]["per_maskapai"][pre] += n

    for v in agg.values():
        v.setdefault("per_maskapai", Counter())
    return agg


def minta_token_opensky(kred: dict) -> str:
    data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": kred["clientId"],
        "client_secret": kred["clientSecret"],
    }).encode()
    body = ambil(
        "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
        data=data,
    )
    return json.loads(body)["access_token"]


# ───────────────────────── 5. Rakit ─────────────────────────

def main() -> int:
    os.chdir(ROOT)
    cache = muat_cache()
    print("== 1/4 Wikipedia ==")

    kunci_en = "wikipedia_en_passenger"
    if cache["sumber"].get(kunci_en, {}).get("status") != "ok":
        d = wikitext_bagian("en.wikipedia.org", "Soekarno–Hatta International Airport", "Passenger")
        cache["sumber"][kunci_en] = {"status": "ok", "revid": d["revid"], "wikitext": d["wikitext"]}
        simpan_cache(cache)
    baris_en = parse_daftar_destinasi(cache["sumber"][kunci_en]["wikitext"])
    print(f"  EN  : {len(baris_en)} maskapai")

    kunci_id = "wikipedia_id_terminal_penumpang"
    if cache["sumber"].get(kunci_id, {}).get("status") != "ok":
        d = wikitext_bagian("id.wikipedia.org", "Bandar Udara Internasional Soekarno–Hatta", "Terminal penumpang")
        cache["sumber"][kunci_id] = {"status": "ok", "revid": d["revid"], "wikitext": d["wikitext"]}
        simpan_cache(cache)
    baris_id = parse_daftar_destinasi(cache["sumber"][kunci_id]["wikitext"])
    print(f"  ID  : {len(baris_id)} maskapai")

    print("== 2/4 OpenFlights ==")
    routes_of, air_iata, air_callsign, air_icao = muat_openflights(cache)
    oa = muat_ourairports()
    print(f"  rute CGK: {len(routes_of)} | OurAirports: {len(oa.get('daftar', []))} bandara")
    lawan_iata = {r["lawan_iata"] for r in routes_of}
    print(f"  bandara lawan unik: {len(lawan_iata)}")

    print("== 3/4 OpenSky ==")
    try:
        kred = json.load(open(os.path.join(ROOT, "credentials.json"), encoding="utf-8"))
    except FileNotFoundError:
        print("  credentials.json tidak ada — bagian OpenSky dilewati")
        kred = None
    agg = ambil_opensky(cache, kred) if kred else {}
    total_obs = sum(v["jumlah"] for v in agg.values())
    n_null = sum(v.get("tanpa_asal", 0) for v in cache["opensky"].values() if isinstance(v, dict))
    n_total = sum(v.get("jumlah_penerbangan", 0) for v in cache["opensky"].values() if isinstance(v, dict))
    print(f"  observasi ber-asal: {total_obs} penerbangan dari {len(agg)} bandara")
    print(f"  cakupan asal: {total_obs}/{total_obs + n_null} "
          f"({100.0 * total_obs / max(1, total_obs + n_null):.1f}%)")

    print("== 4/4 Wikidata ==")
    # QID harus dicari di wiki yang MEMUAT judulnya. Judul bahasa Indonesia
    # (mis. 'Bandar Udara Internasional Kuala Lumpur') tidak ada di en.wikipedia,
    # jadi mencarinya di satu host akan menjatuhkan seluruh baris ID.
    artikel_en, artikel_id = [], []
    maskapai_en, maskapai_id = [], []
    for b in baris_en:
        maskapai_en.append(b["artikel_maskapai"])
        artikel_en.extend(t["artikel"] for t in b["tujuan"])
    for b in baris_id:
        maskapai_id.append(b["artikel_maskapai"])
        artikel_id.extend(t["artikel"] for t in b["tujuan"])

    qid_art: dict[str, str] = {}
    qid_art.update(qid_halaman("en.wikipedia.org", artikel_en))
    qid_art.update(qid_halaman("id.wikipedia.org", artikel_id))
    qid_mask: dict[str, str] = {}
    qid_mask.update(qid_halaman("en.wikipedia.org", maskapai_en))
    qid_mask.update(qid_halaman("id.wikipedia.org", maskapai_id))

    wd = prop_wikidata(list(qid_art.values()) + list(qid_mask.values()), cache)
    simpan_cache(cache)
    print(f"  {sum(1 for v in wd.values() if isinstance(v, dict) and v.get('status') == 'ok')} entri Wikidata")
    print(f"  bandara ber-QID: {len(set(qid_art.values()) - {''})}, maskapai ber-QID: {len(set(qid_mask.values()) - {''})}")

    # ── petakan OpenSky ICAO -> IATA
    icao_ke_iata = {}
    for iata, rec in air_iata.items():
        if rec.get("icao"):
            icao_ke_iata[rec["icao"]] = iata

    # ── rakit baris per (maskapai, bandara_lawan)
    #
    # Kunci penggabungan HARUS identitas bahasa-netral (QID), bukan judul artikel.
    # EN menulis 'Kuala Lumpur International Airport', ID menulis
    # 'Bandar Udara Internasional Kuala Lumpur' — keduanya Q1520167. Memakai judul
    # sebagai kunci menghasilkan dua baris untuk satu rute yang sama.
    kunci_baris: dict[tuple[str, str], dict] = {}

    def selesaikan_bandara(artikel_b: str, nama_b: str):
        """IATA/ICAO/kota/negara untuk satu bandara: Wikidata -> OpenFlights -> OurAirports."""
        qid_b = qid_art.get(artikel_b, "")
        w = wd.get(qid_b, {}) if qid_b else {}
        iata = (w.get("iata") or "").upper()
        icao = (w.get("icao") or "").upper()
        negara = (w.get("negara") or "")
        kota = ""

        rec = None
        if iata:
            rec = air_iata.get(iata) or oa.get("by_iata", {}).get(iata)
        if not rec:
            rec = cari_bandara_dengan_nama(oa, nama_b) or cari_bandara_dengan_nama(oa, artikel_b)
        if not rec and not iata:
            # pencocokan nama polos ke OpenFlights (kasus nama identik)
            for kk, rr in air_iata.items():
                if rr["nama"].lower() == nama_b.lower():
                    rec = rr
                    break
        if rec:
            iata = iata or (rec.get("iata") or "").upper()
            icao = icao or (rec.get("icao") or "").upper()
            kota = rec.get("kota", "") or ""
            if not negara:
                negara = rec.get("negara", "") or ""
        return qid_b, iata, icao, kota, negara

    def daftarkan(maskapai: str, artikel_m: str, artikel_b: str, nama_b: str,
                  status: str, sumber: str):
        qid_b, iata, icao, kota, negara = selesaikan_bandara(artikel_b, nama_b)
        qid_m = qid_mask.get(artikel_m, "")
        # kode ICAO maskapai (Wikidata P239) -> dipakai mencocokkan callsign OpenSky
        wm = wd.get(qid_m, {}) if qid_m else {}
        icao_m = ((wm.get("callsign_icao") or wm.get("icao") or "")).upper()

        # kunci penggabungan: IATA netral-bahasa dulu. QID/artikel hanya cadangan.
        # Tanpa ini, Citilink-Zhangjiajie dari EN dan ID jadi dua baris karena
        # judul ID-nya red link sehingga QID-nya kosong.
        k = (qid_m or maskapai.lower(), iata or qid_b or artikel_b.lower())
        if k not in kunci_baris:
            kunci_baris[k] = {
                "maskapai": maskapai,
                "artikel_maskapai": artikel_m,
                "icao_maskapai": icao_m,
                "bandara_lawan": nama_b,
                "artikel_bandara": artikel_b,
                "kota": kota,
                "negara": negara,
                "kode_iata": iata,
                "kode_icao": icao,
                "status_operasi": status,
                "sumber_wikipedia": sumber,
            }
        else:
            r = kunci_baris[k]
            if sumber not in r["sumber_wikipedia"].split("+"):
                r["sumber_wikipedia"] = "+".join(
                    sorted(set(r["sumber_wikipedia"].split("+")) | {sumber}))
            # nama Inggris lebih standar untuk deliverable; ID dipakai bila hanya itu
            if sumber == "en":
                r["maskapai"], r["bandara_lawan"] = maskapai, nama_b
            if not r["status_operasi"] and status:
                r["status_operasi"] = status
            if not r["kode_iata"] and iata:
                r["kode_iata"], r["kode_icao"] = iata, icao
            if not r["kota"] and kota:
                r["kota"] = kota
            if not r["negara"] and negara:
                r["negara"] = negara
            if not r["icao_maskapai"] and icao_m:
                r["icao_maskapai"] = icao_m

    for b in baris_en:
        for t in b["tujuan"]:
            daftarkan(b["maskapai"], b["artikel_maskapai"], t["artikel"], t["nama"], t["status"], "en")
    for b in baris_id:
        for t in b["tujuan"]:
            daftarkan(b["maskapai"], b["artikel_maskapai"], t["artikel"], t["nama"], t["status"], "id")

    # ── tambahan dari OpenSky yang tidak tercantum Wikipedia
    #
    # Dua hal yang harus disaring supaya deliverable tidak menampilkan sampah:
    #  1. Asal == WIII (CGK) adalah artefak: saat cakupan receiver tipis, OpenSky
    #     tidak bisa memperkirakan bandara asal dan membiarkannya sama dengan
    #     bandara tujuan. Itu bukan rute.
    #  2. Pergerakan di dalam Jakarta (HLP Halim, PCB Pondok Cabe) juga bukan
    #     "rute ke Jakarta" — jaraknya belasan kilometer.
    # Ditambah ambang observasi supaya penerbangan charter/positioning sekali
    # jalan (mis. Le Bourget, Al Maktoum) tidak dijual sebagai rute terjadwal.
    of_lawan = {r["lawan_iata"] for r in routes_of}
    DIKECUALIKAN = {CGK_ICAO, "WIHH", "WIHP"}  # CGK sendiri, Halim, Pondok Cabe
    AMBANG_OPENSKY_SAHAJA = 5

    baris_tambahan = []
    for icao_asal, v in agg.items():
        if icao_asal in DIKECUALIKAN:
            continue
        iata_asal = icao_ke_iata.get(icao_asal, "")
        if not iata_asal:
            continue
        if any(r["kode_iata"] == iata_asal for r in kunci_baris.values()):
            continue
        if v["jumlah"] < AMBANG_OPENSKY_SAHAJA:
            continue
        rec = air_iata.get(iata_asal) or oa.get("by_iata", {}).get(iata_asal) \
              or oa.get("by_icao", {}).get(icao_asal) or {}
        # nama maskapai dari kode ICAO callsign (bukan dari 'callsign' = nama panggilan)
        nama_maskapai = []
        for c in sorted(v["per_maskapai"]):
            a = air_icao.get(c.upper())
            nama_maskapai.append(a["nama"] if a else c)
        baris_tambahan.append({
            "maskapai": ", ".join(dict.fromkeys(nama_maskapai)) or "(tidak teridentifikasi)",
            "bandara_lawan": rec.get("nama") or icao_asal,
            "kota": rec.get("kota", "") or "",
            "negara": normalkan_negara(rec.get("negara", "") or ""),
            "kode_iata": iata_asal,
            "kode_icao": icao_asal,
            "jumlah_obs": v["jumlah"],
            "per_maskapai": dict(v["per_maskapai"]),
        })

    # ── susun keluaran
    rows = []
    idx = 0

    def obs_untuk(icao_bandara: str, icao_maskapai: str) -> tuple[int, str]:
        """Kedatangan teramati untuk SATU maskapai dari SATU bandara.

        Mengembalikan (jumlah_per_maskapai, total_rute_seluruh_maskapai).
        Angka lama yang mengembalikan total rute untuk setiap baris maskapai
        menyesatkan: delapan maskapai di rute SIN sama-sama menampilkan 230.
        """
        v = agg.get(icao_bandara or "", {})
        if not isinstance(v, dict):
            return 0, 0
        per = v.get("per_maskapai", {})
        n = per.get((icao_maskapai or "").upper(), 0) if icao_maskapai else 0
        return int(n), int(v.get("jumlah", 0))

    for r in sorted(kunci_baris.values(), key=lambda x: (x["maskapai"].lower(), x["bandara_lawan"].lower())):
        idx += 1
        iata = r["kode_iata"]
        n_mask, n_rute = obs_untuk(r.get("kode_icao") or "", r.get("icao_maskapai") or "")
        r["negara"] = normalkan_negara(r.get("negara") or "")
        internasional = bool(r["negara"]) and r["negara"].lower() not in (
            "indonesia", "indonesian", "")
        rows.append({
            "id": f"rute-cgk-{idx:04d}",
            "maskapai": r["maskapai"],
            "bandara_lawan": r["bandara_lawan"],
            "kota": r["kota"],
            "negara": r["negara"],
            "kode_iata": iata,
            "kode_icao": r["kode_icao"],
            "rute": f"{CGK_IATA}-{iata}" if iata else "",
            "jenis_rute": ("internasional" if internasional else "domestik") if r["negara"] else "belum_dilabeli",
            "status_operasi": r["status_operasi"],
            "sumber_wikipedia": r["sumber_wikipedia"],
            "ada_di_openflights": iata in of_lawan,
            "opensky_kedatangan_teramati": n_mask,
            "opensky_kedatangan_rute_total": n_rute,
            "sumber": "wikipedia" + ("+openflights" if iata in of_lawan else "")
                      + ("+opensky" if n_mask else ""),
        })

    for r in baris_tambahan:
        idx += 1
        r["negara"] = normalkan_negara(r.get("negara") or "")
        internasional = r["negara"].lower() not in ("indonesia", "indonesian", "")
        kode_mask = ", ".join(sorted(r["per_maskapai"]))
        rows.append({
            "id": f"rute-cgk-{idx:04d}",
            "maskapai": r["maskapai"],
            "bandara_lawan": r["bandara_lawan"],
            "kota": r["kota"],
            "negara": r["negara"],
            "kode_iata": r["kode_iata"],
            "kode_icao": r["kode_icao"],
            "rute": f"{CGK_IATA}-{r['kode_iata']}" if r["kode_iata"] else "",
            "jenis_rute": "internasional" if internasional else "domestik",
            "status_operasi": "",
            "sumber_wikipedia": "",
            "ada_di_openflights": r["kode_iata"] in of_lawan,
            "opensky_kedatangan_teramati": r["jumlah_obs"],
            "opensky_kedatangan_rute_total": r["jumlah_obs"],
            "sumber": "opensky",
            "kode_icao_maskapai_teramati": kode_mask,
        })

    n_dom = sum(1 for r in rows if r["jenis_rute"] == "domestik")
    n_int = sum(1 for r in rows if r["jenis_rute"] == "internasional")
    n_blm = sum(1 for r in rows if r["jenis_rute"] == "belum_dilabeli")
    lawan_unik = {r["kode_iata"] for r in rows if r["kode_iata"]}

    revid_en = cache["sumber"][kunci_en].get("revid")
    revid_id = cache["sumber"][kunci_id].get("revid")
    tgl = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Keterangan dataset dikosongkan atas permintaan. Catatan metode (sumber,
    # cakupan OpenSky, aturan penyaringan) tetap terdokumentasi di docstring
    # skrip ini dan di deskripsi tiap kolom — tidak di deskripsi dataset.
    deskripsi = ""

    out = {
        "slug": "penerbangan-langsung-jakarta",
        "title": "Penerbangan Langsung ke Jakarta (rute nonstop CGK)",
        "description": deskripsi,
        "tags": ["penerbangan", "rute", "bandara", "CGK", "Soekarno-Hatta", "konektivitas", "gpci", "AC-DF", "opensky", "sekunder"],
        "columns": [
            {"key": "id", "label": "ID", "type": "string", "description": "Penanda baris"},
            {"key": "maskapai", "label": "Maskapai", "type": "string", "description": "Nama maskapai yang mengoperasikan rute"},
            {"key": "bandara_lawan", "label": "Bandara Lawan", "type": "string", "description": "Bandara di ujung rute selain CGK"},
            {"key": "kota", "label": "Kota", "type": "string", "description": "Kota bandara lawan (dari OpenFlights)"},
            {"key": "negara", "label": "Negara", "type": "string", "description": "Negara bandara lawan (Wikidata P17)"},
            {"key": "kode_iata", "label": "IATA", "type": "string", "description": "Kode IATA bandara lawan"},
            {"key": "kode_icao", "label": "ICAO", "type": "string", "description": "Kode ICAO bandara lawan"},
            {"key": "rute", "label": "Rute", "type": "string", "description": "Pasangan kode IATA CGK-bandara lawan"},
            {"key": "jenis_rute", "label": "Jenis Rute", "type": "string (domestik / internasional / belum_dilabeli)", "description": "Klasifikasi menurut negara bandara lawan"},
            {"key": "status_operasi", "label": "Status Operasi", "type": "string", "description": "Catatan status dari Wikipedia: begins/ends/resumes/seasonal, kosong bila reguler"},
            {"key": "sumber_wikipedia", "label": "Sumber Wikipedia", "type": "string (en / id / en+id)", "description": "Wikipedia bahasa mana yang mencantumkan rute ini"},
            {"key": "ada_di_openflights", "label": "Ada di OpenFlights", "type": "bool", "description": "True bila OpenFlights routes.dat (snapshot lama) juga memuat rute CGK-bandara ini"},
            {"key": "opensky_kedatangan_teramati", "label": "Kedatangan Teramati (maskapai ini)", "type": "number", "description": "Jumlah kedatangan aktual yang terlacak OpenSky dari bandara ini DENGAN maskapai pada baris ini, selama jendela pengamatan. Bukan frekuensi terjadwal."},
            {"key": "opensky_kedatangan_rute_total", "label": "Kedatangan Teramati (seluruh rute)", "type": "number", "description": "Jumlah seluruh kedatangan teramati dari bandara ini, semua maskapai digabung. Untuk membandingkan kontribusi tiap maskapai pada rute yang sama."},
            {"key": "sumber", "label": "Sumber", "type": "string", "description": "Gabungan sumber yang mengonfirmasi baris ini: wikipedia, openflights, opensky"},
        ],
        "rows": rows,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=0)

    print(f"\n== Selesai ==")
    print(f"  baris           : {len(rows)}")
    print(f"  bandara lawan   : {len(lawan_unik)}")
    print(f"  domestik        : {n_dom}")
    print(f"  internasional   : {n_int}")
    print(f"  belum dilabeli  : {n_blm}")
    print(f"  + dari OpenSky  : {len(baris_tambahan)}")
    print(f"  keluaran        : {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
