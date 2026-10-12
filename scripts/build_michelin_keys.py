#!/usr/bin/env python3
"""Build dataset 'michelin-keys-indonesia' — hotel peraih MICHELIN Key di Indonesia.

Sumber:
  1. MICHELIN Guide, daftar hotel Indonesia berfilter "all keys"
     (https://guide.michelin.com/en/hotels-stays/indonesia?distinction=all-keys),
     edisi MICHELIN Keys 2026 (terbit 18 Sep 2026). Situs memblokir akses
     otomatis, jadi faktanya ditranskripsi dari hasil yang disalin pengguna
     dari browser (47 hotel). Yang diambil HANYA fakta: nama, jumlah Key,
     lokasi, alamat, jumlah kamar, koordinat, URL. Teks ulasan dan foto
     MICHELIN tidak disalin.
  2. Verifikasi silang: siaran Kemenpar (20 Sep 2026) yang dimuat media —
     3 hotel 3 Keys, 11 hotel 2 Keys, 33 hotel 1 Key; seluruh nama dan
     tingkat Key cocok dengan sumber 1.

`kab_kota` dan `provinsi` diturunkan dari alamat/kode pos, bukan dari label
wilayah MICHELIN (label itu kadang keliru, mis. Garrya Bianti di Sleman,
DI Yogyakarta, ditandai "Central Java").

Output:
  - data/sekunder/michelin-keys-indonesia.json    (format standar repo)
  - platform-v2/data/michelin-keys-indonesia.json (mirror untuk app)

Idempoten — tanpa akses jaringan, hasil ditulis ulang utuh.
"""
from __future__ import annotations

import json
from pathlib import Path

SLUG = "michelin-keys-indonesia"
EDISI = "2026"
MG = "https://guide.michelin.com/en/hotels-stays/"
VERIF = {
    1: "https://balinews.id/47-hotel-indonesia-sabet-michelin-keys-2026-rekor-baru-dan-terbanyak-kedua-di-asia-tenggara/",
    2: "https://www.beritasatu.com/lifestyle/3028134/daftar-47-hotel-dan-resor-indonesia-yang-raih-michelin-keys-2026",
    3: "https://balinews.id/47-hotel-indonesia-sabet-michelin-keys-2026-rekor-baru-dan-terbanyak-kedua-di-asia-tenggara/",
}
LABEL = {1: "1 Key — A Very Special Stay", 2: "2 Keys — An Exceptional Stay", 3: "3 Keys — An Extraordinary Stay"}

