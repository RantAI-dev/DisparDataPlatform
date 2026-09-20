/**
 * Data sekunder — dataset pendataan Jakarta Atlas (GCI) yang melengkapi data
 * primer SDI. Atlas adalah app terpisah (jakarta-restaurant-data); di sini
 * cukup tautan. `rows` snapshot; fase lanjut ambil via API Atlas.
 */
export type SecondaryDataset = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  rows: number;
  href: string;
  /** true = tautan ke app Atlas eksternal; false = halaman detail internal /sdi. */
  external?: boolean;
};

export const ATLAS_BASE = "https://jakarta-restaurant-data.vercel.app";

export function secondaryDatasets(): SecondaryDataset[] {
  return [
    {
      id: "sec-wisman-negara",
      title: "Wisman DKI Jakarta per Negara (BPS dibersihkan)",
      description:
        "Kunjungan wisatawan mancanegara ke DKI Jakarta per negara asal, klasifikasi negara BPS distandarkan (mis. China≡Tiongkok, Filipina≡Philipina).",
      tags: ["wisman", "wisatawan", "mancanegara", "negara", "sekunder"],
      rows: 604,
      href: "/sdi/wisman-jakarta-per-negara",
      external: false,
    },
    {
      id: "sec-wisman-bulan",
      title: "Wisman DKI Jakarta per Bulan (total)",
      description:
        "Total kunjungan wisatawan mancanegara ke DKI Jakarta per bulan (agregasi seluruh negara asal).",
      tags: ["wisman", "wisatawan", "mancanegara", "bulanan", "sekunder"],
      rows: 28,
      href: "/sdi/wisman-jakarta-per-bulan",
      external: false,
    },
    {
      id: "sec-wisman-pintu",
      title: "Wisman per Pintu Masuk (dinormalisasi)",
      description:
        "Kunjungan wisman menurut pintu masuk dengan nama pintu distandarkan (mis. 'BANDAR UDARA SOEKARNO HATTA'≡'Soekarno-Hatta').",
      tags: ["wisman", "pintu-masuk", "sekunder"],
      rows: 480,
      href: "/sdi/wisman-jakarta-per-pintu-masuk",
      external: false,
    },
    {
      id: "sec-tripadvisor",
      title: "Restoran Jakarta TripAdvisor (Kuliner GCI)",
      description:
        "Restoran DKI Jakarta bersumber TripAdvisor untuk indikator kuliner GCI (kriteria Kearney: TripAdvisor & Michelin). Rating, ulasan, peringkat, koordinat, URL.",
      tags: ["kuliner", "restoran", "tripadvisor", "gci", "sekunder"],
      rows: 38,
      href: "/sdi/restoran-tripadvisor-jakarta",
      external: false,
    },
    {
      id: "sec-artis-chart",
      title: "Artis Top 10 Global Chart (Billboard & Spotify, 2021–2025)",
      description:
        "Tabel referensi artis Top 10 Global Chart (Billboard & Spotify Year-End) 2021–2025 untuk verifikasi kriteria Kearney pada indikator seni pertunjukan.",
      tags: ["seni-pertunjukan", "musik", "chart", "gci", "sekunder"],
      rows: 100,
      href: "/sdi/artis-top-global-chart",
      external: false,
    },
    {
      id: "sec-halal-restoran",
      title: "Restoran & Zona KHAS Tersertifikasi Halal Jakarta",
      description:
        "Restoran/rumah makan & sentra Zona KHAS di DKI Jakarta tersertifikasi halal (BPJPH/LPPOM MUI) — profil, titik koordinat, dan nomor sertifikat halal bila tersedia.",
      tags: ["halal", "restoran", "kuliner", "zona-khas", "ramah-muslim", "sekunder"],
      rows: 134,
      href: "/sdi/restoran-halal-jakarta",
      external: false,
    },
    {
      id: "sec-halal-hotel",
      title: "Hotel Ramah Muslim Jakarta",
      description:
        "Hotel syariah & ramah muslim DKI Jakarta (arah kiblat, musholla, tempat wudhu, restoran halal) — profil, koordinat, dan nomor sertifikat halal restoran bila tersedia.",
      tags: ["halal", "hotel", "ramah-muslim", "pariwisata", "sekunder"],
      rows: 49,
      href: "/sdi/hotel-ramah-muslim-jakarta",
      external: false,
    },
    {
      id: "sec-halal-inovasi",
      title: "Inovasi & Program Wisata Ramah Muslim Jakarta",
      description:
        "Inovasi, program unggulan, dan praktik baik pendukung wisatawan muslim — desa/kampung wisata ramah muslim, kampung halal, aplikasi digital, event/festival, branding, paket wisata.",
      tags: ["halal", "inovasi", "program", "ramah-muslim", "sekunder"],
      rows: 43,
      href: "/sdi/inovasi-wisata-ramah-muslim-jakarta",
      external: false,
    },
    {
      id: "sec-halal-mall",
      title: "Mall & Fasilitas Ramah Muslim Jakarta",
      description:
        "Mall/pusat perbelanjaan DKI Jakarta dengan fasilitas ramah muslim (musholla, tempat wudhu, restoran halal, toko produk halal) — profil, koordinat, dan foto fasilitas bila tersedia.",
      tags: ["halal", "mall", "fasilitas", "ramah-muslim", "sekunder"],
      rows: 43,
      href: "/sdi/mall-ramah-muslim-jakarta",
      external: false,
    },
    {
      id: "sec-halal-rph",
      title: "RPH Tersertifikasi Halal Jakarta",
      description:
        "Rumah Potong Hewan/Unggas (RPH/RPU) tersertifikasi halal di DKI Jakarta — profil, pengelola, koordinat, dan nomor sertifikat halal bila tersedia.",
      tags: ["halal", "rph", "ramah-muslim", "sekunder"],
      rows: 16,
      href: "/sdi/rph-halal-jakarta",
      external: false,
    },
    {
      id: "sec-halal-produk",
      title: "Produk Kreatif Makanan Tersertifikasi Halal Jakarta",
      description:
        "Produk kreatif makanan/UMKM kuliner asal DKI Jakarta yang tersertifikasi halal — profil, penyelenggara, dan nomor sertifikat halal bila tersedia.",
      tags: ["halal", "produk", "ekraf", "kuliner", "sekunder"],
      rows: 24,
      href: "/sdi/produk-kreatif-makanan-halal-jakarta",
      external: false,
    },
    {
      id: "sec-halal-bandara",
      title: "Bandara Ramah Muslim (melayani Jakarta)",
      description:
        "Bandara yang melayani DKI Jakarta beserta fasilitas ramah muslim (masjid/musholla, tempat wudhu, arah kiblat, restoran halal) dan penghargaan terkait.",
      tags: ["halal", "bandara", "ramah-muslim", "sekunder"],
      rows: 4,
      href: "/sdi/bandara-ramah-muslim-jakarta",
      external: false,
    },
    {
      id: "sec-halal-capaian",
      title: "Pengakuan & Capaian Pariwisata Ramah Muslim",
      description:
        "Pengakuan, penghargaan, dan capaian pengembangan pariwisata ramah muslim yang relevan dengan Jakarta/Indonesia (mis. Global Muslim Travel Index).",
      tags: ["halal", "pengakuan", "penghargaan", "ramah-muslim", "sekunder"],
      rows: 15,
      href: "/sdi/capaian-pariwisata-ramah-muslim",
      external: false,
    },
    {
      id: "sec-halal-warisan",
      title: "Warisan Islam & Wisata Budaya Muslim Jakarta",
      description:
        "Daya tarik wisata budaya muslim & warisan Islam unggulan di DKI Jakarta (masjid bersejarah, museum, kampung, situs — alam & buatan): profil, lokasi, dan nilai sejarah.",
      tags: ["halal", "warisan-islam", "wisata-budaya", "religi", "sekunder"],
      rows: 25,
      href: "/sdi/warisan-islam-wisata-budaya-muslim-jakarta",
      external: false,
    },
    {
      id: "sec-gmti-ibadah",
      title: "Masjid & Mushalla DKI Jakarta (SIMAS Kemenag)",
      description:
        "Seluruh masjid & mushalla DKI Jakarta yang terdaftar di SIMAS Kemenag RI, semua tipologi (Masjid Negara sampai Mushalla Pendidikan) — nama, nomor ID masjid, alamat, kota administrasi, dan kecamatan. Data registrasi Kemenag, bukan sensus lapangan.",
      tags: ["halal", "masjid", "mushalla", "ibadah", "simas", "gmti", "ramah-muslim", "sekunder"],
      rows: 8331,
      href: "/gmti",
      external: false,
    },
    {
      id: "sec-water-attractions",
      title: "Atraksi Wisata Air DKI Jakarta",
      description:
        "Inventaris 25 venue atraksi wisata air di DKI Jakarta: 23 venue dari silver.data_destinasi_pariwisata (filter regex nama) + 2 hasil Photon geocode untuk koordinat silver rusak. Kategori mengikuti standar resmi Kemenpar 'Aktivitas Wisata Air' (14 sub). Silver view memiliki bug lat/lon-tertukar untuk 19 baris — telah diperbaiki otomatis dan ditandai di field koordinat_sumber_silver_di_swap. Enrichment Nominatim menambah beberapa waterpark/marina water tambahan di luar SDI.",
      tags: ["atraksi-air", "water-attractions", "kemenpar", "pantai", "marina", "waterpark", "jakarta", "silver-sdi", "photon-geocode", "nominatim-osm", "sekunder"],
      rows: 25,
      href: "/sdi/water-attractions-jakarta",
      external: false,
    },
    {
      id: "sec-wellness-jakarta",
      title: "Venue Wellness DKI Jakarta (Nominatim + Google Places API New)",
      description:
        "Inventaris 84 venue wellness DKI Jakarta dari dua sumber: (1) Nominatim forward-search + filter kategori OSM untuk venue independen (47 baris mentah, 35 ditambahkan setelah dedup), (2) Google Places API (New) Text Search untuk hotel-spa kelas atas yang tidak terdaftar di OSM (49 baris; Essentials tier, gratis 10k/bulan). Field mask Essentials saja (formattedAddress, displayName, location, types) — tidak menyentuh tier Pro/Enterprise/Atmosphere. Dedup by nama ternormalisasi + jarak <500 m antar sumber. Distribusi kategori: 34 Spa & Pijat, 20 Hotel Spa Premium, 16 Fitness & Gym, 12 Klinik Kecantikan & Estetika, 1 Pengobatan Tradisional & Alternatif, 1 Kesehatan Mental & Nutrisi. Distribusi kota adm: 40 JakSel, 38 JakPus, 4 JakBar, 2 JakTim. Termasuk venue branded: The Spa at Four Seasons, Spa Treatments Mandarin Oriental, The Ritz-Carlton Spa, The St. Regis Spa, Kempinski The Spa, SPA by JW, Inaria Spa at InterContinental, Mulia Spa, Fairmont Spa, Heavenly Spa by Westin, Park Hyatt Spa, Sheraton Grand Spa, plus jaringan independen (Gold's Gym, Celebrity Fitness, Fitness First Platinum, Anytime Fitness, KX Pilates, Colour Yoga, Delta Spa, Rasa Spa, dll).",
      tags: ["wellness", "wellness-tourism", "spa", "hotel-spa", "fitness", "kecantikan", "klinik", "jakarta", "nominatim-osm", "google-places", "sekunder"],
      rows: 84,
      href: "/sdi/wellness-jakarta",
      external: false,
    },
    {
      id: "sec-usaha-wellness",
      title: "Usaha Penyedia dan Tempat Layanan Wellness Tourism DKI Jakarta",
      description:
        "Perluasan dataset wellness-jakarta (84 venue) dengan fokus 'usaha terdaftar': nama_dagang (brand), jenis_usaha (Rantai/Bermerek/Independen), asosiasi (inferensi berdasarkan kategori, bukan hasil lookup direktori resmi), dan status_usaha ('Perlu verifikasi NIB'). Distribusi jenis usaha: 6 Rantai/Franchise, 19 Hotel Spa Premium (bermerek), 59 Independen. Kolom asosiasi & status_usaha bersifat inferensi/placeholder — perlu verifikasi NIB manual sebelum dipakai sebagai data legalitas resmi.",
      tags: ["wellness", "wellness-tourism", "usaha", "nib", "legalitas", "jakarta", "sekunder"],
      rows: 84,
      href: "/sdi/usaha-wellness-jakarta",
      external: false,
    },
    {
      id: "sec-asosiasi-ekraf",
      title: "Asosiasi/Organisasi/Badan/EO Ekonomi Kreatif DKI Jakarta",
      description:
        "Inventaris asosiasi, organisasi, badan, dan EO (event organizer) yang berkaitan dengan ekonomi kreatif di DKI Jakarta. Sumber: (1) EKRAF Hub sebaran-pelaku-kreatif (filter province_id=31, work_status=Asosiasi) — otomatis, tanpa kontak; (2) kurasi manual dari situs resmi/Dispar DKI dengan verifikasi telepon/email publik. Distribusi kategori: 23 Asosiasi, 2 Badan, 6 EO, 3 Organisasi.",
      tags: ["ekraf", "asosiasi", "organisasi", "event-organizer", "jakarta", "ekraf-hub", "sekunder"],
      rows: 34,
      href: "/sdi/asosiasi-organisasi-badan-eo-ekraf-jakarta",
      external: false,
    },
    {
      id: "sec-asosiasi-pariwisata",
      title: "Asosiasi/Organisasi/Badan/EO Pariwisata DKI Jakarta",
      description:
        "Inventaris asosiasi, organisasi, badan, dan EO (event organizer) yang berkaitan dengan pariwisata di DKI Jakarta. Sumber: kurasi manual dari direktori Dispar DKI, situs resmi asosiasi, dan press release publik — Dispar DKI tidak menyediakan direktori publik terpusat untuk asosiasi wisata; baris yang kontaknya tidak tersedia publik ditandai '—'. Distribusi kategori: 11 Asosiasi, 4 Badan, 8 EO, 3 Organisasi.",
      tags: ["pariwisata", "asosiasi", "organisasi", "event-organizer", "jakarta", "sekunder"],
      rows: 26,
      href: "/sdi/asosiasi-organisasi-badan-eo-pariwisata-jakarta",
      external: false,
    },
    {
      id: "sec-desa-wisata",
      title: "Desa/Kampung Wisata DKI Jakarta (SDI + Perluasan)",
      description:
        "Inventaris desa/kampung wisata di DKI Jakarta dari Satu Data Jakarta (dataset data-desa-wisata, id 9984). DKI Jakarta tidak memiliki banyak 'desa' administratif — banyak entri berupa kampung wisata atau kelurahan wisata (mis. Kampung Bhinneka, Agro Edu Wisata Ragunan, Kampung Samtama). Distribusi kota: 7 Jakarta Pusat, 8 Jakarta Selatan, 8 Kepulauan Seribu, 6 Jakarta Barat, 14 Jakarta Timur, 5 Jakarta Utara. Distribusi tipe: 23 Kampung Wisata, 17 Destinasi Wisata, 8 Desa Wisata.",
      tags: ["desa-wisata", "kampung-wisata", "satu-data-jakarta", "jakarta", "sdi", "sekunder"],
      rows: 48,
      href: "/sdi/desa-wisata-jakarta",
      external: false,
    },
    {
      id: "sec-hotel-transit",
      title: "Hotel Transit DKI Jakarta (≤5 km dari simpul transport)",
      description:
        "Inventaris hotel dalam buffer 5 km dari 24 simpul transport utama DKI Jakarta (bandara, stasiun KAI, terminal bus, halte MRT/LRT). Basis: registry 120 hotel resmi Satu Data Jakarta. Koordinat via Nominatim forward-search; hotel yang tidak bisa di-geocode ditandai di cache.",
      tags: ["hotel", "transit", "transportasi", "satu-data-jakarta", "jakarta", "nominatim-osm", "sekunder"],
      rows: 43,
      href: "/sdi/hotel-transit-jakarta",
      external: false,
    },
    {
      id: "sec-event-visitor",
      title: "Jumlah Pengunjung Event Jakarta 2026",
      description:
        "Jumlah pengunjung event pariwisata & ekraf DKI Jakarta (Semester I 2026), diperkaya alamat, titik koordinat (lat/lon), dan sumber alamat via geocoding.",
      tags: ["event", "pengunjung", "pariwisata", "geocoded", "sekunder"],
      rows: 804,
      href: "/sdi/jumlah-pengunjung-event-2026",
      external: false,
    },
    {
      id: "sec-souvenir-ta",
      title: "Toko Suvenir Jakarta (TripAdvisor)",
      description:
        "Toko suvenir, oleh-oleh & kerajinan DKI Jakarta yang terdaftar di TripAdvisor (Gift & Specialty Shops, Antique Stores, Flea & Street Markets) — alamat, koordinat, rating, dan penandaan mana yang benar-benar toko suvenir. Mendukung indikator GPCI CI-SH (daya tarik belanja).",
      tags: ["suvenir", "oleh-oleh", "kerajinan", "belanja", "tripadvisor", "sekunder"],
      rows: 67,
      href: "/sdi/toko-suvenir-tripadvisor-2026",
      external: false,
    },
    {
      id: "sec-gci-resto",
      title: "Restoran & Kafe GCI Jakarta",
      description:
        "Pendataan seluruh restoran & kafe se-Jakarta (termasuk restoran hotel bintang 3–4) untuk Global City Index.",
      tags: ["gci", "restoran", "kuliner", "sekunder"],
      rows: 2577,
      href: `${ATLAS_BASE}/gci`,
    },
    {
      id: "sec-events",
      title: "Pertunjukan & Budaya GCI",
      description:
        "Pertunjukan musik internasional/nasional & acara budaya besar di Jakarta 2025–2026 (konser, festival, tari, teater, seni rupa, film) untuk Global City Index.",
      tags: ["gci", "event", "pertunjukan", "budaya", "sekunder"],
      rows: 308,
      href: `${ATLAS_BASE}/events`,
    },
    {
      id: "sec-resto-dir",
      title: "Direktori Restoran Kurasi",
      description:
        "Direktori restoran & kafe pilihan Jakarta dengan sumber sitasi publik yang terverifikasi.",
      tags: ["restoran", "kuliner", "direktori", "sekunder"],
      rows: 604,
      href: `${ATLAS_BASE}/restaurants`,
    },
    {
      id: "sec-golf",
      title: "Lapangan Golf Jakarta",
      description:
        "Pendataan lapangan & driving range golf di Jakarta dan sekitarnya.",
      tags: ["golf", "olahraga", "wisata", "sekunder"],
      rows: 14,
      href: `${ATLAS_BASE}/golf`,
    },
  ];
}