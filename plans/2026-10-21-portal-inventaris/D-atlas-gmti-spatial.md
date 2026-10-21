# D — Atlas / GMTI / Spatial / Hotel POC: inventarisasi untuk porting ke Nuxt 3 + Laravel 10

Sumber: `/home/uaa/Dinas-Pariwisata/platform-v2` @ HEAD `a0580ba`. Semua path di bawah relatif ke
`platform-v2/` kecuali disebut lain. Angka record dihitung **2026-10-21** dengan menjalankan modul TS
aslinya (tsx, read-only) dan menghitung berkas `data/statis/*.json`. Respons live diambil dari
`https://dispar.rantai.dev/api/spatial` dan `/api/hotels/scraped` (GET publik) di hari yang sama.
ClickHouse :18123 **tidak terjangkau dari mesin ini** → apa pun tentang Silver/Gold untuk tabel
`bronze_file.*` ditandai *belum terverifikasi*.

---

## 0. Temuan penting (baca dulu)

1. **`/atlas`, `/atlas/[section]`, `/atlas/[section]/map`, `/gmti/map` sekarang HANYA REDIRECT** (sejak commit
   `10af636`, 5 Okt 2026). Halaman beranda Atlas dengan kartu & angka tulisan tangan (dulu
   `app/atlas/page.tsx:55-103`) **sudah tidak ada**. Halaman yang benar-benar merender:
   | URL lama | Perilaku sekarang | File |
   |---|---|---|
   | `/atlas` | `redirect("/spatial")` | `app/atlas/page.tsx:3-5` |
   | `/atlas/[section]` | `notFound()` bila bukan key `DATA_SECTIONS`; selain itu `redirect(DATA_SECTIONS[section].href)` | `app/atlas/[section]/page.tsx:4-8` |
   | `/atlas/[section]/map` | hanya `restaurants`,`souvenir`,`golf` → `redirect("/spatial")`; lainnya 404 | `app/atlas/[section]/map/page.tsx:3-7` |
   | `/gmti/map` | `redirect("/spatial")` | `app/gmti/map/page.tsx:3-5` |
   | `/gmti` | render `GmtiView` (client-only, `ssr:false`) | `app/gmti/page.tsx:16-23` |
   | `/spatial` | render **`GmtiMapView`** (client-only) | `app/spatial/page.tsx:5-12` |
   | `/scraped-hotels` | render halaman client sendiri | `app/scraped-hotels/page.tsx` |
   Porting Nuxt: pertahankan redirect yang sama (301/302 di `routeRules` Nuxt atau middleware).
2. Section views sekarang dipasang di rute GCI/GPCI (bukan `/atlas/...`):
   `app/gci/pariwisata/restoran-gci/page.tsx` → `GciView`; `.../direktori-restoran/page.tsx` → **`Dashboard`**
   (bukan MapView); `.../pertunjukan-budaya/page.tsx` → `EventsView`; `app/gpci/lapangan-golf/page.tsx` → `GolfView`;
   `app/gpci/toko-suvenir/page.tsx` → `SouvenirView`; `app/gpci/hotel/page.tsx` → `HotelView`. Semua `dynamic(..., {ssr:false})`
   dengan loading `<p role="status">Memuat data…</p>`.
3. **Kode mati — jangan diport:** `components/MapView.tsx` (peta Direktori Restoran) dan `components/SouvenirMapView.tsx`
   (+ `components/atlas/CompassRose.tsx`, hanya dipakai keduanya) tidak di-import halaman mana pun. Peta per-section
   sudah digantikan `/spatial`.
4. **`/scraped-hotels` live kosong**: `GET /api/hotels/scraped` (2026-10-21) → `rows: []`, semua stats 0/null.
   Tabel `serving.mart_hotel_scraped_booking` tampaknya kosong sekarang (inventory `/api/spatial` juga
   `hotel-poc: 0`). Isi aslinya (72 baris, scrape 15 Sep 2026, satu `checkin` 2026-09-29, 34 `hotel_id`)
   tersimpan di `data/crawl/booking-hotel-2026-09-15.json` → `bronze_file.booking_hotel_2026_09_15`.
   Statistik route memakai `WHERE scraped_at > now() - INTERVAL 7 DAY` → selalu 0 untuk data lama walau baris ada.
5. **Bug yang tampak di produksi** (putuskan: tiru persis atau perbaiki — owner minta "mirip/persis"):
   - `GolfView.tsx:260` memanggil `t("home.vol2_kicker")` — key itu tidak ada (yang ada `home.vol2_kicker_short`),
     jadi layar menampilkan teks literal **`home.vol2_kicker`**. Saran: tampilkan `LAPANGAN GOLF`.
   - `Dashboard` (Direktori Restoran) memanggil `/api/refresh` (tombol "Verifikasi sumber", `Dashboard.tsx:234`) dan
     menautkan `/api/restaurants` (`Dashboard.tsx:458`) — **kedua route tidak ada di v2** (`app/api/` hanya
     `admin, ai, hotels, sdi, spatial`). Tombol verifikasi selalu berakhir "Tidak dapat menghubungi endpoint verifikasi."
   - `AtlasNav` tidak merender apa pun bila prop `view` kosong (`components/atlas/AtlasNav.tsx:22`). Akibatnya
     tombol bahasa ID/EN **tidak tampil** di GciView, EventsView, GolfView; SouvenirView (`view="list"` tanpa slot)
     juga null. Hanya **Dashboard** yang menampilkan toolbar (Verifikasi + ID/EN). Bahasa di Golf tetap terbaca
     dari `localStorage["dpj.lang"]` (`GolfView.tsx:101-106`).
   - `/api/spatial` tidak memfilter bbox DKI: titik dari Bali, Thailand, Tiongkok, Kopenhagen, Frankfurt ikut
     (dataset `jumlah-pengunjung-event-2026`, `michelin-keys-indonesia`). Dropdown wilayah di `/spatial` berisi
     30 nilai tak-ternormalisasi (mis. `Kota Adm. Jakarta Barat`, `Kota Administrasi Jakarta Barat`, `Jakarta Barat`,
     `Nusa Dua, Badung, Bali`).
   - Golf: `designer` hanya ada di 3/14 record; OSM id seperti `node/123456014` tampak placeholder (*belum terverifikasi*).
6. **Bahasa:** hanya komponen yang memakai `lib/i18n.ts` (Dashboard, GolfView; GciView/EventsView hanya untuk footer
   `footer.typeface`) punya EN. GmtiView, GmtiMapView, SouvenirView, HotelView, scraped-hotels = **satu bahasa,
   ditulis langsung** (scraped-hotels berbahasa **Inggris**). Default `id`, storage key `dpj.lang` (`lib/i18n.ts:9-10`).

---

## 1. Daftar section Atlas (`lib/data-sections.ts:2-10`)

`DATA_SECTIONS` hanya punya `title` (ID), `href`, `framework` — tidak ada judul EN, tidak ada hitungan.

| id | title (ID) | href (tujuan redirect) | fw | View | Sumber data (TS) | → Bronze (`bronze_file.*`, berkas `data/statis/`) | Record (UI) | Varian peta |
|---|---|---|---|---|---|---|---|---|
| `gci` | Restoran GCI | `/gci/pariwisata/restoran-gci` | GCI | `GciView` | `lib/gci.ts` + `gci-osm` + `gci-ratings` + `gci-addresses` + `gci-pricelevels` + `gci-hotel-restos` | `gci_venue_kurasi` (65), `gci_venue_osm` (2.573), `gci_venue_rating` (1.785, hanya `found=true`), `gci_venue_alamat` (2.573), `gci_venue_harga` (1.147), `gci_resto_hotel` (107) | **2.577** (65 kurasi + 2.512 OSM; 49 dibuang dedup) | `/atlas/gci/map` → 404; titik di `/spatial` kategori `gci` (2.512 berkoordinat) |
| `restaurants` | Direktori Restoran | `/gci/pariwisata/direktori-restoran` | GCI | `Dashboard` (bukan MapView) | `lib/restaurants.ts` + `lib/restaurants-osm.ts` | `restoran_kurasi` (181, sudah lewat filter DKI), `restoran_osm` (534, **mentah, sebelum dedup/filter**) | **604** (181 + 423) | `/atlas/restaurants/map` → `/spatial` (431 berkoordinat) |
| `pertunjukan` | Pertunjukan & Budaya | `/gci/pariwisata/pertunjukan-budaya` | GCI | `EventsView` | `lib/events.ts` | `event_pertunjukan` (308, urutan sudah kronologis) | **308** | tidak ada; `/spatial` kategori `budaya` memakai `seni_venue` (138), bukan events |
| `michelin` | Hotel MICHELIN Key | `/sdi/michelin-keys-indonesia` | GCI | halaman SDI (di luar cakupan dok ini) | Silver SDI | — | — | titik via `/api/spatial` (47) |
| `golf` | Lapangan Golf | `/gpci/lapangan-golf` | GPCI | `GolfView` (peta Leaflet terintegrasi) | `lib/golf.ts` | `golf` (14) | **14** (9 Course, 4 Driving Range, 1 Topgolf) | peta di halaman sendiri; `/atlas/golf/map` → `/spatial` |
| `souvenir` | Toko Suvenir | `/gpci/toko-suvenir` | GPCI | `SouvenirView` | `lib/souvenir.ts` | `souvenir` (67) | **67** (default tampil 35) | `/atlas/souvenir/map` → `/spatial` (61 berkoordinat) |
| `hotel` | Hotel & Akomodasi | `/gpci/hotel` | GPCI | `HotelView` | `lib/hotel.ts` | `hotel_registri` (120), `hotel_tpk` (145), `hotel_los` (310) | 120 hotel / 24.049 kamar | tidak |

GMTI (bukan key `DATA_SECTIONS`, rute sendiri `/gmti`): `lib/gmti-data.ts` (`GMTI_META`, `GMTI_AGG` 44,
`GMTI_TIPOLOGI` 11, `GMTI_PLACES` 1.105, `GMTI_CAPAIAN` 15) + `public/gmti-ibadah.json` (8.331) →
`bronze_file.gmti_tempat`, `gmti_kecamatan`, `gmti_tipologi`, `gmti_capaian`, `gmti_ibadah`. `GMTI_META` sendiri
**tidak diekspor** ke Bronze (lihat §5.3).
Spatial juga memakai `lib/pariwisata/seni-venues.json` → `bronze_file.seni_venue` (138, semua berkoordinat).