# (nama, key, lokasi MICHELIN, kab/kota, provinsi, alamat, kamar, lat, lon, path URL MICHELIN)
HOTELS = [
    ("COMO Shambhala Estate", 1, "Ubud", "Kab. Gianyar", "Bali", "Desa Melinggih Kelod, Payangan, Gianyar", 31, -8.450783, 115.235451, "ubud/como-shambhala-estate-119"),
    ("Chapung Sebali", 1, "Ubud", "Kab. Gianyar", "Bali", "Jl. Raya Sebali, Banjar Sebali, Desa Keliki, Tegallalang", 22, -8.479186, 115.26046, "ubud/chapung-sebali-8871"),
    ("Amandari", 1, "Ubud", "Kab. Gianyar", "Bali", "Jl. Raya Kedewatan", 30, -8.488578, 115.244703, "ubud/amandari-7257"),
    ("Amankila", 2, "Manggis", "Kab. Karangasem", "Bali", "Jl. Amankila Resorts, Manggis", 31, -8.498983, 115.528566, "manggis/amankila-7258"),
    ("Viceroy Bali", 1, "Ubud", "Kab. Gianyar", "Bali", "Jl. Lanyahan, Br. Nagi", 40, -8.494038, 115.277464, "ubud/viceroy-bali-4711"),
    ("Bisma Eight Ubud", 1, "Ubud", "Kab. Gianyar", "Bali", "Jl. Bisma No. 68", 38, -8.511584, 115.258156, "ubud/bisma-eight-ubud-8201"),
    ("Nihi Sumba", 3, "Sumba", "Kab. Sumba Barat", "Nusa Tenggara Timur", "Hoba Wawi, Wanokaka", 31, -9.777631, 119.376222, "sumba/nihi-sumba-9235"),
    ("Amanjiwo", 3, "Yogyakarta", "Kab. Magelang", "Jawa Tengah", "Borobudur", 31, -7.631749, 110.20208, "yogyakarta/amanjiwo-7261"),
    ("Plataran Komodo Resort & Spa", 1, "Labuan Bajo", "Kab. Manggarai Barat", "Nusa Tenggara Timur", "Pantai Waecicu", 18, -8.456765, 119.870445, "labuan-bajo/plataran-komodo-resort-spa-8679"),
    ("The Sanchaya", 2, "Bintan", "Kab. Bintan", "Kepulauan Riau", "Plot 5 Jl. Gurindam Duabelas", 30, 1.177466, 104.368229, "bintan/the-sanchaya-8074"),
    ("Desa Potato Head Bali", 1, "Seminyak", "Kab. Badung", "Bali", "Jl. Petitenget No. 51B, Seminyak, Kuta Utara", 225, -8.679052, 115.150328, "seminyak/desa-potato-head-bali-8192"),
    ("Blue Karma Village", 1, "Badung", "Kab. Badung", "Bali", "Umalas 2", 12, -8.66838, 115.150683, "badung/blue-karma-village-7677"),
    ("Cap Karoso", 1, "Sumba", "Kab. Sumba Barat Daya", "Nusa Tenggara Timur", "Pantai Karoso", 67, -9.529126, 118.93568, "sumba/cap-karoso-13451"),
    ("Hotel Tugu Lombok", 1, "Lombok", "Kab. Lombok Utara", "Nusa Tenggara Barat", "Jl. Pantai Sire, Desa Sigar Penjalin", 36, -8.362557, 116.10911, "lombok/hotel-tugu-lombok-7683"),
    ("La Reserve 1785 Canggu - Adults Only", 1, "Canggu", "Kab. Badung", "Bali", "Jl. Munduk Kedungu No. 19, Pererenan, Mengwi", 13, -8.648939, 115.128166, "canggu/la-reserve-1785-canggu-adults-only-16951"),
    ("The Apurva Kempinski Bali", 2, "Nusa Dua", "Kab. Badung", "Bali", "Jl. Raya Nusa Dua Selatan, Sawangan", 475, -8.8283654464, 115.215846953, "nusa-dua/the-apurva-kempinski-bali-15641"),
    ("Lost Lindenberg", 1, "Pekutatan", "Kab. Jembrana", "Bali", "Jl. Ngurah Rai, Pekutatan", 8, -8.435551, 114.845626, "pekutatan/lost-lindenberg-12742"),
    ("Soori Bali", 2, "Tabanan", "Kab. Tabanan", "Bali", "Banjar Dukuh", 45, -8.577043, 115.054804, "tabanan/soori-bali-3911"),
    ("The Purist Villas & Spa", 1, "Ubud", "Kab. Gianyar", "Bali", "Jl. Tirta Tawar, Banjar Kutuh Kaja", 18, -8.494914, 115.270393, "ubud/the-purist-villas-spa-5479"),
    ("REVĪVŌ Wellness Resort Nusa Dua Bali", 1, "Badung", "Kab. Badung", "Bali", "Jl. Desa Sawangan, Benoa, Kuta Selatan", 16, -8.811101, 115.210497, "badung/revivo-wellness-resort-nusa-dua-bali-8966"),
    ("Nirjhara", 1, "Tabanan", "Kab. Tabanan", "Bali", "Jl. Nirjhara No. 29, Br. Kedungu, Belalang, Kediri", 25, -8.603137, 115.088272, "tabanan/nirjhara-10728"),
    ("Jimbaran Puri, A Belmond Hotel, Bali", 1, "Jimbaran Bay", "Kab. Badung", "Bali", "Jl. Uluwatu, Jimbaran", 41, -8.772778, 115.16883, "jimbaran-bay/jimbaran-puri-a-belmond-hotel-bali-6932"),
    ("Samsara Ubud", 1, "Ubud", "Kab. Gianyar", "Bali", "Desa Banjar Ayah, Keliki, Tegallalang", 17, -8.429322, 115.258774, "ubud/samsara-ubud-8937"),
    ("Capella Ubud", 2, "Ubud", "Kab. Gianyar", "Bali", "Jl. Raya Dalem, Banjar Triwangsa, Desa Keliki, Tegallalang", 23, -8.44743, 115.268336, "ubud/capella-ubud-12208"),
    ("The Ridge Bali", 1, "Ubud", "Kab. Gianyar", "Bali", "Jl. Raya Sayan No. 77", 5, -8.4994726577, 115.2446201528, "ubud/the-ridge-bali-13996"),
    ("Bvlgari Resort Bali", 2, "Uluwatu", "Kab. Badung", "Bali", "Jl. Goa Lempeh, Banjar Dinas Kangin", 64, -8.84141, 115.12287, "uluwatu/bulgari-resort-bali-64269-6128"),
    ("The Legian Seminyak", 1, "Seminyak", "Kab. Badung", "Bali", "Jl. Kayu Aya, Pantai Seminyak", 79, -8.684717, 115.153934, "seminyak/the-legian-seminyak-277"),
    ("Four Seasons Resort Bali at Jimbaran Bay", 2, "Jimbaran Bay", "Kab. Badung", "Bali", "Jimbaran Bay", 156, -8.78534, 115.15774, "jimbaran-bay/four-seasons-resort-bali-at-jimbaran-bay-7326"),
    ("Four Seasons Resort Bali at Sayan", 1, "Ubud", "Kab. Gianyar", "Bali", "Jl. Raya Sayan", 60, -8.50161, 115.24407, "ubud/four-seasons-resort-bali-at-sayan-6126"),
    ("Buahan, a Banyan Tree Escape", 2, "Payangan", "Kab. Gianyar", "Bali", "Banjar Selat, Buahan Kaja, Payangan", 16, -8.36799, 115.23607, "Payangan/buahan-a-banyan-tree-escape-12705"),
    ("Mandapa, a Ritz-Carlton Reserve", 3, "Ubud", "Kab. Gianyar", "Bali", "Jl. Kedewatan, Banjar Kedewatan", 60, -8.48569, 115.24563, "ubud/mandapa-a-ritz-carlton-reserve-10894"),
    ("Raffles Jakarta", 1, "Jakarta", "Jakarta Selatan", "DKI Jakarta", "Ciputra World 1, Jl. Prof. Dr. Satrio Kav. 3-5, Setiabudi", 173, -6.224462, 106.823732, "jakarta/raffles-jakarta-12375"),
    ("Four Seasons Hotel Jakarta", 2, "Jakarta", "Jakarta Selatan", "DKI Jakarta", "Jl. Jend. Gatot Subroto Kav. 18", 125, -6.23201, 106.82006, "jakarta/four-seasons-hotel-jakarta-122109-12054"),
    ("The Langham, Jakarta", 2, "Jakarta", "Jakarta Selatan", "DKI Jakarta", "District 8 SCBD, Lot 28", 223, -6.2274, 106.8069, "jakarta/the-langham-jakarta-12238"),
    ("Innit Lombok", 1, "Ekas", "Kab. Lombok Timur", "Nusa Tenggara Barat", "Kampung Berore, Desa Ekas Buana, Jerowaru", 7, -8.88994, 116.45066, "ekas/innit-lombok-13196"),
    ("Garrya Bianti Yogyakarta", 1, "Yogyakarta", "Kab. Sleman", "DI Yogyakarta", "Jl. Gabugan Raya, Pandowoharjo, Sleman", 24, -7.70878, 110.36453, "yogyakarta/garrya-bianti-yogyakarta-13523"),
    ("Raffles Bali", 2, "Bali", "Kab. Badung", "Bali", "Jl. Karang Mas Sejahtera No. 1A, Jimbaran, Kuta Selatan", 32, -8.786074, 115.158325, "bali/raffles-bali-14044"),
    ("Hotel Le Temple Borobudur", 1, "Magelang", "Kab. Magelang", "Jawa Tengah", "Sawah, Borobudur", 18, -7.607963, 110.196543, "magelang/hotel-le-temple-borobudur-14237"),
    ("The St. Regis Jakarta", 1, "Jakarta", "Jakarta Selatan", "DKI Jakarta", "Rajawali Place, Jl. H.R. Rasuna Said Kav. B/4, Setiabudi", 282, -6.20651, 106.82748, "jakarta/the-st-regis-jakarta-13309"),
    ("The Ungasan Clifftop Resort", 1, "Badung", "Kab. Badung", "Bali", "Jl. Pantai Selatan Gau, Banjar Wijaya Kusuma, Ungasan", 35, -8.843517, 115.143499, "badung/the-ungasan-clifftop-resort-16701"),
    ("Jumeirah Bali", 1, "Uluwatu", "Kab. Badung", "Bali", "Jl. Raya Uluwatu, Pecatu, Kuta Selatan", 123, -8.799416, 115.120224, "uluwatu/jumeirah-bali-16672"),
    ("Desa Hay Canggu", 1, "Canggu", "Kab. Badung", "Bali", "Jl. Tumbak Bayuh, Pererenan", 6, -8.62482, 115.136852, "canggu/desa-hay-canggu-16650"),
    ("The Dharmawangsa Jakarta", 1, "Jakarta", "Jakarta Selatan", "DKI Jakarta", "Jl. Brawijaya Raya No. 26, Kebayoran Baru", 99, -6.252763, 106.806352, "jakarta/the-dharmawangsa-jakarta-16430"),
    ("Park Hyatt Jakarta", 1, "Jakarta", "Jakarta Pusat", "DKI Jakarta", "Jl. Kebon Sirih No. 17-19", 220, -6.185583, 106.830944, "jakarta/park-hyatt-jakarta-16428"),
    ("TA’AKTANA, a Luxury Collection Resort & Spa, Labuan Bajo", 1, "Labuan Bajo", "Kab. Manggarai Barat", "Nusa Tenggara Timur", "Pantai Wae Rana", 70, -8.476456, 119.880589, "labuan-bajo/taaktana-a-luxury-collection-resort-spa-labuan-bajo-16262"),
    ("The Orient Jakarta, a Royal Hideaway Hotel", 1, "Jakarta", "Jakarta Pusat", "DKI Jakarta", "Jl. Jend. Sudirman No. 36, Bendungan Hilir, Tanah Abang", 153, -6.215687, 106.816153, "jakarta/the-orient-jakarta-a-royal-hideaway-hotel-16260"),
    ("The St. Regis Bali Resort", 1, "Nusa Dua", "Kab. Badung", "Bali", "Kawasan Pariwisata Nusa Dua, Lot S6", 124, -8.812022, 115.224416, "nusa-dua/the-st-regis-bali-resort-15642"),
]

