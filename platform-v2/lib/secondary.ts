/**
 * Data sekunder yang melengkapi data primer SDI. Daftar tematik mengikuti
 * pemilik halaman GCI/GPCI; seluruh entri tetap tersedia di Katalog Data.
 * `rows` adalah snapshot metadata, bukan hasil penghitungan per permintaan.
 */
import { DATA_SECTIONS } from "@/lib/data-sections";
import { SOUVENIR_SHOPS } from "@/lib/souvenir";
import { HOTEL_META } from "@/lib/hotel";

export type SecondaryDataset = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  rows: number;
  href: string;
  /** true = tautan eksternal; false = halaman dataset atau daftar tematik internal. */
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
      id: "sec-wisman-pintu-bulanan-bps",
      title: "Wisman per Pintu Masuk dan Bulan (BPS DKI Jakarta)",
      description:
        "Kunjungan wisman bulanan menurut pintu masuk DKI Jakarta (Soekarno-Hatta, Halim Perdana Kusuma, Tanjung Priok). Sumber: tabel statistik BPS Provinsi DKI Jakarta. Periode tersedia: 2024.",
      tags: ["wisman", "pintu-masuk", "bulanan", "bps", "sekunder"],
      rows: 36,
      href: "/sdi/wisman-per-pintu-masuk-bulanan-bps",
      external: false,
    },
    {
      id: "sec-wisnus-kota-tujuan",
      title: "Perjalanan Wisatawan Nusantara Menurut Kabupaten/Kota Tujuan (BPS DKI Jakarta)",
      description:
        "Jumlah perjalanan wisnus bulanan menurut kota/kabupaten TUJUAN di DKI Jakarta (mobile positioning data). Sumber: BPS Provinsi DKI Jakarta. Cakupan 2019–2025 lengkap dan Jan–Mei 2026. Tervalidasi terhadap rilis BPS TW II & TW IV 2025.",
      tags: ["wisnus", "nusantara", "kota-tujuan", "bps", "sekunder"],
      rows: 534,
      href: "/sdi/wisnus-perjalanan-per-kota-tujuan",
      external: false,
    },
    {
      id: "sec-tk-ekraf-provinsi",
      title: "Tenaga Kerja Ekonomi Kreatif Menurut Provinsi dan Jenis Kelamin (Satu Data Ekraf)",
      description:
        "Jumlah tenaga kerja ekonomi kreatif per provinsi 2020–2024 (Total, Laki-laki, Perempuan). Sumber: Satu Data Ekraf — Kemenekraf, olahan Sakernas BPS Agustus (satudata.ekraf.go.id dataset 8w13umewjrtrk1q & hxi9b9y1vq2rf2p). DKI Jakarta 2024: 1.257.285 orang.",
      tags: ["ekraf", "tenaga-kerja", "provinsi", "sakernas", "kemenekraf", "sekunder"],
      rows: 522,
      href: "/sdi/tenaga-kerja-ekraf-per-provinsi",
      external: false,
    },
    {
      id: "sec-tk-ekraf-subsektor",
      title: "Tenaga Kerja Ekonomi Kreatif Menurut Subsektor — Nasional (Satu Data Ekraf)",
      description:
        "Jumlah tenaga kerja ekonomi kreatif Indonesia per 16 subsektor 2020–2024; rincian subsektor per provinsi belum dipublikasikan. Sumber: Satu Data Ekraf — Kemenekraf, olahan Sakernas BPS (dataset 17o8miba9bfiyx1).",
      tags: ["ekraf", "tenaga-kerja", "subsektor", "nasional", "sakernas", "kemenekraf", "sekunder"],
      rows: 80,
      href: "/sdi/tenaga-kerja-ekraf-per-subsektor-nasional",
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
        "Inventaris 28 venue atraksi wisata air di DKI Jakarta (bersumber SDI, dilengkapi pemetaan koordinat dan OpenStreetMap). Kategori mengikuti standar Kemenpar 'Aktivitas Wisata Air'.",
      tags: ["atraksi-air", "water-attractions", "kemenpar", "pantai", "marina", "waterpark", "jakarta", "silver-sdi", "photon-geocode", "nominatim-osm", "sekunder"],
      rows: 28,
      href: "/sdi/water-attractions-jakarta",
      external: false,
    },
    {
      id: "sec-wellness-jakarta",
      title: "Venue Wellness DKI Jakarta",
      description:
        "Inventaris 84 venue wellness DKI Jakarta dari OpenStreetMap dan Google Places. Distribusi kategori: 34 Spa & Pijat, 20 Hotel Spa Premium, 16 Fitness & Gym, 12 Klinik Kecantikan & Estetika, 1 Pengobatan Tradisional & Alternatif, 1 Kesehatan Mental & Nutrisi. Distribusi kota adm: 40 JakSel, 38 JakPus, 4 JakBar, 2 JakTim.",
      tags: ["wellness", "wellness-tourism", "spa", "hotel-spa", "fitness", "kecantikan", "klinik", "jakarta", "nominatim-osm", "google-places", "sekunder"],
      rows: 84,
      href: "/sdi/wellness-jakarta",
      external: false,
    },
    {
      id: "sec-usaha-wellness",
      title: "Usaha Penyedia dan Tempat Layanan Wellness Tourism DKI Jakarta",
      description:
        "Perluasan dataset wellness-jakarta (84 venue) dengan fokus 'usaha terdaftar': nama_dagang (brand), jenis_usaha (Rantai/Bermerek/Independen), asosiasi, dan status_usaha. Distribusi jenis usaha: 6 Rantai/Franchise, 19 Hotel Spa Premium (bermerek), 59 Independen. Catatan: kolom asosiasi dan status usaha bersifat indikatif dan belum diverifikasi dengan data perizinan resmi (NIB).",
      tags: ["wellness", "wellness-tourism", "usaha", "nib", "legalitas", "jakarta", "sekunder"],
      rows: 84,
      href: "/sdi/usaha-wellness-jakarta",
      external: false,
    },
    {
      id: "sec-asosiasi-ekraf",
      title: "Asosiasi/Organisasi/Badan/EO Ekonomi Kreatif DKI Jakarta",
      description:
        "Inventaris asosiasi, organisasi, badan, dan EO (event organizer) yang berkaitan dengan ekonomi kreatif di DKI Jakarta. Sumber: EKRAF Hub dan situs resmi/Dispar DKI. Distribusi kategori: 23 Asosiasi, 2 Badan, 6 EO, 3 Organisasi.",
      tags: ["ekraf", "asosiasi", "organisasi", "event-organizer", "jakarta", "ekraf-hub", "sekunder"],
      rows: 34,
      href: "/sdi/asosiasi-organisasi-badan-eo-ekraf-jakarta",
      external: false,
    },
    {
      id: "sec-asosiasi-pariwisata",
      title: "Asosiasi/Organisasi/Badan/EO Pariwisata DKI Jakarta",
      description:
        "Inventaris asosiasi, organisasi, badan, dan EO (event organizer) yang berkaitan dengan pariwisata di DKI Jakarta. Sumber: direktori Dispar DKI, situs resmi asosiasi, dan press release publik; baris yang kontaknya tidak tersedia publik ditandai '—'. Distribusi kategori: 11 Asosiasi, 4 Badan, 8 EO, 3 Organisasi.",
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
        "Inventaris hotel dalam buffer 5 km dari 24 simpul transport utama DKI Jakarta (bandara, stasiun KAI, terminal bus, halte MRT/LRT). Basis: registry 120 hotel resmi Satu Data Jakarta. Koordinat diperoleh dari pencarian alamat; hotel yang alamatnya tidak dapat dipetakan tidak ditampilkan.",
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
      id: "sec-hotel-kamar",
      title: "Hotel & Jumlah Kamar DKI Jakarta (terkini)",
      description:
        "Data hotel DKI Jakarta dari tiga sumber — SDI hotel 2020, rekap usaha-kamar hotel 2023, dan riset web per hotel (2026); tiap baris mencantumkan jumlah kamar terkini beserta sumber & tahun angkanya, dan hotel yang tutup tetap dicatat dengan status operasionalnya.",
      tags: ["hotel", "kamar", "akomodasi", "gpci", "sekunder"],
      rows: 484,
      href: "/sdi/hotel-kamar-jakarta",
      external: false,
    },
    {
      id: "sec-gci-resto",
      title: "Restoran & Kafe GCI Jakarta",
      description:
        "Pendataan seluruh restoran & kafe se-Jakarta (termasuk restoran hotel bintang 3–4) untuk Global City Index.",
      tags: ["gci", "restoran", "kuliner", "sekunder"],
      rows: 2577,
      href: DATA_SECTIONS.gci.href,
      external: false,
    },
    {
      id: "sec-events",
      title: "Pertunjukan & Budaya GCI",
      description:
        "Pertunjukan musik internasional/nasional & acara budaya besar di Jakarta 2025–2026 (konser, festival, tari, teater, seni rupa, film) untuk Global City Index.",
      tags: ["gci", "event", "pertunjukan", "budaya", "sekunder"],
      rows: 308,
      href: DATA_SECTIONS.pertunjukan.href,
      external: false,
    },
    {
      id: "sec-resto-dir",
      title: "Direktori Restoran Kurasi",
      description:
        "Direktori restoran & kafe pilihan Jakarta dengan sumber sitasi publik yang terverifikasi.",
      tags: ["restoran", "kuliner", "direktori", "sekunder"],
      rows: 604,
      href: DATA_SECTIONS.restaurants.href,
      external: false,
    },
    {
      id: "sec-golf",
      title: "Lapangan Golf Jakarta",
      description:
        "Pendataan lapangan & driving range golf di Jakarta dan sekitarnya.",
      tags: ["golf", "olahraga", "wisata", "sekunder"],
      rows: 14,
      href: DATA_SECTIONS.golf.href,
      external: false,
    },
    {
      id: "sec-souvenir-atlas",
      title: "Toko Suvenir & Oleh-oleh Jakarta",
      description: "Daftar suvenir, oleh-oleh, dan kerajinan Jakarta dengan relevansi, koordinat, dan sumber.",
      tags: ["suvenir", "oleh-oleh", "gpci", "sekunder"],
      rows: SOUVENIR_SHOPS.length,
      href: DATA_SECTIONS.souvenir.href,
      external: false,
    },
    {
      id: "sec-hotel-statistik",
      title: "Hotel & Akomodasi — Statistik Resmi",
      description: "Pasokan kamar, tingkat penghunian, dan lama menginap dari data resmi Satu Data Jakarta / BPS.",
      tags: ["hotel", "akomodasi", "bps", "sekunder"],
      rows: HOTEL_META.totals.hotels,
      href: DATA_SECTIONS.hotel.href,
      external: false,
    },
  ];
}
