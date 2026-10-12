#!/usr/bin/env python3
"""Build dua dataset sekunder MICE Jakarta:

  - `venue-mice-jakarta`         — inventori venue MICE (venue khusus + hotel
                                   bintang 4–5 berfasilitas pertemuan)
  - `kegiatan-mice-jakarta-2026` — acara yang berlangsung di venue MICE
                                   sepanjang 2026 (semua jenis acara)

Input (semuanya di repo, bisa diaudit per baris):
  1. `scripts/mice/venue_khusus.json`  — 36 venue khusus hasil riset web
     (situs resmi venue + sumber kedua), termasuk venue "Jakarta" di luar DKI
     (NICE PIK2, ICE BSD, SICC) yang ditandai `di_dki=false`.
  2. `scripts/mice/hotel_ballroom.json` — riset fasilitas ballroom/ruang
     pertemuan 87 hotel bintang 4–5 beroperasi dari `hotel-kamar-jakarta`.
     Entri dengan nama hotel terkini yang sama digabung jadi satu baris.
  3. `scripts/jiexpo_events_cache.json` — hasil `scripts/crawl_jiexpo_events.py`
     (kalender resmi JIExpo, API WordPress publik + JSON-LD).
  4. `scripts/mice/events_lain.json` — riset kalender venue lain (kalender
     resmi ICE BSD, NICE, Balai Kartini; selebihnya berita/penyelenggara).
  5. `data/sekunder/event-visitors-2026.json` — data izin event Disparekraf
     2026; hanya baris yang lokasinya cocok dengan venue MICE yang diambil.

Duplikat acara antarsumber digabung bila venue sama, nama mirip (lihat
`nama_mirip`) dan tanggal mulai berselisih ≤ 14 hari; sumber dengan prioritas
lebih tinggi (urutan di atas) dipertahankan. Acara berulang (mis. pameran
kuartalan) tetap terpisah karena tanggalnya berjauhan.

Venue: hotel yang juga tercatat sebagai venue khusus, dan hotel yang bagian dari
hotel lain, digabung (lihat `VENUE_KHUSUS_HOTEL`, `HOTEL_INDUK`).

Output: `data/sekunder/<slug>.json` + mirror `platform-v2/data/<slug>.json`.
Tanpa akses jaringan; idempoten. Jalankan dari root repo:
    python3 scripts/mice/build.py
"""
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "scripts" / "mice"
OUT_DIRS = (ROOT / "data" / "sekunder", ROOT / "platform-v2" / "data")

KOTA = {
    "JAKARTA PUSAT": "Jakarta Pusat", "JAKARTA SELATAN": "Jakarta Selatan",
    "JAKARTA BARAT": "Jakarta Barat", "JAKARTA TIMUR": "Jakarta Timur",
    "JAKARTA UTARA": "Jakarta Utara", "KEPULAUAN SERIBU": "Kepulauan Seribu",
}