Pemetaan id berkas → tabel diverifikasi dari `lakehouse/sources.toml` (`[[sumber]] id/tabel`). Tanggal ambil:
restoran/gci/event/golf/souvenir/seni 2026-08-13; hotel 2026-09-09; gmti-* 2026-09-01 (ibadah 2026-08-31);
booking 2026-09-15. Bronze = semua kolom `String`; array (`highlights`, `sources`, `artists`, `events`) disimpan
sebagai **string JSON**; kolom opsional hanya ada di sebagian baris (mis. `phone` 88/534 di `restoran_osm`, 50/67 di
`souvenir`; `website` 56/534; `designer` 3/14; `priceNote` 2/181). Silver/Gold untuk tabel-tabel ini **belum ada di
repo** (`lakehouse/` hanya punya entri registri) — *belum terverifikasi* di ClickHouse.

Angka yang ditulis tangan & masih tampil (katalog/kerangka, bukan halaman Atlas): `lib/secondary.ts:401` `rows: 2577`
(GCI), `:411` `308` (events), `:421` `604` (direktori restoran), `:431` `14` (golf). Souvenir/hotel dihitung
(`:440`, `:449`). Di port: ambil dari endpoint (`meta.total`), jangan ditulis tangan.

---

## 2. Per halaman / section

Kelas CSS (`apple-*`, `atlas-*`, `frosted`, `pill-primary`, `utility-card`, `bg-parchment`, `text-ink-muted-48`…)
berasal dari tema global app (di luar cakupan dok ini) — porting harus membawa CSS tema yang sama agar tampilan identik.
Format angka: `toLocaleString("id-ID")` (8.331) kecuali disebut lain.

### 2.1 `/gmti` — `components/GmtiView.tsx`

Data: `GMTI_META/AGG/TIPOLOGI/PLACES/CAPAIAN` di-import (bundle); daftar ibadah 8.331 di-`fetch("/gmti-ibadah.json",
{cache:"force-cache"})` **hanya** saat tab `semua`/`ibadah` aktif (`:54`, `:177-211`). Tab default = `semua`, jadi praktis
selalu di-fetch.

Urutan atas-ke-bawah:
1. **Hero** (`:282-312`, center, `py-[80px] md:py-[120px]`):
   - eyebrow: `Data sekunder · Wisata ramah muslim (GMTI)`
   - h1: `Jakarta ramah muslim,` / baris 2 abu: `satu direktori terpadu.`
   - lead: `Data Pariwisata Ramah Muslim di Provinsi DKI Jakarta : Masjid & Musala, Kuliner Halal, Restoran Halal, Mall & Hotel dengan fasilitas ramah muslim, Rumah Pemotongan Hewan bersertifikasi Halal, Destinasi Sejarah Islam.`
   - baris penghargaan: `GMTI_CAPAIAN.find(c => /GMTI/i.test(c.nama))` → saat ini **"GMTI 2019 — Peringkat 1 … (Bersama Malaysia) — Mastercard & CrescentRating (Global Muslim Travel Index / GMTI)"** (record GMTI pertama dalam urutan array, bukan yang terbaru) (`:273-276`, `:297-302`).
   - tombol: `Lihat daftar` (`#directory`, pill-primary), `Buka Spatial` (`/spatial`, pill-secondary).
2. **Stat strip** (`:315-322`, parchment, 2×2 / 4 kolom): `4.041` Masjid terdaftar · `4.290` Mushalla terdaftar ·
   `335` Tempat ekosistem halal · `44` Kecamatan terliput (semua dari `GMTI_META`, `lib/gmti-data.ts:16-34`).
3. **Sebaran ringkas** (`:325-373`, 2 kolom):
   - kiri h2 `Kecamatan terpadat fasilitas ibadah`: 6 baris pertama `GMTI_AGG` (sudah urut desc `total`) — label
     kecamatan (w 150px), bar horizontal warna `#0f7b6c` lebar = total/total[0], angka kanan. Saat ini: Tanjung Priok 508,
     Cakung 451, Koja 417, … Tautan: `Lihat sebaran seluruh 44 kecamatan di Spatial ↗` → `/spatial`.
   - kanan h2 `Menurut tipologi`: grid 2 kolom 11 baris `tipologi … count` (Masjid Jami 3.712, Mushalla Perumahan 3.214,
     Mushalla di Tempat Publik 964, Masjid di Tempat Publik 282, Mushalla Pendidikan 76, Mushalla Perkantoran 36,
     Masjid Besar 25, Masjid Bersejarah 13, Masjid Agung 6, Masjid Raya 2, Masjid Negara 1).
4. **Toolbar sticky** (`:376-453`, `top-[56px]`):
   - baris 1: input cari placeholder `Cari nama, alamat, kecamatan, atau nomor sertifikat…` + chip jumlah hasil
     (`idNum(filtered.length)`), toggle `Kartu`/`Tabel`, `ExportButton` label `Unduh`.
   - baris 2: segmented tab `Semua | Ibadah | Makan & minum | Menginap | Destinasi & fasilitas | Program dan Event`
     (ganti tab mereset wilayah & jenis); select wilayah (`Semua wilayah` + `city` unik dari pool, urut `localeCompare("id")`);
     select jenis (`Semua jenis` + `kind` unik).
   - Cari: substring case-insensitive atas `name, kind, address, city, district, cert` (`:234-244`).
5. **Daftar** (`#directory`, `:456-542`):
   - bila tab ≠ semua: deskripsi pilar (`lib/gmti.ts:31-37`).
   - error: kotak `Gagal memuat daftar fasilitas ibadah (…). Muat ulang halaman untuk mencoba lagi.`
   - loading: `Memuat 8.331 fasilitas ibadah…`
   - kosong: `Tidak ada yang cocok` / `Coba longgarkan filter atau kosongkan kolom pencarian.`
   - **Kartu** (grid 1/2/3 kolom): kind (uppercase, warna primary) + badge pilar (warna pilar, bg alpha `1a`); nama;
     `district · city` atau `—`; alamat (clamp 2); note (clamp 3); `Sertifikat halal: <cert>`; bila tanpa koordinat:
     *`Titik peta belum diverifikasi — tidak ditampilkan di peta.`*; footer: tautan `Buka di Maps ↗` / `Cari di Maps ↗`
     (`gmtiMapsUrl`, `lib/gmti.ts:146-157`) + label dataset kanan.
   - **Tabel** (min-w 860): kolom `Nama` (link Maps) · `Jenis` · `Wilayah` (`district · city`) · `Pilar` (badge) · `Sumber`.
     Tanpa sorting kolom; urutan = urutan pool (`ibadah` dari JSON lalu `halal`).
   - Paginasi "muat lagi": `PAGE = 200` (`:47`); tombol `Tampilkan {min(200, sisa)} lagi · {shown}/{total}`; reset saat filter berubah.
6. **Sumber & batasan** (`:545-585`, parchment 2 kolom): `Sumber data` — `Fasilitas ibadah: SIMAS Kemenag RI — Sistem Informasi Masjid ↗ — seluruh tipologi masjid & mushalla Provinsi DKI Jakarta, snapshot 31 Agustus 2026. Ekosistem halal: dataset sekunder Dispar yang tayang di katalog /sdi.`; `Yang perlu diketahui` 3 butir:
   SIMAS = data registrasi…; `SIMAS tidak menyediakan koordinat. 770 titik diperoleh melalui pencarian alamat; 6.926 fasilitas lingkungan (Masjid Jami & Mushalla Perumahan) tidak dipetakan karena alamatnya kurang spesifik.`; pengelompokan pilar = penataan Dispar.

Ekspor (`:248-270`): nama berkas `jakarta-atlas-gmti-{tab}-{YYYY-MM-DD}`, sheet `GMTI`, baris = **semua hasil filter**
(bukan hanya yang tampil). Kolom: `No, Nama, Pilar, Jenis/Tipologi, Sumber Dataset, Alamat, Kota Administrasi, Kecamatan, Lintang, Bujur, No Sertifikat Halal, Catatan`.

Merge di JS: `halal = GMTI_PLACES.filter(pillar !== "ibadah")` (335) + ibadah dari JSON dipetakan ke `GmtiPlace`
`{id:"simas-"+id, pillar:"ibadah", kind:tipologi, dataset:"SIMAS Kemenag", city:kota, district:kecamatan, lat, lon}`
(`:184-197`). Pool `semua` = 8.331 + 335 = **8.666**. Pilar halal: makan 174, destinasi 69, menginap 49, program 43.

Konstanta pilar (`lib/gmti.ts:20-45`): label `Ibadah`, `Makan & minum`, `Menginap`, `Destinasi & fasilitas`,
`Program dan Event`; warna `#0f7b6c`, `#ed6b23`, `#7048b6`, `#1e6bb8`, `#c2185b`.

### 2.2 `/spatial` — `components/GmtiMapView.tsx` + `app/api/spatial/route.ts` + `lib/spatial.ts`

**Sumber titik** (gabungan di klien):
1. Statis `SPATIAL_POINTS` (`lib/spatial.ts:52-59`), difilter `hasSpatialCoordinates` (`:77-79`: finite, |lat|≤90,
   |lng|≤180, bukan 0,0): GCI 2.512, Direktori Restoran 431, Golf 14, Suvenir 61, Budaya (seni venue) 138, GMTI_PLACES
   (ibadah 770, makan 141, menginap 44, destinasi 66, program 40) → **4.217**.
   Field: `id` (`gci-…`,`restaurants-…`,`golf-…`,`souvenir-…`,`budaya-{i}`,`gmti-…`), `name`, `category`,
   `city=spatialCity(...)`, `address` (fallback `area`), `lat`,`lng`, `href` (= `DATA_SECTIONS.*.href`; GMTI → `r.href ?? "/gmti"`),
   `kind`,`cert` (GMTI saja).
2. `GET /api/spatial` (lakehouse) — live: **1.056 titik**, `complete:true`, `failed:[]`.
3. `GET /gmti-ibadah.json` → semua 8.331 baris dipetakan ke kategori `ibadah` (`:171-182`); yang tanpa koordinat
   dibuang dari pin tetapi **dihitung per kecamatan** untuk choropleth (`ibadahNoCoord`, geoKey kecamatan).