COLUMNS = [
    ("no", "No", "number", None),
    ("nama_hotel", "Nama Hotel", "string", None),
    ("jumlah_key", "Jumlah MICHELIN Key", "number", "1–3; 3 = tertinggi"),
    ("kategori_key", "Kategori", "string", None),
    ("lokasi_michelin", "Lokasi (label MICHELIN)", "string", "Nama kota/area sebagaimana dipakai MICHELIN Guide"),
    ("kab_kota", "Kabupaten/Kota", "string", "Diturunkan dari alamat"),
    ("provinsi", "Provinsi", "string", "Diturunkan dari alamat"),
    ("alamat", "Alamat", "string", None),
    ("jumlah_kamar", "Jumlah Kamar", "number", None),
    ("latitude", "Latitude", "number", None),
    ("longitude", "Longitude", "number", None),
    ("edisi", "Edisi", "string", "Edisi MICHELIN Keys"),
    ("url_michelin", "Halaman MICHELIN Guide", "string", None),
    ("sumber_verifikasi", "Sumber Verifikasi", "string", "Pemberitaan siaran Kemenpar"),
    ("status_verifikasi", "Status Verifikasi", "string", None),
]


def build() -> dict:
    rows = []
    for i, (nama, key, lok, kab, prov, alamat, kamar, lat, lon, path) in enumerate(HOTELS, 1):
        rows.append({
            "no": i, "nama_hotel": nama, "jumlah_key": key, "kategori_key": LABEL[key],
            "lokasi_michelin": lok, "kab_kota": kab, "provinsi": prov, "alamat": alamat,
            "jumlah_kamar": kamar, "latitude": lat, "longitude": lon, "edisi": EDISI,
            "url_michelin": MG + path, "sumber_verifikasi": VERIF[key],
            "status_verifikasi": "terkonfirmasi",
        })
    counts = {k: sum(r["jumlah_key"] == k for r in rows) for k in (1, 2, 3)}
    # Pemeriksaan silang terhadap angka resmi edisi 2026.
    assert len(rows) == 47 and counts == {1: 33, 2: 11, 3: 3}, counts
    jkt = sum(r["provinsi"] == "DKI Jakarta" for r in rows)
    return {
        "slug": SLUG,
        "title": "Hotel MICHELIN Key Indonesia (2026)",
        "description": (
            f"{len(rows)} hotel dan resor di Indonesia peraih MICHELIN Key edisi {EDISI} "
            f"(terbit 18 September 2026): {counts[3]} hotel 3 Keys, {counts[2]} hotel 2 Keys, "
            f"{counts[1]} hotel 1 Key; {jkt} di antaranya di DKI Jakarta. "
            "Sumber: MICHELIN Guide, diverifikasi dengan sumber publik (siaran Kemenpar)."
        ),
        "columns": [{"key": k, "label": l, "type": t, "description": d} for k, l, t, d in COLUMNS],
        "rows": rows,
    }


def main() -> None:
    data = build()
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    for out in (Path("data/sekunder"), Path("platform-v2/data")):
        (out / f"{SLUG}.json").write_text(text, encoding="utf-8")
    print(f"{len(data['rows'])} baris → data/sekunder & platform-v2/data/{SLUG}.json")


if __name__ == "__main__":
    main()