# Kata kunci lokasi (huruf besar) → nama venue terstandar, untuk mencocokkan
# kolom `lokasi` data izin event Disparekraf.
VENUE_KUNCI = {
    "JIExpo Kemayoran": ["JIEXPO", "JI EXPO", "JAKARTA INTERNATIONAL EXPO", "PRJ KEMAYORAN"],
    "Gambir Expo": ["GAMBIR EXPO"],
    "JICC Senayan": ["JICC", "JAKARTA CONVENTION CENTER", "JAKARTA INTERNATIONAL CONVENTION"],
    "Balai Kartini": ["BALAI KARTINI"],
    "Gedung SMESCO": ["SMESCO"],
    "Indonesia Arena GBK": ["INDONESIA ARENA"],
    "Istora Senayan": ["ISTORA"],
    "Tennis Indoor Senayan": ["TENNIS INDOOR", "TENIS INDOOR"],
    "Basket Hall GBK": ["BASKET HALL"],
    "Plaza Tenggara GBK": ["PLAZA TENGGARA"],
    "Beach City International Stadium Ancol": ["BEACH CITY"],
    "Ecovention Hall Ancol": ["ECOVENTION"],
    "The Kasablanka Hall": ["KASABLANKA"],
    "Senayan Park": ["SENAYAN PARK"],
    "BritAma Arena": ["BRITAMA"],
    "Jakarta International Velodrome": ["VELODROME"],
    "Gedung Sasana Kriya TMII": ["SASANA KRIYA"],
    "Gedung Dhanapala": ["DHANAPALA"],
    "Balai Sudirman": ["BALAI SUDIRMAN"],
    "Ciputra Artpreneur": ["ARTPRENEUR"],
    "Taman Ismail Marzuki - Teater Besar": ["TEATER BESAR"],
    "Taman Ismail Marzuki - Graha Bhakti Budaya": ["GRAHA BHAKTI BUDAYA"],
    "Gedung Kesenian Jakarta": ["GEDUNG KESENIAN JAKARTA"],
    "Pos Bloc Jakarta": ["POS BLOC"],
    "Balai Sarbini": ["BALAI SARBINI"],
}

# Venue khusus yang sebenarnya hotel bintang 4–5 dan sudah ada di daftar hotel
# (awalan nama venue → id hotel). Barisnya tidak dihitung dua kali.
VENUE_KHUSUS_HOTEL = {"The Sultan Hotel & Residence": "H244"}

# Hotel yang fasilitas MICE-nya milik hotel lain (id → id hotel induk).
HOTEL_INDUK = {"N052": "N051"}  # InterContinental Residences → InterContinental Pondok Indah

JENIS_JIEXPO = {
    "Exhibition": "Pameran", "Concert / Festival": "Konser/Festival", "Concert": "Konser",
    "Festival": "Festival", "Private/Corporate": "Korporat/Privat", "Sporting": "Olahraga",
    "Non Exhibition": "Lainnya", "": "Lainnya",
}

# Jenis acara bebas di data izin → kategori yang sama dengan sumber lain.
JENIS_IZIN = [
    ("Pameran", ("PAMERAN", "EXHIBITION", "EXPO", "TRADE", "FAIR")),
    ("Konferensi/Konvensi", ("KONFERENSI", "CONVENTION", "KONVENSI", "KONGRES")),
    ("Seminar/Forum", ("SEMINAR", "FORUM", "EDUKASI", "TALKSHOW", "MEETING")),
    ("Festival", ("FESTIVAL",)),
    ("Olahraga", ("CHAMPIONSHIP", "KEJUARAAN", "OLAHRAGA", "TURNAMEN", "FENCING")),
    ("Pertunjukan", ("TEATER", "DRAMA", "MUSIKAL", "MUSICAL")),
    ("Konser", ("KONSER", "MUSIK", "DJ", "SHOWCASE", "FAN", "CONCERT")),
]

BULAN = {b: i for i, b in enumerate(
    ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI",
     "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"], 1)}


def norm(s: str) -> str:
    s = re.sub(r"\b20\d\d\b", " ", s.lower())
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def iso(d: str | None) -> str:
    """'2026-11-4' / '2026-11-7T14:00+7:00' → '2026-11-04'."""
    m = re.match(r"(\d{4})-(\d{1,2})-(\d{1,2})", d or "")
    return f"{m[1]}-{int(m[2]):02d}-{int(m[3]):02d}" if m else ""


def nama_mirip(a: str, b: str) -> bool:
    """Nama acara sama, atau token nama yang lebih pendek (≥ 3 token) termuat
    utuh di nama yang lebih panjang ('Bryan Adams - Roll with the Punches
    (special guest …)' ≈ 'BRYAN ADAMS "ROLL WITH THE PUNCHES"')."""
    ta, tb = norm(a).split(), norm(b).split()
    if ta == tb:
        return True
    pendek, panjang = sorted((ta, tb), key=len)
    return len(pendek) >= 3 and set(pendek) <= set(panjang)