Dedup (`:141-149`): kunci `${category}|${name.toLowerCase().trim()}|${lat}|${lng}`; statis menang. Hasil simulasi hari ini:
448 titik lake & 770 ibadah dobel → **total 4.825 titik**: gci 2.512, restaurants 469, golf 14, souvenir 61, budaya 193,
ibadah 770, makan 141, menginap 44, destinasi 69, program 40, wisata 469, hotel 43.

**Penemuan titik di `/api/spatial`** (`route.ts:14-78`; `revalidate=300`, `maxDuration=120`):
1. `catalog()` (`lib/ch/store.ts:28-42`) = `SELECT slug,title,…,table_name FROM lake.\`bronze_meta.dataset_catalog\` UNION ALL … bronze_meta_sec.dataset_catalog`.
2. Sumber = setiap dataset katalog dengan `table_name` lolos regex `^[a-zA-Z_][a-zA-Z0-9_]*$` → `silver.<table_name>`,
   `href=/sdi/<slug>`; ditambah satu sumber tetap `serving.mart_hotel_scraped_booking` (`slug:"hotel-poc"`, `title:"Hotel POC"`, `href:"/scraped-hotels"`). Tabel dobel dilewati (`seenTables`).
3. Per tabel: `DESCRIBE TABLE db.\`tbl\`` → daftar nama kolom. Error kode 60 (tabel tak ada) dilewati diam-diam; error lain → `failed[]`.
4. Tebak kolom (cocok **persis**, huruf kecil, urutan prioritas, `route.ts:39-45`):
   - lat: `lat, latitude, lintang`
   - lng: `lon, lng, longitude, bujur, long`
   - nama: `nama, name, nama_usaha, nama_dagang, nama_tempat, nama_hotel, hotel_name, venue, nama_masjid`
   - kota: `kota, city, wilayah, kabupaten_kota, kota_administrasi`
   - alamat: `alamat, address, formatted_address`
   Tanpa lat **atau** lng → tabel dilewati (tidak masuk inventory).
5. SQL per halaman 2.000 baris (`PAGE`):
   ```sql
   SELECT DISTINCT name, city, address, lat, lng FROM (
     SELECT toString(`<nama>`) AS name, toString(`<kota>`) AS city, toString(`<alamat>`) AS address,
            toFloat64OrNull(toString(`<lat>`)) AS lat, toFloat64OrNull(toString(`<lng>`)) AS lng
     FROM <db>.`<tbl>`)
   WHERE isNotNull(lat) AND isNotNull(lng)
   ORDER BY lat, lng, name, city, address LIMIT {limit:UInt32} OFFSET {offset:UInt32}
   ```
   (kolom tak ditemukan → `''`).
6. Baris → `SpatialPoint{ id:"lake-<slug>-<offset+i>", name: name || title, category: spatialCategory(slug), city: spatialCity(city), address, lat, lng, href, source:title }`, disaring `hasSpatialCoordinates`.
7. **Kategori dari slug** (`lib/spatial.ts:61-75`, regex berurutan): `masjid|musala|mushalla|ibadah`→ibadah;
   `halal|muslim|islam` → (hotel|menginap→menginap; restoran|makan|kuliner|rph→makan; program|inovasi|event→program; selain itu destinasi);
   `hotel|akomodasi`→hotel; `budaya|seni|museum|pertunjukan`→budaya; `golf`; `suvenir|souvenir|oleh-oleh`→souvenir;
   `restoran|restaurant|kuliner`→restaurants; sisanya `wisata`.
8. `spatialCity` (`:41-49`): peta EN→ID (`central jakarta`→`Jakarta Pusat`, dst.), selain itu Title Case apa adanya.
9. Respons: `{ points: SpatialPoint[], inventory: {slug, coordinates}[], failed: string[], complete: boolean }`;
   gagal total → 503 `{points:[],inventory:[],failed:[],complete:false,error:"Sumber titik lakehouse belum dapat dimuat."}`.
   Inventory live (21 entri): kunjungan-obyek-wisata 28, destinasi-aksesibilitas 52, wellness-jakarta 84, bandara-ramah-muslim 4,
   desa-wisata 8, jumlah-pengunjung-event-2026 236, hotel-ramah-muslim 44, inovasi-ramah-muslim 40, mall-ramah-muslim 43,
   restoran-halal 127, rph-halal 14, hotel-transit 43, hutan-kota 0, michelin-keys 47, museum 55, restoran-tripadvisor 38,
   toko-suvenir-tripadvisor-2026 59, usaha-wellness 84, warisan-islam 22, water-attractions 28, hotel-poc 0.
   Ukuran: 382 KB mentah / 49 KB gzip. 324 dari 1.056 titik namanya = judul dataset (kolom nama tak ditemukan).

**Kategori peta** (`lib/spatial.ts:10-23`, urutan = urutan chip & legenda):
| key | label | warna |
|---|---|---|
| gci | Restoran GCI | `#ed6b23` |
| restaurants | Direktori Restoran | `#b45309` |
| golf | Lapangan Golf | `#15803d` |
| souvenir | Toko Suvenir | `#a16207` |
| budaya | Budaya | `#7c3aed` |
| hotel | Hotel | `#0369a1` |
| wisata | Destinasi lainnya | `#0891b2` |
| ibadah | Ibadah | `#0f7b6c` |
| makan | Makan & minum | `#ed6b23` |
| menginap | Menginap | `#7048b6` |
| destinasi | Destinasi & fasilitas | `#1e6bb8` |
| program | Program dan Event | `#c2185b` |
Tiap kategori punya ikon SVG inline (path di `lib/spatial.ts:11-22`) — salin apa adanya.

**UI** (`GmtiMapView.tsx:418-541`), `<main>` tinggi `calc(100dvh - 78px)` lalu disesuaikan ResizeObserver agar peta
mengisi sisa layar (`:193-213`); `<h1 class="sr-only">Spatial</h1>`:
1. `<details>` filter (tertutup default, frosted, max-h 45%): summary `Filter peta · {n} titik` (+ ` · Memuat marker…` selama render bertahap).
   Isi: toggle `Kepadatan kecamatan` (default ON); chip gabungan `Hotel` (toggle `hotel`+`menginap` sekaligus, warna `#0369a1`);
   chip gabungan `Ramah Muslim` (toggle 5 kategori muslim, warna `#0f7b6c`); lalu satu chip per kategori kecuali `hotel`
   (aktif = latar warna kategori, teks putih). Kanan: `{pins} / {points} titik`.
   Baris 2: input `Cari nama, alamat, atau wilayah…` (debounce 180 ms; substring atas `name address city`), select
   `Semua wilayah` + kota unik terurut, tombol `Reset filter` (semua kategori aktif, kota & cari kosong, choropleth ON, `setView([-6.2,106.82],11)`).
   Kosong: `Tidak ada titik yang sesuai filter. Gunakan Reset filter untuk menampilkan semua.`
2. Status: `Memuat seluruh sumber berkoordinat…`; error: gabungan pesan (`Sebagian dataset lakehouse gagal dimuat.` /
   `Titik lakehouse belum dapat dimuat.` / `Daftar fasilitas ibadah belum dapat dimuat.`) + ` Titik yang tersedia tetap ditampilkan.` + tombol `Coba lagi`.
3. Peta Leaflet: center `[-6.2, 106.82]`, zoom 11, scroll-zoom ON. Basemap `lib/basemap.ts`: Esri `Canvas/World_Light_Gray_Base`
   + `_Reference` (label, pane `shadowPane`), `maxNativeZoom 16`, `maxZoom 18`, atribusi `Peta © Esri — sumber: Esri, HERE, Garmin, © OpenStreetMap contributors`.
4. **Choropleth** dari `/geo/dki-jakarta.geojson` (42 fitur, `properties {name: kota, kecamatan}`; Kepulauan Seribu tidak ada):
   - Kepadatan = jumlah titik **kategori aktif** per kecamatan via point-in-polygon ray-casting (bbox cepat, lubang dikecualikan, `:55-83`)
     + ibadah tanpa koordinat lewat field kecamatan (`geoKey = lower, buang non a–z`). **Tidak** ikut filter kota/cari.
   - Ramp 6 warna `#e8f2f0 #c3ded9 #93c5bc #5aa79b #2d8b7c #0f7b6c`; ambang = kuantil `vals[floor((i+1)/6*(n-1))]` untuk i=0..4; tanpa data `#f1f3f5`; fillOpacity .72, garis putih 1.2.
   - Filter kota menyaring poligon `spatialCity(properties.name) === city`.
   - Popup poligon: kota (uppercase kecil hijau), nama kecamatan, `<b>{total} data</b>` + baris `Label: n` per kategori, atau `Tidak ada data untuk kecamatan ini`.
5. **Pin**: `leaflet.markercluster` (`chunkedLoading`, `maxClusterRadius 46`, `spiderfyOnMaxZoom`, `showCoverageOnHover:false`),
   ditambah batch 150/16 ms. Ikon: lingkaran 28 px warna kategori, border putih 2.5, ikon SVG 20 px. Bila ada cari/kota → `fitBounds` (padding 30, maxZoom 14).
   Popup (`:103-115`): label kategori (uppercase, warna) · **nama** · kind (opsional) · `address || city` · source (opsional) ·
   `Sertifikat: {cert}` (opsional) · `Lihat dataset →` (href) · `Buka di Maps ↗` (`https://www.google.com/maps/search/?api=1&query={lat},{lng}`).
6. Legenda `<details>` kiri bawah, summary `Legenda & sumber`: `KEPADATAN DATA PER KECAMATAN`, bar ramp, `sedikit … {max}`,
   daftar kategori aktif bertitik warna, catatan `Kepadatan = jumlah titik kategori aktif per kecamatan. Hanya koordinat valid yang dipetakan; fasilitas ibadah tanpa koordinat tetap dihitung lewat kecamatannya. Kepulauan Seribu Selatan & Kepulauan Seribu Utara belum punya poligon di peta dasar.`; error geo: `Lapis kepadatan gagal dimuat — pin tetap tampil.` + `Coba lagi`.
Tidak ada tombol ekspor di `/spatial`.

### 2.3 Restoran GCI — `components/GciView.tsx` (+ `lib/gci.ts`)