def selisih_hari(a: str, b: str) -> int | None:
    if not (a and b):
        return None
    return abs((date.fromisoformat(a) - date.fromisoformat(b)).days)


def tanggal_izin(t: str) -> tuple[str, str]:
    """Teks tanggal izin ('6 - 8 FEBRUARI 2026', '30 JANUARI - 1 FEBRUARI 2026')."""
    t = re.sub(r"\s+", " ", (t or "").upper())
    t = re.sub(r" ?(?:&|DAN) ?", " - ", t)  # '04 & 05 JULI' / '20 DAN 27 FEB' → rentang
    m = re.match(r"(\d{1,2})(?: ([A-Z]+))?(?: (\d{4}))? ?[-–] ?(\d{1,2}) ([A-Z]+) (\d{4})", t)
    if m and m[5] in BULAN:
        b1 = BULAN.get(m[2] or m[5])
        y1 = m[3] or m[6]
        if b1:
            return f"{y1}-{b1:02d}-{int(m[1]):02d}", f"{m[6]}-{BULAN[m[5]]:02d}-{int(m[4]):02d}"
    m = re.match(r"(\d{1,2}) ([A-Z]+) (\d{4})", t)
    if m and m[2] in BULAN:
        d = f"{m[3]}-{BULAN[m[2]]:02d}-{int(m[1]):02d}"
        return d, d
    return "", ""


def venue_baku(nama: str) -> str:
    """Nama venue dari sumber mana pun → nama baku `VENUE_KUNCI` (bila cocok)."""
    up = re.sub(r"\s+", " ", (nama or "").upper())
    return next((v for v, ks in VENUE_KUNCI.items() if any(k in up for k in ks)), nama)


def load(name: str):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def kota(s: str | None) -> str:
    """Nama kota administrasi DKI dibakukan; wilayah lain dipertahankan apa
    adanya supaya 'Kota …' dan 'Kab. …' tetap bisa dibedakan."""
    raw = re.sub(r"\s+", " ", (s or "").strip())
    inti = re.sub(r"^(KOTA ADMINISTRASI|KOTA ADM\.?|KOTA) ", "", raw.upper())
    return KOTA.get(inti, raw.title() if raw.isupper() else raw)


# ── Venue ────────────────────────────────────────────────────────────────

VENUE_COLS = [
    ("id", "ID", "string", None),
    ("nama_venue", "Nama Venue", "string", None),
    ("kategori", "Kategori", "string", "Venue khusus MICE atau hotel bintang 4–5"),
    ("jenis", "Jenis", "string", None),
    ("golongan_hotel", "Golongan Hotel", "string", None),
    ("alamat", "Alamat", "string", None),
    ("kab_kota", "Kabupaten/Kota", "string", None),
    ("provinsi", "Provinsi", "string", None),
    ("di_dki", "Di DKI Jakarta", "string", "ya/tidak — venue 'Jakarta' di luar DKI ditandai tidak"),
    ("status_operasi", "Status Operasi", "string", None),
    ("punya_ballroom", "Punya Ballroom", "string", "Khusus hotel: ya/tidak/belum pasti"),
    ("ruang_terbesar", "Ruang/Ballroom Terbesar", "string", None),
    ("kapasitas_maks_orang", "Kapasitas Maks (orang)", "number", "Angka maksimum yang dipublikasikan, umumnya susunan berdiri/resepsi"),
    ("luas_m2", "Luas (m²)", "number", "Venue khusus: luas hall/bangunan (lihat catatan); hotel: luas ballroom terbesar"),
    ("jumlah_ruang", "Jumlah Ruang/Hall", "number", None),
    ("url_sumber", "Sumber", "string", None),
    ("url_verifikasi", "Sumber Verifikasi", "string", None),
    ("status_verifikasi", "Status Verifikasi", "string", None),
    ("catatan", "Catatan", "string", None),
]