1. AtlasNav (tak tampil, lihat §0.5).
2. **Hero** (`:142-173`, bg paper): baris mono `GLOBAL CITY INDEX · DISPAREKRAF DKI` —garis— `SENIN · 22 JUNI 2026 · 16.00 WIB` (hard-coded deadline);
   h1 `Restoran ` + italic aksen `GCI`; lead `Inventarisasi seluruh restoran & cafe di Jakarta beserta keberagaman kuliner internasional — termasuk restoran hotel bintang 3 & 4 — untuk Global City Index.`
   Stat tiles (4, `gciStats()` `lib/gci.ts:395-404`): `TOTAL 2577` · `ADA RATING 1793` · `HOTEL 138` · `CAFE 712` (angka mentah, tanpa pemisah ribuan).
3. **Filter sticky** (`:176-251`): `FILTER ·`; segmented tier `Semua | Hotel ★4 | Hotel ★3 | Restoran | Cafe`; select kota
   (`Semua` + `CITY_ORDER` yang ada: Jakarta Pusat 643, Selatan 980, Utara 259, Barat 580, Timur 109, Kepulauan Seribu 6);
   select rating `Semua (rating) | Ada rating | Belum ada rating`; input `Cari nama / kuliner / area…` (atas `name cuisine area address hotel`);
   kanan `{filtered}/{2577} entri`; checkbox `hanya ber-rating` (default **ON**, title `Saat ekspor, hanya sertakan venue yang punya rating (tanpa sel kosong)`);
   `ExportButton` label `Ekspor Excel ({jumlah baris ekspor})`.
4. **Tabel** (`:256-345`) kolom: `No.` · `Nama` (link `gciMapsUrl`, sub-baris abu `hotel` bila ada) · `Jenis Cuisine` ·
   `Alamat` (`gciAddress` = address atau fallback area) · `Harga` (`$`–`$$$$` atau `—`, `*` aksen bila `priceSource==="editorial"`, title `Perkiraan editorial — Google tidak punya data harga untuk venue ini`) ·
   `Rating` (gaya `4,9`, `—`; `*` bila `needsVerify`) · `Jumlah Ulasan` (`id-ID`) · `Sumber` (`Google`/kosong) · `Tier` (badge warna, `:412-428`).
   Tanpa sorting interaktif; urutan tetap dari `dedupe()`. Kosong: `Tidak ada entri yang cocok dengan filter.`
   Paginasi: 200; `Muat {n} lagi` + `Tampilkan semua ({total})`; teks `Menampilkan {x} dari {y} entri terfilter. Ekspor selalu mengikutkan seluruh {y} entri hasil filter.`
5. Footer: `Sumber: Wanderlog, TripAdvisor, situs hotel resmi (data Google). GCI — Disparekraf DKI Jakarta.` + `Diset dengan SF Pro · Inter sebagai cadangan.`
Ekspor (`:103-133`): `data-restoran-GCI-{date}`, sheet `Restoran GCI`; kolom `No., Nama, Jenis Cuisine, Alamat, Rating (4,9), Jumlah Ulasan, Sumber Rating, Area, Tingkat Harga ("$$ (perkiraan)" bila editorial), Tier, Hotel, Catatan ("Angka belum diverifikasi" bila needsVerify), Google Maps`.

**Merge/dedup GCI di JS (harus pindah ke Data API)** — `lib/gci.ts`:
1. `CURATED` (`:226-242`) = 65 `SEED`; bila seed tanpa rating, ambil `GCI_RATINGS[id]` (found) untuk rating/reviewCount/placeId; `ratingSource="Google"` bila ada rating; `priceLevel/priceSource` dari `GCI_PRICELEVELS[id]`; `city = deriveCity(area)` (`:90-106`, kata kunci per wilayah, default Jakarta Pusat).
2. Alamat kurasi (`:269-288`): `GCI_ADDRESSES[id].address` → alamat OSM via placeId → via nama (terpanjang per `nameKey`) → via nama hotel induk (buang ` (★n)`).
3. `OSM` (`:291-323`): dari 2.573 `GCI_OSM`, buang yang `nameKey` sama dengan kurasi, dan baris tier `Hotel*` yang hotelnya sudah dikurasi; `name = GCI_HOTEL_RESTOS[id].name ?? osm.name`, `hotel = resto ? (osm.hotel ?? osm.name) : osm.hotel`; `address = GCI_ADDRESSES[id].address ?? osm.address`; rating/review/placeId dari ratings `found`; harga dari pricelevels.
4. `dedupe` (`:341-388`): urut kurasi dulu lalu nama terpanjang; placeId sama → buang; tanpa placeId → buang bila `nameKey` sama **dan** jarak ≤ 60 m (`metersBetween`, aproksimasi 111 km/°). Urutan akhir: tier (★4, ★3, Restoran, Cafe) → ber-rating dulu → reviewCount desc → nama.
   `nameKey = lower → NFKD → buang diakritik → buang non [a-z0-9]`. Hasil: 2.577 (49 dihapus); kurasi 65, OSM 2.512 (semua OSM berkoordinat).
   Hitungan: tier ★4 68, ★3 70, Restoran 1.727, Cafe 712; priceLevel `$` 58, `$$` 673, `$$$` 159, `$$$$` 21, kosong 1.666.
   Catatan: `bronze_file.gci_venue_kurasi` **sudah hasil langkah 1–2** (punya `city`, `address`, `placeId`, `source`), sedangkan `gci_venue_osm` mentah.

### 2.4 Direktori Restoran — `components/Dashboard.tsx` (+ `lib/restaurants.ts`)

Satu-satunya view dengan i18n penuh ID/EN (`lib/i18n.ts`; string di bawah = ID, EN di kurung).
1. **AtlasNav toolbar** (tampil, h 52 px, kanan): `VerifyControl` (`Verifikasi sumber` [Verify sources] → state `Memverifikasi sumber…` → `{reachable}/{total} sumber aktif · {n}m lalu` + tombol ulang; error `Tidak dapat menghubungi endpoint verifikasi.` + `Coba lagi ↗`) dan tombol bahasa `ID / EN`. Panel `VerifyDetails` (judul `Laporan ketersediaan sumber`). **Endpoint `/api/refresh` tidak ada di v2** → saran: hilangkan tombol atau buat endpoint di Laravel (cek HEAD tiap URL sumber).
2. **Hero** (center): eyebrow `JAKARTA · KULINER INTERNASIONAL`; h1 `Kuliner Internasional.` / `Pilihan kami untuk Anda.`; lead `Daftar dari **604 restoran dan bar** di Jakarta yang menyajikan makanan atau minuman internasional, dirangkum dari sumber publik. Setiap entri menyertakan tautan ke sumber aslinya — dan ke Google Maps.`; tombol `Telusuri direktori` (#directory), `Cara dibuat` (#sources).
3. **Stat strip**: `604` Tempat · `103` Jenis kuliner · `4.56`/5 Rata-rata rating (titik desimal, `toFixed(2)`) · `141` Sudah dinilai publik.
4. **Toolbar sticky**: cari `Cari restoran di Jakarta…` (atas name, cuisine, area, address, highlights, description) + chip `{filtered}/{604}`; toggle `Kartu`/`Daftar` (disimpan `localStorage["dpj.view"]`); `ExportButton` `Ekspor Excel`.
   Baris 2: select kota (`Seluruh kota` + urutan Central, South, North, West, East Jakarta, Kepulauan Seribu, lalu sisanya alfabet; label diterjemahkan `city.*` → `Jakarta Pusat`… `Jakarta (Lainnya)`); select kuliner (`Semua kuliner` + 103 nilai); segmented kategori `Semua | Makanan | Minuman | Keduanya`; segmented sort `Rating tertinggi` (default) `| Paling banyak diulas | A–Z`.
   Hitungan kota: South 239, Central 162, North 70, West 83, East 32, Kepulauan Seribu 8, Jakarta (Other) 10. Kategori: Food 491, Food & Beverage 108, Beverage 5.
5. **Direktori** — **tanpa paginasi** (604 kartu sekaligus, tiap kartu iframe Google Maps embed `loading=lazy`):
   - Kartu: iframe peta 16:9 (`mapsEmbedUrl`, `lib/restaurants.ts:417-425`) + chip `Buka ↗`; cuisine (uppercase) + badge `Kurasi`/`OSM`; nama; `area · {price} {Hemat|Kasual|Premium|Fine dining}`; ★ `4.5 · 1.5k ulasan · Google` (`formatReviews`: ≥10k `"12k"`, ≥1k `"1.5k"`); deskripsi clamp 3; OSM tanpa deskripsi → *`Data dari OpenStreetMap — beberapa detail (rating, ulasan, deskripsi) belum tersedia.`*; tautan `Buka di Maps ↗` + `Sumber ↗` (sources[0]).
   - Daftar: grid `# | Tempat | Rating | Kuliner | Harga | Aksi`, nomor `001`; aksi `Maps ↗`, `Sumber ↗`.
   - Kosong: `Tidak ada hasil.` / `Coba hapus filter, atau cari Senopati, Menteng, SCBD.`
6. **Footer** (#sources): `Tentang direktori ini` + teks `footer.about_body`; `Periksa`: `JSON mentah ↗` (`/api/restaurants`, **404 di v2**), `Ketersediaan sumber ↗` (`/api/refresh`, **404**); `Cakupan`: `604 tempat`, `103 jenis kuliner`, `141 dengan rating publik`; baris bawah `© {tahun} Jakarta Restaurant Data — proyek direktori publik.` · `Diset dengan SF Pro · Inter sebagai cadangan.`
Ekspor: `jakarta-atlas-restoran-{date}`, sheet `Restoran`, kolom `No, Nama, Kuliner, Kategori, Kota, Area, Alamat, Rating, Jumlah Ulasan, Sumber Rating, Tier Harga, Catatan Harga, Highlights (" · "), Deskripsi, Tipe Data, Lat, Lng, Telepon, Website, Google Maps, Sumber ("label <url> | …")`. Kosong → `alert("Tidak ada data untuk diekspor — coba longgarkan filter.")`.

**Merge di JS** (`lib/restaurants.ts:330-399`): kurasi → `city = deriveCityFromArea(area)` (`:56-80`, nilai EN `South Jakarta`… atau `Jakarta (Other)`/Bodetabek), `source:"curated"`; OSM dibuang bila `normName(name)|city.lower` sama dengan kurasi; OSM dipetakan ke `Restaurant` (`highlights:[]`, `sources:[{label:"OpenStreetMap — © OSM contributors", url:"https://www.openstreetmap.org/{osmId}"}]`); keduanya disaring ke `DKI_CITIES` (6 wilayah EN + `Jakarta (Other)`). 534 OSM → 423.

### 2.5 Pertunjukan & Budaya — `components/EventsView.tsx` (+ `lib/events.ts`)

1. Hero: mono `GLOBAL CITY INDEX · DISPAREKRAF DKI` — `TAHUN 2025–2026`; h1 `Pertunjukan & ` + italic `Budaya`; lead `Inventarisasi pertunjukan musik internasional & nasional serta acara budaya besar di Jakarta sepanjang 2025–2026 — konser, festival, seni tari, teater, orkestra, seni rupa, dan film — untuk Global City Index.`
   Stat (ikut filter tahun, `eventStats`): `TOTAL` · `KONSER` · `FESTIVAL` · `BUDAYA` (= selain Konser/Festival Musik). Nilai: semua 308/125/24/159; 2025 170/76/14/80; 2026 138/49/10/79.
2. Filter sticky: `FILTER ·`; segmented `Semua tahun | 2025 | 2026` (tahun = 4 digit `20xx` pertama di `date`); segmented kategori `Semua` + 12 (`Konser Musik, Festival Musik, Seni Tari, Teater / Musikal, Orkestra / Klasik, Seni Tradisional, Seni Rupa, Film, Budaya, Budaya Pop, Fashion, Fan Meeting`); cari `Cari nama / penyelenggara / tempat…` (atas name organizer venue type date note); `{n}/308 entri`; `Ekspor Excel ({n})`.
3. Tabel: `No.` · `Nama Pertunjukan` (link ke `source` bila ada) · `Penyelenggara` (`—`) · `Tanggal` (string apa adanya, mis. `2026-06-11 s/d 2026-07-12` / `Mei 2025`) · `Tempat` · `Jenis` · `Jumlah Pengunjung` (string; `*` aksen bila `eventNeedsVerify` = note cocok `/perkiraan|kapasitas|target|estimasi|terjual/i`) · `Keterangan`. Urutan kronologis `eventDateSort` (`lib/events.ts:426-434`). Paginasi 200 (hanya `Muat {n} lagi`). Catatan bawah: `Menampilkan {x} dari {y} entri terfilter. Angka bertanda * adalah kapasitas, perkiraan, atau target dan belum diverifikasi.`
4. Footer: `Sumber: berita, platform tiket, situs penyelenggara (link per baris). GCI — Disparekraf DKI Jakarta.`
Ekspor: `data-pertunjukan-GCI-jakarta-{2025-2026|tahun}-{date}`, sheet `Pertunjukan GCI {tag}`, kolom bilingual: `No., Nama Penyelenggara - Organizer, Nama Pertunjukan - Name of Performance, Tanggal Pertunjukan - Date of Performance, Tempat Pertunjukan - Place of Performance, Jenis Pertunjukan - Type of Performance, Jumlah Pengunjung - Number of Visitor, Keterangan - Notes, Sumber`.

### 2.6 Lapangan Golf — `components/GolfView.tsx` (+ `lib/golf.ts`)

1. Hero: mono kiri **`home.vol2_kicker`** (bug, §0.5) — `JAKARTA · 6 KOTA`; h1 `Lapangan Golf.` + italic `Jumlah dan lokasi.` (EN `Golf Courses.` / `Count and location.`); stat: `Total venue 14` · `Lapangan golf 9` · `Driving range 5` (semua non-Course, termasuk Topgolf) · `Total holes 171`.
2. Filter (tidak sticky, z-10): `FILTER ·`; select kota (`Seluruh kota` + kota yang ada: Central 1, South 6, North 3, East 4; label via `city.*`); segmented `Semua | Lapangan | Driving Range | Topgolf`; `{n}/14 · titik di peta`; `Ekspor Excel`.
3. Split `grid md:grid-cols-[1.5fr_1fr]`:
   - **Peta** (min-h 60vh): Leaflet `preferCanvas`, center `[-6.2, 106.85]` zoom 11, basemap Esri; **tanpa cluster** (14 pin). Pin `buildPinIcon` (`:49-88`): lingkaran 36 px warna akses (Public `#2E5D3C`, Semi-private `#C8A14B`, Members `#1A3A5A`, Resort `#8B5A2B`), label = jumlah hole / `TG` / `DR`; terpilih 54 px `#0A5E32` + halo. Klik pin → pilih + scroll kartu. Tidak ada popup terikat (`openPopup` no-op).
     Legenda kiri bawah: `LEGEND`, 3 baris (Public, Semi-private, Members), `Angka di pin = jumlah hole. DR = driving range. TG = Topgolf.`
   - **Rail daftar** (max-h `calc(100vh - 256px)`): header sticky aksen saat terpilih `TERPILIH` + nama + ✕ (`Hapus pilihan`). Baris: nomor `01`, `18 HOLES · PAR 71` / `DRIVING RANGE` / `TOPGOLF`, akses kanan; nama; area; `Desainer: … · Dibangun 1872` (hanya bila designer); `Buka di Maps →`, `Website ↗`. Klik baris → `flyTo` zoom 15.
4. Footer: `Lokasi: OpenStreetMap. Detail lapangan: Wanderlog, What's New Indonesia, GolfLux, Deemples Golf, Leading Courses.`
Ekspor: `jakarta-atlas-golf-{date}`, sheet `Golf`, kolom `No, Nama, Jenis, Jumlah Hole, Par, Desainer, Tahun Berdiri, Akses, Kota, Area, Alamat, Lat, Lng, Website, Google Maps, Deskripsi, Highlights, Sumber`.

### 2.7 Toko Suvenir — `components/SouvenirView.tsx` (+ `lib/souvenir.ts`)

1. Hero (center): eyebrow `Data sekunder · Daya tarik belanja (GPCI CI-SH)`; h1 `Toko suvenir Jakarta,` / `sudah disaring.`; lead `67 listing TripAdvisor kategori Shopping, ditandai satu per satu mana yang benar-benar toko suvenir — karena 30 di antaranya ternyata money changer, service HP, dan toko elektronik.`; tombol `Lihat daftar`.
2. Stat: `67` Listing terdata · `23` Toko suvenir murni · `4,19 /5` Rating rata-rata · `61` Titik berkoordinat.
3. Toolbar sticky: cari `Cari nama toko, produk, atau alamat…` + `{n}/67`; `Kartu`/`Tabel`; `Unduh`. Baris 2: select wilayah (`Semua wilayah` + 5 kota), select produk (`Semua produk` + 30 produk, buang `?`), segmented relevansi `Toko suvenir` (default = Ya+Sebagian, 35) `| Suvenir murni` (Ya 23) `| Sebagian` (12) `| Semua` (67); select sort `Ulasan terbanyak` (default) `| Rating tertinggi | Nama A–Z`.
4. Daftar tanpa paginasi. Kartu: iframe embed (`hl=id`) + `Buka peta`; produk (atau kategori bila `?`) + badge relevansi (`SUVENIR`/`SEBAGIAN`/`NON-SUVENIR`/`BELUM TERVERIFIKASI`); nama; `district · city`; ★ `4,2 · 64 ulasan · TripAdvisor` (≥1000 → `1.2k`); alamat; *`Koordinat telah dikoreksi.`* bila `coordSource==="Koreksi riset"`; `Buka di Maps ↗`, `Sumber ↗` (url TripAdvisor).
   Tabel: `Nama | Produk | Wilayah | Rating ("4,2 (64)") | Relevansi | (Maps ↗)`. Kosong: `Tidak ada toko yang cocok`.
5. Sumber: `Cara data ini dikumpulkan` / `Data berasal dari TripAdvisor (kategori Shopping, Jakarta) dan diverifikasi dengan sumber terbuka.`; `Yang perlu diperhatikan`: `· Pecahan 67 listing: 23 toko suvenir murni, 12 pasar/mal yang hanya sebagian menjual suvenir, 30 bukan toko suvenir sama sekali, dan 2 belum terverifikasi.` · `· Rating dan ulasan adalah angka TripAdvisor, bukan Google — sampelnya kecil untuk toko-toko baru.`
6. Footer mono: `SUMBER · TRIPADVISOR + VERIFIKASI SUMBER TERBUKA · DIPERBARUI 29 JULI 2026` (hard-coded).
Ekspor: `jakarta-atlas-suvenir-{date}`, sheet `Suvenir`, kolom `No, Nama, Kategori TripAdvisor, Relevan Suvenir, Produk Utama, Alamat, Kota Administrasi, Kecamatan, Lintang, Bujur, Sumber Koordinat, Telepon, Rating, Jumlah Ulasan, Status, Catatan, URL TripAdvisor`.

### 2.8 Hotel & Akomodasi — `components/HotelView.tsx` (+ `lib/hotel.ts`)

1. Hero: eyebrow `Data resmi · GPCI CI-HR / CI-LH (kamar hotel & hotel mewah)`; h1 `Hotel & ` + abu `Akomodasi`; lead `Pasokan kamar, okupansi (TPK), dan lama menginap hotel berbintang DKI Jakarta — seluruhnya dari **data resmi** Satu Data Jakarta / BPS, bukan scraping OTA.`
   KPI (4): `120` Hotel terdata (sub `Rekapitulasi usaha & kamar`) · `24.049` Total kamar · `53,5%` Okupansi rata-rata (terbaru) sub `Mei 2026` (rata-rata sederhana 5 kelas bintang di periode TPK terakhir) · `1,84` Lama menginap (malam) sub `Mei 2026` (rata-rata semua baris LoS periode terakhir). `hotels`/`rooms` dari `HOTEL_META.totals` (hard-coded di `lib/hotel.ts:29-34`, cocok dengan data).
2. Grafik (ECharts, tinggi 300, palet `#ed6b23 #f0a13a #c2410c #f4a672 #9a3412 #fb923c`, garis smooth tanpa simbol, `connectNulls`, label x `fmtPeriode` → `Jan 2024` (bulan `Jan Feb Mar Apr Mei Jun Jul Agu Sep Okt Nov Des`), rotasi 45° bila >14 periode):
   - `Tingkat Penghunian Kamar (TPK)` / `Okupansi bulanan per klasifikasi bintang · %` — 5 seri `Bintang 1..5`, 29 periode 202401–202605, sumbu `Okupansi %`, tooltip `53,5 %`.
   - `Rata-rata Lama Menginap` / `Malam per bulan · Wisman vs Wisnus (rata-rata lintas bintang)` — seri `Wisman`, `Wisnus` = rata-rata nilai per periode lintas bintang, 31 periode 202311–202605, sumbu `Malam`, tooltip 2 desimal + ` malam`. `<2 periode` → `Data tren belum cukup.`
3. Toolbar sticky: cari `Cari nama hotel, alamat…` (nama alamat wilayah golongan) + `{n}/120`; select `Semua wilayah` + 5 (UPPERCASE `JAKARTA BARAT`…); select `Semua golongan` + `BINTANG 1..5, NON BINTANG`; `Unduh`.
4. Tabel: caption `{n} hotel · {kamar} kamar (sesuai filter)`; header oranye `#ed6b23` putih uppercase: `Hotel | Golongan | Kamar | Wilayah | Alamat`; urut `kamar` desc; tanpa paginasi; kosong `Tidak ada hotel yang cocok dengan filter.`
5. Footer mono: `SUMBER · SATU DATA JAKARTA / BPS — REKAPITULASI USAHA & KAMAR HOTEL, TPK, RATA-RATA LAMA MENGINAP · DATA RESMI, TANPA SCRAPING OTA · DIBANGUN 2026-09-09`.
Ekspor: `jakarta-atlas-hotel-{date}`, sheet `Hotel`, kolom `No, Nama, Jenis Usaha, Golongan, Jumlah Kamar, Wilayah, Alamat`.

### 2.9 `/scraped-hotels` — `app/scraped-hotels/page.tsx` + `app/api/hotels/scraped/route.ts` (bahasa Inggris)

**API** (`force-dynamic`, `maxDuration 30`, `limit` query default 100, maks 500):
```sql
-- rows: snapshot terakhir per (checkin, hotel)
SELECT * FROM serving.mart_hotel_scraped_booking
WHERE (checkin, hotel_id, scraped_at) IN (
  SELECT checkin, hotel_id, max(scraped_at) FROM serving.mart_hotel_scraped_booking GROUP BY checkin, hotel_id)
ORDER BY review_score DESC NULLS LAST, price_idr ASC NULLS LAST
LIMIT {limit:UInt32};
-- stats (7 hari terakhir)
SELECT count() total, countIf(latitude IS NOT NULL AND longitude IS NOT NULL) with_coords,
       countIf(address != '') with_address, countIf(rooms_left IS NOT NULL) with_rooms_left,
       countIf(length(room_types_json) > 2) with_rooms, round(avg(price_idr)) avg_price,
       min(price_idr) min_price, max(price_idr) max_price, uniqExact(city) distinct_cities
FROM serving.mart_hotel_scraped_booking WHERE scraped_at > now() - INTERVAL 7 DAY;
-- roomStats
WITH per_hotel AS (SELECT hotel_id, anyLast(total_room_types) rooms_for_hotel
  FROM serving.mart_hotel_scraped_booking WHERE scraped_at > now() - INTERVAL 7 DAY
  GROUP BY hotel_id HAVING rooms_for_hotel IS NOT NULL)
SELECT sum(rooms_for_hotel) total_room_types, round(avg(rooms_for_hotel),1) avg_room_types_per_hotel FROM per_hotel;
```
Catatan: "last checkin" = `rows[0].checkin` (baris skor tertinggi, **bukan** max checkin); filter IN tidak membatasi ke checkin terbaru meski komentar mengklaim begitu.
Respons: `{ rows: [ ...semua kolom tabel, room_types: RoomType[] (parse room_types_json, gagal→[]) ], stats: {total, with_coords, with_address, with_rooms_left, with_rooms, avg_price, min_price, max_price, distinct_cities, total_room_types, avg_room_types_per_hotel}, last_checkin, source:"booking.com-poc", note:"Sandbox table from research-grade POC scraper. Exit-strategy → Booking Demand API." }`; error → 500 `{error}`.
Kolom tabel (dari ekspor): `address, adults, checkin, checkout, city, country, distance_km, hotel_id, hotel_name, hotel_url, is_available, latitude, longitude, price_currency, price_idr, price_raw, review_count, review_label, review_score, room_types_json, rooms_left, scraped_at, source, star_rating, total_room_types`.
`RoomType = {name, beds?, sleeps?, price_min_idr, price_max_idr, price_raw_min, price_raw_max, breakfast_included, cancellation?: "free_cancellation"|"non_refundable", rate_count}`.

**UI**:
1. Banner amber `#fff7ed`: ikon ⚠, `**POC research data** — scraped from Booking.com public search with strict safeguards (robots.txt, rate-limit, abort-on-block, Jakarta-only filter). Exit-strategy: Booking Demand API.` + tautan `Read README in scripts/scrapers/booking-jakarta/` (href salah: `https://github.com/anomalyco/opencode`).
2. Header: ikon Database oranye + h1 `Hotel Availability — Jakarta (POC)`; sub `Snapshot from Booking.com public search · check-in {last_checkin}` atau `—`; tombol `Refresh` (ikon berputar saat loading).
3. Error merah (teks error mentah).
4. Stat strip 6 kartu (2/3/6 kolom): `Hotels` (oranye) · `Room types` (sub `~{avg} per hotel`) · `With rooms left` `a/b` · `With address` `a/b` · `Avg price` `Rp 1.234.567` · `Price range` `Rp min – Rp max`.
5. Grafik (ECharts 240 px, warna `#ed6b23`):
   - `Price distribution` (`cheapest rate per hotel`): bar 5 bucket `<500K` [0,500k), `500K-1M`, `1M-2M`, `2M-5M`, `5M+`, dihitung dari `rows[].price_idr`; radius bar 4.
   - `Score vs price` (`bubble = hotel`): scatter x=`review_score` (min 5, max 10, `Review score`), y=`price_idr` (`Price (IDR)`, label `1.5M`/`500K`), size 12, opacity .75; tooltip `{hotel}<br/>Score: {s} · Rp …`.
6. Daftar `Hotels ({n})` · `SORTED BY REVIEW SCORE`: kartu per hotel, grid 12: nama (link Booking ↗) + `📍city · {distance_km} km from center · {n} room types · 🛏 {rooms_left} left`; bintang (ikon × star_rating atau `—`); `review_score · review_label` + `{n} reviews`; `Rp …` + `cheapest rate / night`; `available` (hijau) / `sold out` (merah). Klik → expand: alamat; tabel room types `Room type | Beds | Features (breakfast / free cancel / non-refundable) | Price / night (min – max) | Rates`, header `{n} room types` · `price = min/max across all rates found`; tanpa room → `No room detail captured (page may have been rate-limited).`
   Loading `Loading…`; kosong `No data yet. Run the scraper: cd scripts/scrapers/booking-jakarta && bun run start`.

---

## 3. Bentuk data & ukuran payload (untuk memilih pagination vs penuh)

| Dataset (grain UI) | Baris | Ukuran mentah / gzip | Saran |
|---|---|---|---|
| GMTI ibadah (`gmti-ibadah.json`) | 8.331 (770 berkoordinat) | 2,03 MB / 261 KB | Daftar `/gmti`: paginasi server (200/hal) + filter server. Peta: kirim hanya 770 titik + agregat kecamatan tanpa-koordinat. |
| GMTI tempat halal | 335 (+770 ibadah berkoordinat) | 432 KB / 66 KB (1.105 baris) | penuh |
| GCI venue (gabungan) | 2.577 | ~680 KB / ~98 KB | penuh (UI memfilter, ekspor butuh semua hasil filter) atau paginasi server + endpoint ekspor |
| Direktori restoran | 604 | ~270 KB | penuh |
| Events | 308 | 152 KB | penuh |
| Golf / Suvenir / Hotel registri | 14 / 67 / 120 | kecil | penuh |
| Hotel TPK / LoS | 145 / 310 | kecil | kirim siap-chart (seri), bukan baris |
| Spatial (semua titik) | 4.825 | ±1,7 MB JSON penuh (lake saja 382 KB / 49 KB) | satu GeoJSON/array ringkas (tanpa address di pin; popup detail lazy) atau per-kategori |
| GeoJSON kecamatan | 42 fitur | 46 KB / 11 KB | statis di Nuxt `public/` |

---

## 4. Usulan DATA CONTRACT (Data API → Laravel → Nuxt)

Prinsip: endpoint mengembalikan **grain UI**; Nuxt hanya memfilter/mengurutkan di klien bila dataset kecil (≤ ~3k) dan
TIDAK melakukan merge/dedup/agregasi. Semua angka hero/stat datang di `meta`/`stats`. Envelope umum:
```json
{ "data": [...], "meta": { "total": 0, "generated_at": "2026-10-21T02:00:00+07:00", "source": "...", "snapshot_date": "2026-08-13" } }
```
Error: `{ "error": { "code": "not_found|upstream", "message": "..." } }` dengan HTTP 404/503.
Laravel cukup proxy + cache (TTL saran 300 s seperti `revalidate` sekarang). Base `/v1`.

### 4.1 `GET /v1/atlas/sections`
Pengganti `DATA_SECTIONS` + angka tulisan tangan `lib/secondary.ts`.
```json
{ "data": [
  { "id": "gci", "title": "Restoran GCI", "title_en": null, "href": "/gci/pariwisata/restoran-gci", "framework": "GCI", "total": 2577, "has_map": false, "spatial_category": "gci" },
  { "id": "restaurants", "title": "Direktori Restoran", "href": "/gci/pariwisata/direktori-restoran", "framework": "GCI", "total": 604, "has_map": false, "spatial_category": "restaurants" },
  { "id": "pertunjukan", "title": "Pertunjukan & Budaya", "href": "/gci/pariwisata/pertunjukan-budaya", "framework": "GCI", "total": 308 },
  { "id": "michelin", "title": "Hotel MICHELIN Key", "href": "/sdi/michelin-keys-indonesia", "framework": "GCI", "total": null },
  { "id": "golf", "title": "Lapangan Golf", "href": "/gpci/lapangan-golf", "framework": "GPCI", "total": 14, "has_map": true },
  { "id": "souvenir", "title": "Toko Suvenir", "href": "/gpci/toko-suvenir", "framework": "GPCI", "total": 67 },
  { "id": "hotel", "title": "Hotel & Akomodasi", "href": "/gpci/hotel", "framework": "GPCI", "total": 120 }
]}
```
Redirect `/atlas/:section` di Nuxt boleh memakai daftar statis yang sama (tidak perlu memanggil API).

### 4.2 `GET /v1/atlas/gci`
Hasil `GCI_RESTAURANTS` final (merge + dedup + urutan §2.3). Default kirim semua (2.577); dukung `?tier=&city=&rated=yes|no&q=&page=&per_page=` opsional.
```json
{ "data": [
  { "id": "osm-w-370539428", "name": "Canary Coffee Shop", "cuisine": "Restoran Hotel", "area": "Kebagusan, South Jakarta",
    "address": "Jl. TB Simatupang No.Kav. 9, RT.2/RW.2, Kebagusan, Ps. Minggu, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12520, Indonesia",
    "address_display": "Jl. TB Simatupang No.Kav. 9, …", "city": "Jakarta Selatan", "hotel": "Aston Priority Simatupang (★4)",
    "tier": "Hotel ★4", "source": "osm", "lat": -6.30135, "lng": 106.834854, "rating": 4.8, "review_count": 33827,
    "rating_source": "Google", "place_id": "ChIJ_fZWgR9E0i0RO4aL1fA8dyQ", "price_level": "$$$", "price_source": "editorial",
    "needs_verify": false, "maps_url": "https://www.google.com/maps/search/?api=1&query=Canary%20Coffee%20Shop%20Kebagusan%2C%20South%20Jakarta&query_place_id=ChIJ_fZWgR9E0i0RO4aL1fA8dyQ" }
 ],
 "meta": { "total": 2577, "dedupe_removed": 49, "curated": 65,
   "stats": { "total": 2577, "rated": 1793, "hotel": 138, "cafe": 712, "restoran": 1727 },
   "tiers": ["Hotel ★4","Hotel ★3","Restoran","Cafe"],
   "cities": ["Jakarta Pusat","Jakarta Selatan","Jakarta Utara","Jakarta Barat","Jakarta Timur","Kepulauan Seribu"],
   "deadline_label": "SENIN · 22 JUNI 2026 · 16.00 WIB" } }
```
`address_display` = `gciAddress` (address atau area); `maps_url` = `gciMapsUrl` (`lib/gci.ts:110-120`). Sumber: 6 tabel `bronze_file.gci_*` → Silver typed → Gold `mart_atlas_gci_venue` (nama usulan).

### 4.3 `GET /v1/atlas/restaurants`
```json
{ "data": [
  { "id": "toscana", "name": "Toscana", "cuisine": "Italian", "category": "Food & Beverage", "area": "Kemang, South Jakarta",
    "city": "South Jakarta", "address": "Jl. Kemang Raya No.120, Mampang Prapatan", "price_range": "$$$", "price_note": null,
    "rating": 4.5, "review_count": 1476, "rating_source": "Google",
    "highlights": ["22-year Kemang pioneer","Brick-walled trattoria","Pasta & grilled meats"],
    "description": "Elegant Kemang trattoria, …", "sources": [{"label":"Wanderlog — Italian Jakarta","url":"https://wanderlog.com/list/geoCategory/52581/best-italian-restaurants-in-jakarta"}],
    "source": "curated", "lat": null, "lng": null, "osm_id": null, "phone": null, "website": null,
    "maps_url": "https://www.google.com/maps/search/?api=1&query=Toscana%2C%20Jl.%20Kemang%20Raya%20…%2C%20Jakarta",
    "embed_url": "https://www.google.com/maps?q=Toscana%2C%20…&hl=en&z=16&output=embed" } ],
  "meta": { "total": 604, "stats": { "cuisines": 103, "rated": 141, "avg_rating": 4.56 },
    "cities": ["Central Jakarta","South Jakarta","North Jakarta","West Jakarta","East Jakarta","Kepulauan Seribu","Jakarta (Other)"],
    "cuisines": ["…103 nilai terurut…"] } }
```
`city` tetap nilai EN (label ID diterjemahkan di Nuxt via i18n `city.*`), urutan data = kurasi lalu OSM (UI default sort rating). Sumber: `bronze_file.restoran_kurasi` + `restoran_osm` (dedup `normName|city`, filter DKI, di Data API).

### 4.4 `GET /v1/atlas/events?year=2025|2026`
```json
{ "data": [ { "id": "n02", "organizer": "Expoindo", "name": "Pasar Malam Empat Satoe Slank (HUT ke-41)", "date": "2025-01-04",
  "date_sort": 20250104, "year": "2025", "venue": "JIExpo Kemayoran, Jakarta", "type": "Konser Musik Nasional (Rock/Pop)",
  "visitors": "", "visitors_needs_verify": false, "note": "Konser tunggal HUT ke-41 Slank", "category": "Konser Musik",
  "source": "https://exhibition.jiexpo.com/slank-siap-rayakan-konser-empat-satoe-bersama-slankers/" } ],
  "meta": { "total": 308, "categories": ["Konser Musik","Festival Musik","Seni Tari","Teater / Musikal","Orkestra / Klasik","Seni Tradisional","Seni Rupa","Film","Budaya","Budaya Pop","Fashion","Fan Meeting"],
    "stats": { "all": {"total":308,"konser":125,"festival":24,"budaya":159},
               "2025": {"total":170,"konser":76,"festival":14,"budaya":80},
               "2026": {"total":138,"konser":49,"festival":10,"budaya":79} } } }
```
`visitors` tetap string (sumber menyimpan teks); `year`/`date_sort`/`visitors_needs_verify` dihitung di API. Sumber: `bronze_file.event_pertunjukan`.

### 4.5 `GET /v1/atlas/golf`
```json
{ "data": [ { "id": "jakarta-golf-club", "name": "Jakarta Golf Club", "kind": "Course", "holes": 18, "par": 71, "designer": null,
  "established": 1872, "membership": "Members", "city": "East Jakarta", "area": "Rawamangun, East Jakarta",
  "address": "Jl. Rawamangun Muka Raya, Rawamangun", "lat": -6.2001515, "lng": 106.877294, "website": null,
  "description": "The oldest golf course in Indonesia, established 1872. …",
  "highlights": ["Indonesia's oldest course (1872)","Walking course","Par 71, 18 holes"],
  "sources": [{"label":"OpenStreetMap — © OSM contributors","url":"https://www.openstreetmap.org/way/123456001"}],
  "maps_url": "https://www.google.com/maps/search/?api=1&query=-6.2001515,106.877294" } ],
  "meta": { "total": 14, "stats": { "courses": 9, "ranges": 5, "total_holes": 171 } } }
```
Sumber: `bronze_file.golf` (parse `highlights`/`sources` dari string JSON di Silver).

### 4.6 `GET /v1/atlas/souvenir`
```json
{ "data": [ { "id": "batik-keris", "name": "Batik Keris", "category": "Toko Suvenir & Spesialisasi", "relevance": "Ya",
  "product": "Batik", "product_label": "Batik", "address": "Jakarta", "city": "Jakarta Pusat", "district": "Menteng",
  "lat": -6.1931, "lng": 106.8217, "coord_source": "Koreksi riset", "phone": null, "rating": 4.2, "reviews": 64,
  "status": "Aktif", "note": "Berlokasi di Plaza Indonesia …", "url": "https://www.tripadvisor.com/Attraction_Review-g294229-d379331",
  "maps_url": "https://www.google.com/maps/search/?api=1&query=-6.1931,106.8217",
  "embed_url": "https://www.google.com/maps?q=-6.1931,106.8217&hl=id&z=17&output=embed" } ],
  "meta": { "total": 67, "stats": { "ya": 23, "sebagian": 12, "tidak": 30, "belum_pasti": 2, "avg_rating": 4.19, "geo": 61 },
    "products": ["…30 nilai, tanpa '?'…"], "cities": ["Jakarta Barat","Jakarta Pusat","Jakarta Selatan","Jakarta Timur","Jakarta Utara"],
    "updated_label": "29 JULI 2026" } }
```
Sumber: `bronze_file.souvenir`.

### 4.7 `GET /v1/atlas/hotel`
```json
{ "meta": { "built": "2026-09-09", "registry_period": "202301–202311", "sources": ["Satu Data Jakarta — Rekapitulasi Usaha & Kamar Hotel", "…"] },
  "kpi": { "hotels": 120, "rooms": 24049, "occupancy_latest": 53.5, "occupancy_period": "202605", "los_latest": 1.84, "los_period": "202605" },
  "tpk_chart": { "periods": ["202401", "…", "202605"], "series": [ {"name":"Bintang 1","data":[34.33, 31.77, 32.17, …]}, … ] },
  "los_chart": { "periods": ["202311", "…", "202605"], "series": [ {"name":"Wisman","data":[2.52, …]}, {"name":"Wisnus","data":[1.57, …]} ] },
  "registry": [ { "nama": "ACCOR/ FAIRMONT JAKARTA", "jenis_usaha": "HOTEL", "golongan": "BINTANG 5", "kamar": 488,
    "alamat": "JL ASIA AFRIKA NO. 8, …", "wilayah": "JAKARTA PUSAT", "periode": "202311" } ],
  "filters": { "wilayah": ["JAKARTA BARAT","JAKARTA PUSAT","JAKARTA SELATAN","JAKARTA TIMUR","JAKARTA UTARA"],
               "golongan": ["BINTANG 1","BINTANG 2","BINTANG 3","BINTANG 4","BINTANG 5","NON BINTANG"] } }
```
Nilai awal seri di contoh dihitung dari `lib/hotel.ts` (202401 Bintang 1 = 34,33; LoS 202311 Wisman 2,52 / Wisnus 1,57). LoS per periode = rata-rata baris tamu itu lintas bintang (2 desimal); KPI rata-rata sederhana (§2.8). `registry` urut `kamar` desc. Sumber: `bronze_file.hotel_registri/_tpk/_los`.

### 4.8 `GET /v1/gmti/summary`
```json
{ "meta": { "source": "SIMAS Kemenag RI — Sistem Informasi Masjid", "source_url": "https://simas.kemenag.go.id/page/profilmasjid",
    "fetched_at": "2026-08-31T13:42:12.938Z", "ibadah_total": 8331, "masjid": 4041, "mushalla": 4290, "ibadah_non_signature": 6926,
    "ibadah_signature": 1405, "ibadah_berkoordinat": 770, "halal_total": 335, "halal_berkoordinat": 291, "kecamatan": 44,
    "kecamatan_tanpa_poligon": ["Kepulauan Seribu Selatan","Kepulauan Seribu Utara"], "tanpa_kecamatan": 0 },
  "pillars": [ {"id":"ibadah","label":"Ibadah","desc":"Masjid & mushalla terdaftar SIMAS Kemenag se-DKI Jakarta.","color":"#0f7b6c","count":8331}, … ],
  "kecamatan": [ {"kecamatan":"Tanjung Priok","kota":"Kota Administrasi Jakarta Utara","geo_key":"tanjungpriok","masjid":177,"mushalla":331,"total":508}, … 44 ],
  "tipologi": [ {"tipologi":"Masjid Jami","jenis":"masjid","count":3712}, … 11 ],
  "capaian": [ {"nama":"GMTI 2019 — Peringkat 1 …","pemberi":"Mastercard & CrescentRating (…)","tahun":"2019","tingkat":"internasional","deskripsi":"…"}, … 15 ],
  "hero_award_index": 0 }
```
**`GMTI_META` tidak ada di Bronze** — Data API harus menghitungnya dari `gmti_ibadah` + `gmti_tempat` (masjid/mushalla dari `jenis`; non-signature = tipologi ∈ {Masjid Jami, Mushalla Perumahan}; berkoordinat = lat & lon terisi; halal = `pillar != ibadah`; `fetched_at` & `source` dari metadata registri) atau tabel referensi kecil baru. `halal_berkoordinat=291` versi konstanta vs hitung ulang dari `gmti_tempat` *belum terverifikasi* sama.

### 4.9 `GET /v1/gmti/places`
Gabungan ibadah (8.331) + halal (335) pada grain kartu `/gmti`. **Wajib paginasi server** (tab `semua` = 8.666 baris, 2 MB).
Query: `pillar=semua|ibadah|makan|menginap|destinasi|program`, `city=`, `kind=`, `q=` (name/kind/address/city/district/cert), `page=1`, `per_page=200`, `format=json|csv|xlsx` (ekspor semua hasil filter — atau Nuxt meminta `per_page=all` saat ekspor).
```json
{ "data": [
  { "id": "simas-19", "name": "ISTIQLAL", "pillar": "ibadah", "kind": "Masjid Negara", "dataset": "SIMAS Kemenag",
    "href": null, "address": "Jl. Taman Wijaya Kusuma Rt.08/02, Kel. Pasar Baru", "city": "Kota Administrasi Jakarta Pusat",
    "district": "Sawah Besar", "lat": -6.170166, "lon": 106.831375, "cert": null, "note": null,
    "maps_url": "https://www.google.com/maps/search/?api=1&query=-6.170166,106.831375", "has_coords": true },
  { "id": "restoran-hal-ichiban-sushi-0", "name": "Ichiban Sushi", "pillar": "makan", "kind": "Restoran Sushi Jepang",
    "dataset": "Restoran halal", "href": "/sdi/restoran-halal-jakarta", "address": "Kuningan City Mall, Jl. Prof. DR. Satrio, …",
    "city": "Jakarta Selatan", "district": null, "lat": -6.2249, "lon": 106.8277, "cert": "ID00410001350280223",
    "note": "Restoran sushi Jepang dengan 100+ gerai …", "maps_url": "…", "has_coords": true } ],
  "meta": { "total": 8666, "page": 1, "per_page": 200,
    "facets": { "city": ["…"], "kind": ["…"] } } }
```
Urutan = ibadah (urutan berkas) lalu halal (urutan `GMTI_PLACES`) — sama dengan app. `facets` dihitung dari pool tab (sebelum filter city/kind), diurut `localeCompare("id")`. Sumber: `bronze_file.gmti_ibadah` + `gmti_tempat` (pillar ≠ ibadah; jangan pakai 770 ibadah di `gmti_tempat` agar tidak dobel).

### 4.10 `GET /v1/spatial`
Satu endpoint menggantikan `SPATIAL_POINTS` statis + `/api/spatial` + `/gmti-ibadah.json` (dedup dilakukan server dengan kunci yang sama, §2.2).
```json
{ "categories": [ {"id":"gci","label":"Restoran GCI","color":"#ed6b23","icon_svg":"<path d=\"M4 3v6m3-6v6…\"/>","group":null}, …,
                  {"id":"ibadah","label":"Ibadah","color":"#0f7b6c","icon_svg":"…","group":"muslim"} ],
  "points": [
    { "id": "gci-osm-w-370539428", "name": "Canary Coffee Shop", "category": "gci", "city": "Jakarta Selatan",
      "address": "Jl. TB Simatupang …", "lat": -6.30135, "lng": 106.834854, "href": "/gci/pariwisata/restoran-gci",
      "kind": null, "cert": null, "source": null },
    { "id": "lake-museum-jakarta-0", "name": "MUSEUM BETAWI", "category": "budaya", "city": "Kota Adm. Jakarta Selatan",
      "address": "…", "lat": -6.34, "lng": 106.82, "href": "/sdi/museum-jakarta", "source": "Museum DKI Jakarta" } ],
  "density_extra": [ { "geo_key": "tanjungpriok", "category": "ibadah", "count": 507 } ],
  "inventory": [ { "slug": "museum-jakarta", "coordinates": 55 } ],
  "failed": [], "complete": true,
  "meta": { "total": 4825, "generated_at": "…" } }
```
- `density_extra` = ibadah tanpa koordinat per kecamatan (dulu dihitung klien dari 8.331 baris) — hapus kebutuhan mengunduh 2 MB. (Tanjung Priok: 507 dari 508 fasilitas tanpa koordinat, dihitung dari `gmti-ibadah.json`.)
- Opsional `?category=gci,ibadah` & `?bbox=`. Untuk 4.825 titik array ringkas (±1,5 MB mentah, ~200 KB gzip, *perkiraan*) masih wajar; alternatif `format=geojson`. Choropleth point-in-polygon tetap di klien (bergantung kategori aktif) **atau** server mengirim `density[geo_key][category]` untuk semua titik berkoordinat (lebih ringan; disarankan, karena klien cukup menjumlah kategori aktif).
- `href` lake memakai rute v2 `/sdi/<slug>`; sesuaikan dengan rute Nuxt.
- Saran perbaikan (konfirmasi ke owner, karena mengubah tampilan): filter bbox DKI (≈ lat −6.40…−5.19, lng 106.38…106.98 termasuk Kep. Seribu) dan normalisasi `city` ke 6 wilayah.
- Penemuan kolom (DESCRIBE + tebak nama) sebaiknya diganti di Data API dengan daftar tabel→kolom eksplisit/terdokumentasi; jika tetap otomatis, aturan §2.2 langkah 4 harus dipertahankan persis agar hasil sama.

### 4.11 `GET /v1/hotel-scraped?limit=100`
```json
{ "rows": [ { "hotel_id": "alova-by-kozystay-senayan", "hotel_name": "Alova by Kozystay - Senayan",
    "hotel_url": "https://www.booking.com/hotel/id/alova-by-kozystay-senayan.html", "address": "", "city": "Jakarta", "country": "Indonesia",
    "latitude": null, "longitude": null, "distance_km": null, "star_rating": null, "review_score": 8.5, "review_label": "Very good",
    "review_count": 4, "price_idr": 1940280, "price_currency": "IDR", "price_raw": "Rp 1,940,280", "rooms_left": null,
    "total_room_types": null, "room_types": [], "is_available": 1, "checkin": "2026-09-29", "checkout": "2026-09-30",
    "adults": 2, "scraped_at": "2026-09-15 07:33:20", "source": "booking.com-poc" } ],
  "stats": { "total": 72, "with_coords": 54, "with_address": 50, "with_rooms_left": 0, "with_rooms": 36, "avg_price": 1229127,
             "min_price": 209274, "max_price": 4053500, "distinct_cities": 1, "total_room_types": "…", "avg_room_types_per_hotel": "…" },
  "price_histogram": [ {"bucket":"<500K","count":10}, {"bucket":"500K-1M","count":12}, {"bucket":"1M-2M","count":7}, {"bucket":"2M-5M","count":5}, {"bucket":"5M+","count":0} ],
  "last_checkin": "2026-09-29", "source": "booking.com-poc",
  "note": "Sandbox table from research-grade POC scraper. Exit-strategy → Booking Demand API." }
```
Contoh baris dan angka `stats`/`price_histogram` dihitung dari `data/crawl/booking-hotel-2026-09-15.json` dengan logika SQL route **tanpa** jendela 7 hari (72 baris; snapshot-terakhir-per-(checkin,hotel) = 34 baris → histogram 10/12/7/5/0; 19 hotel punya `total_room_types`, jumlahnya tergantung `anyLast` → *belum terverifikasi*). Ini bukan hasil query ClickHouse. `price_histogram` dihitung server (frontend tanpa agregasi); scatter tetap dari `rows`. Putuskan jendela stats: tiru `7 DAY` (hasil 0 sekarang) atau pakai snapshot terakhir — sarankan "snapshot terakhir" dan tandai sebagai perubahan. Sumber: Gold `serving.mart_hotel_scraped_booking` (kosong per 2026-10-21) atau dibangun ulang dari `bronze_file.booking_hotel_2026_09_15` (sesuai peta jalan `plans/2026-10-08-lakehouse-00-peta-jalan.md:76`).

### 4.12 Aset statis (tidak lewat API)
`public/geo/dki-jakarta.geojson` (42 poligon kecamatan; peta dasar, sengaja tidak diekspor ke Bronze) → salin ke Nuxt `public/geo/`. Ikon kategori SVG & warna boleh ikut di `/v1/spatial.categories` atau di-hardcode di Nuxt (sama nilainya).

---

## 5. Hal yang belum terverifikasi
1. Isi aktual Silver/Gold untuk seluruh `bronze_file.*` di atas (ClickHouse :18123 tidak terjangkau dari mesin ini).
2. Mengapa `serving.mart_hotel_scraped_booking` kosong sekarang (live API `rows: []`).
3. `GMTI_META` dihitung ulang dari Bronze: aritmetika cocok (`gmti_tempat` 1.105 − 770 ibadah = 335 halal; 1.061 − 770 = 291 berkoordinat), tetapi cara `scripts/build-gmti.ts` menghitung `kecamatan`=44 dan `ibadahNonSignature` belum dicocokkan baris-per-baris.
4. Validitas OSM id golf (`node/1234560xx`).
5. Ukuran gzip payload `/v1/spatial` penuh (perkiraan).