def yn(v) -> str:
    return {True: "ya", False: "tidak"}.get(v, "belum pasti")


def build_venue() -> list[dict]:
    rows = []
    hotel_dobel: dict[str, str] = {}
    for i, v in enumerate(load("venue_khusus.json"), 1):
        hid = next((h for awal, h in VENUE_KHUSUS_HOTEL.items() if v["nama_venue"].startswith(awal)), None)
        if hid:  # dihitung sebagai hotel; id V-nya sengaja dilewati
            hotel_dobel[hid] = f"V{i:03d}"
            continue
        rows.append({
            "id": f"V{i:03d}", "nama_venue": v["nama_venue"], "kategori": "Venue khusus",
            "jenis": v["jenis"], "golongan_hotel": "", "alamat": v["alamat"] or "",
            "kab_kota": kota(v["kab_kota"]), "provinsi": v["provinsi"] or "",
            "di_dki": yn(v["di_dki"]), "status_operasi": v["status_operasi"] or "belum diketahui",
            "punya_ballroom": "", "ruang_terbesar": "",
            "kapasitas_maks_orang": v["kapasitas_maks_orang"], "luas_m2": v["luas_m2"],
            "jumlah_ruang": v["jumlah_ruang"], "url_sumber": v["url_sumber"] or "",
            "url_verifikasi": v["url_verifikasi"] or "", "status_verifikasi": v["status_verifikasi"],
            "catatan": v["catatan"] or "",
        })
    seen: dict[str, dict] = {}
    by_id: dict[str, dict] = {}
    for h in load("hotel_ballroom.json"):
        key = norm(h["nama_hotel"])
        induk = by_id.get(HOTEL_INDUK.get(h["id"], ""))
        dup = seen.get(key) or induk
        if dup:  # hotel sama tercatat dua kali, atau bagian dari hotel induk
            alasan = "bagian dari hotel ini" if induk else "hotel yang sama"
            dup["catatan"] = (dup["catatan"] + f" {h['id']} di hotel-kamar-jakarta ({h['nama_hotel']}) digabung ke sini: {alasan}.").strip()
            continue
        row = {
            "id": h["id"], "nama_venue": h["nama_hotel"], "kategori": "Hotel bintang 4–5",
            "jenis": "Hotel (ballroom)" if h["punya_ballroom"] else "Hotel (ruang pertemuan)",
            "golongan_hotel": h["golongan"].title(), "alamat": h["alamat"] or "",
            "kab_kota": kota(h["kab_kota"]), "provinsi": "DKI Jakarta", "di_dki": "ya",
            "status_operasi": h["status_operasi"] or "belum diketahui",
            "punya_ballroom": yn(h["punya_ballroom"]), "ruang_terbesar": h["nama_ballroom_terbesar"] or "",
            "kapasitas_maks_orang": h["kapasitas_ballroom_maks_orang"], "luas_m2": h["luas_ballroom_m2"],
            "jumlah_ruang": h["jumlah_ruang_pertemuan"], "url_sumber": h["url_sumber"] or "",
            "url_verifikasi": "", "status_verifikasi": h["status_verifikasi"], "catatan": h["catatan"] or "",
        }
        if h["id"] in hotel_dobel:
            row["catatan"] = (row["catatan"] + f" Juga diinventarisasi sebagai venue khusus {hotel_dobel[h['id']]}; dihitung sekali di sini.").strip()
        seen[key] = by_id[h["id"]] = row
        rows.append(row)
    missing = set(HOTEL_INDUK) - {h["id"] for h in load("hotel_ballroom.json")} | set(VENUE_KHUSUS_HOTEL.values()) - set(by_id)
    assert not missing, f"id hotel tak dikenal: {missing}"
    return rows


# ── Kegiatan ─────────────────────────────────────────────────────────────

EVENT_COLS = [
    ("id", "ID", "string", None),
    ("nama_acara", "Nama Acara", "string", None),
    ("tanggal_mulai", "Tanggal Mulai", "date", None),
    ("tanggal_selesai", "Tanggal Selesai", "date", None),
    ("bulan_mulai", "Bulan Mulai", "number", None),
    ("venue", "Venue", "string", None),
    ("lokasi_detail", "Lokasi Detail", "string", None),
    ("kab_kota", "Kabupaten/Kota", "string", None),
    ("di_dki", "Di DKI Jakarta", "string", None),
    ("jenis_acara", "Jenis Acara", "string", None),
    ("penyelenggara", "Penyelenggara", "string", None),
    ("sumber_data", "Sumber Data", "string", None),
    ("url_sumber", "URL Sumber", "string", None),
    ("status_verifikasi", "Status Verifikasi", "string", None),
    ("catatan", "Catatan", "string", None),
]


def in_2026(a: str, b: str) -> bool:
    return a[:4] == "2026" or b[:4] == "2026"


def build_events() -> list[dict]:
    out: list[dict] = []

    def add(r: dict) -> None:
        for o in out:
            if o["venue"] != r["venue"] or not nama_mirip(o["nama_acara"], r["nama_acara"]):
                continue
            beda = selisih_hari(o["tanggal_mulai"], r["tanggal_mulai"])
            if beda is not None and beda <= 14 or (beda is None and norm(o["nama_acara"]) == norm(r["nama_acara"])):
                o["catatan"] = (o["catatan"] + f" Juga tercatat di {r['sumber_data']}"
                                + (f" ({r['tanggal_mulai']})" if r["tanggal_mulai"] != o["tanggal_mulai"] else "") + ".").strip()
                return
        out.append(r)

    cache = json.loads((ROOT / "scripts" / "jiexpo_events_cache.json").read_text(encoding="utf-8"))
    for v in sorted(cache.values(), key=lambda v: (iso(v.get("mulai")), v["judul"])):
        a, b = iso(v.get("mulai")), iso(v.get("selesai"))
        if v["status"] != "ok" or not in_2026(a, b):
            continue
        add({
            "nama_acara": v["judul"], "tanggal_mulai": a, "tanggal_selesai": b or a,
            "venue": "JIExpo Kemayoran", "lokasi_detail": v.get("lokasi_detail", ""),
            "kab_kota": "Jakarta Pusat", "di_dki": "ya",
            "jenis_acara": JENIS_JIEXPO.get(v["kategori_jiexpo"].split(", ")[0], "Lainnya"),
            "penyelenggara": v.get("penyelenggara", ""), "sumber_data": "Kalender resmi JIExpo",
            "url_sumber": v["link"], "status_verifikasi": "terkonfirmasi", "catatan": "",
        })

    for e in load("events_lain.json"):
        a, b = e["tanggal_mulai"] or "", e["tanggal_selesai"] or e["tanggal_mulai"] or ""
        if not in_2026(a, b):
            continue
        add({
            "nama_acara": e["nama_acara"], "tanggal_mulai": a, "tanggal_selesai": b,
            "venue": venue_baku(e["venue"]), "lokasi_detail": e["lokasi_detail"] or "",
            "kab_kota": kota(e["kab_kota"]), "di_dki": yn(e["di_dki"]),
            "jenis_acara": e["jenis_acara"], "penyelenggara": e["penyelenggara"] or "",
            "sumber_data": "Riset kalender venue/penyelenggara/berita", "url_sumber": e["url_sumber"] or "",
            "status_verifikasi": e["status_verifikasi"], "catatan": e["catatan"] or "",
        })

    izin = json.loads((ROOT / "data" / "sekunder" / "event-visitors-2026.json").read_text(encoding="utf-8"))
    for r in izin["rows"]:
        lok = re.sub(r"\s+", " ", (r.get("lokasi") or "").upper())
        venue = venue_baku(lok)
        # Lewati lokasi berganda, mis. city tour "JAKARTA (POS BLOC, MONAS, BLOK M)".
        if venue == lok or re.search(r"\([^)]*,[^)]*\)", lok):
            continue
        a, b = tanggal_izin(r.get("tanggal") or "")
        add({
            "nama_acara": (r.get("nama_event") or "").strip(), "tanggal_mulai": a, "tanggal_selesai": b,
            "venue": venue, "lokasi_detail": (r.get("lokasi") or "").strip(),
            "kab_kota": kota(r.get("kota")), "di_dki": "ya",
            "jenis_acara": next((j for j, ks in JENIS_IZIN if any(k in (r.get("jenis_event") or "").upper() for k in ks)), "Lainnya"),
            "penyelenggara": (r.get("penyelenggara") or "").strip(),
            "sumber_data": "Data izin event Disparekraf DKI 2026", "url_sumber": "",
            "status_verifikasi": "terkonfirmasi" if a else "perlu review",
            "catatan": f"Jenis di sumber: {(r.get('jenis_event') or '-').strip()}."
            + ("" if a else f" Tanggal sumber tidak terbaca: {r.get('tanggal')!r}."),
        })

    out.sort(key=lambda r: (r["tanggal_mulai"] or "9999", r["nama_acara"]))
    for i, r in enumerate(out, 1):
        r["id"] = f"E{i:04d}"
        r["bulan_mulai"] = int(r["tanggal_mulai"][5:7]) if r["tanggal_mulai"] else None
    return [{k: r[k] for k, *_ in EVENT_COLS} for r in out]


def write(slug: str, title: str, description: str, cols, rows) -> None:
    data = {
        "slug": slug, "title": title, "description": description,
        "columns": [{"key": k, "label": l, "type": t, "description": d} for k, l, t, d in cols],
        "rows": [{k: r[k] for k, *_ in cols} for r in rows],
    }
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    for d in OUT_DIRS:
        (d / f"{slug}.json").write_text(text, encoding="utf-8")


def main() -> None:
    venues = build_venue()
    vk = Counter(r["kategori"] for r in venues)
    v_dki = sum(r["di_dki"] == "ya" for r in venues)
    write(
        "venue-mice-jakarta", "Venue MICE Jakarta (2026)",
        f"Inventori {len(venues)} venue MICE: {vk['Venue khusus']} venue khusus (convention/exhibition "
        f"center, gedung serbaguna, arena indoor) dan {vk['Hotel bintang 4–5']} hotel bintang 4–5 "
        f"berfasilitas ballroom/ruang pertemuan; {v_dki} di DKI Jakarta, sisanya venue berlabel "
        "'Jakarta' di luar DKI. Kapasitas & luas dari situs resmi venue/hotel; tiap baris punya "
        "sumber dan status verifikasi.",
        VENUE_COLS, venues,
    )
    events = build_events()
    e_dki = sum(r["di_dki"] == "ya" for r in events)
    write(
        "kegiatan-mice-jakarta-2026", "Kegiatan di Venue MICE Jakarta 2026",
        f"{len(events)} acara (pameran, konferensi, konser, festival, olahraga, dll.) yang "
        f"berlangsung di venue MICE sepanjang 2026; {e_dki} di DKI Jakarta. Sumber: kalender "
        "resmi JIExpo, ICE BSD, NICE PIK2 dan Balai Kartini, kalender penyelenggara, berita, "
        "serta data izin event Disparekraf DKI. Cakupan venue tanpa kalender resmi masih parsial.",
        EVENT_COLS, events,
    )
    print(f"venue: {len(venues)} ({dict(vk)}; DKI {v_dki}) | "
          f"kegiatan: {len(events)} (DKI {e_dki}) {dict(Counter(r['sumber_data'] for r in events))}")


if __name__ == "__main__":
    main()
