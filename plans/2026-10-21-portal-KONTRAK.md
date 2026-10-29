# Kontrak: rute halaman → fitur → endpoint Laravel → endpoint Data API → sumber

Dokumen planner, 21 Okt 2026. Pelengkap `plans/2026-10-21-portal-SPEC.md`. Plan 01 mengubah
dokumen ini menjadi dua OpenAPI yang presisi:

- `lakehouse/data-api/openapi.yaml` (Data API)
- `lakehouse/data-api/docs/laravel-openapi.draft.yaml` (Laravel publik, draf). Plan 10
  menyalinnya ke repo portal `docs/api/`. Versi final dihasilkan scramble.

Bentuk JSON per endpoint **sudah diusulkan** di inventaris. Kolom "Bentuk" menunjuk bagiannya.
Plan 01 memakai usulan itu dengan aturan penyeragaman di §3, dan setiap penyimpangan dicatat di
PR.

Singkatan inventaris: **A** shell, **B** dashboard, **C** indikator, **D** atlas/gmti/spasial,
**E** sdi/api, **F** keadaan lake (`plans/2026-10-21-portal-inventaris/`).

---

## 1. Rute halaman → layer Nuxt pemilik

| Rute (sama persis dengan Next.js) | Layer | Komponen asal | Inventaris |
|---|---|---|---|
| `/` | beranda | `app/page.tsx` | A §7.1 |
| `/katalog` | dataset | `CatalogView` | A §7.2, E §1.1 |
| `/sdi` | dataset | `CatalogView primaryOnly` | E §1.1 |
| `/sdi/[slug]` | dataset | `app/sdi/[slug]/page.tsx`, `DatasetFilters`, `DatasetCharts`, `SdiTable` | E §1.2–1.4 |
| `/docs` | docs | `docs-client.tsx` (isi diganti, P3) | A §7.4 |
| `/dashboard` | dashboard | `app/dashboard/page.tsx` | B §2 |
| `/dashboard/wisman` | dashboard | `WismanStat`, `LosByClass` | B §3 |
| `/dashboard/wisnus` | dashboard | `WisnusStat`, `WisnusLos`, `LosByClass` | B §4 |
| `/dashboard/tenaga-kerja` | dashboard | page + `TkSubsektor` | B §5 |
| `/dashboard/pdrb-ekraf` | dashboard | `PdrbEkrafStat` | B §6 |
| `/gci`, `/gpci` | indikator | `GciView`/`FrameworkView`, `GciOfficial` | C §1.4–1.5 |
| `/gci/[code]`, `/gpci/[code]` | indikator | `IndicatorShell` + 19 view + 9 "belum tersedia" | C §2 |
| `/gci/pariwisata/wisatawan-internasional` | indikator | `PariwisataShell`, `WismanDashboard` | C §3.1 |
| `/gci/pariwisata/kuliner-michelin` | indikator | page | C §3.2 |
| `/gci/pariwisata/seni-pertunjukan` | indikator | page + `VenueMap` | C §3.3 |
| `/gci/pariwisata/restoran-gci` | atlas | `GciView` | C §3.4, D §2.3 |
| `/gci/pariwisata/direktori-restoran` | atlas | `Dashboard` (+ toggle ID/EN) | C §3.5, D §2.4 |
| `/gci/pariwisata/pertunjukan-budaya` | atlas | `EventsView` | C §3.6, D §2.5 |
| `/gpci/hotel` | atlas | `HotelView` | C §3.7, D §2.8 |
| `/gpci/lapangan-golf` | atlas | `GolfView` | C §3.8, D §2.6 |
| `/gpci/toko-suvenir` | atlas | `SouvenirView` | C §3.9, D §2.7 |
| `/gmti` | gmti | `GmtiView` | D §2.1 |
| `/spatial` | spasial | `GmtiMapView` | D §2.2 |
| `/scraped-hotels` | hotel-scraped | page (berbahasa Inggris, tiru) | D §2.9 |

**Redirect** (`routeRules`):

| Dari | Ke |
|---|---|
| `/atlas` | `/spatial` |
| `/atlas/:section` | href section, atau 404 |
| `/atlas/{restaurants,souvenir,golf}/map` | `/spatial` |
| `/gmti/map` | `/spatial` |
| `/katalog/hotel` | `/gpci/hotel` |
| `/readiness` | `/gci` |

**Prefiks silang.** `/gpci/CE1` dan `/gci/CI-FV` diterima seperti sekarang (C §2.1). Tidak
ditambah redirect.

---

## 2. Endpoint per fitur

Kolom **Laravel** adalah path publik (`/api/v1/…`, dipanggil Nuxt lewat proxy `/_api/…`). Kolom
**Data API** adalah path `/v1/…` di `data-api.rantai.dev`. Path Laravel = path Data API dengan
awalan `/api`, kecuali yang ditandai. **Kelas** mengikuti SPEC §4.6: T = tetap (snapshot),
P = berparameter (cache TTL), S = aliran.

### 2.1 dataset (`/katalog`, `/sdi`, `/sdi/[slug]`, `SdiTable`)

| Data API | Kelas | Sumber | Bentuk |
|---|---|---|---|
| `GET /v1/katalog?tier=primer\|sekunder\|semua&sumber=sdi\|internal\|instansi\|crawling&tag=…` | T | `lake.bronze_meta*.dataset_catalog` ∪ katalog sekunder + medallion | E §4.1 `/v1/datasets`, ditambah baris sekunder (lihat catatan 1) |
| `GET /v1/dataset/{slug}` | P | `dataset_catalog` + `dataset_sync` + periode min/max Silver | E §4.1 |
| `GET /v1/dataset/{slug}/kolom` | P | `dataset_column` + `DESCRIBE silver.<t>` | E §4.1 `/columns` |
| `GET /v1/dataset/{slug}/facet` | P | Silver | E §2.5 |
| `GET /v1/dataset/{slug}/baris?page&size&sort&q&f` | P | Silver | E §4.1 `/rows` |
| `GET /v1/dataset/{slug}/agregat?x&y&agg&q&f` | P | Silver | E §2.6 |
| `GET /v1/dataset/{slug}/ekspor?format=csv\|xlsx&q&f&sort` | S | Silver | E §4.1 `/export` |

Catatan:

1. Halaman `/katalog` sekarang menggabung katalog lake dengan 43 entri dari `lib/secondary.ts`,
   sedangkan `bronze_meta_sec.dataset_catalog` berisi 37. Plan 02 mencocokkan keduanya.
   - Entri yang ada di lake dibaca dari lake.
   - Entri sisanya, berupa penunjuk ke halaman atlas, disimpan di
     `data_api/features/dataset/katalog_tautan.toml` sebagai metadata navigasi, beserta
     `rows` yang dihitung dari tabel Bronze-nya. Angka tulisan tangan tidak dipakai.
   - Bila ada entri yang datanya tidak ada di lake: STOP dan laporkan.
2. Laravel menambah satu rute gabungan `GET /api/v1/dataset/{slug}/halaman?page=1&size=50`
   (meta + kolom + baris pertama). Tujuannya agar halaman detail cukup memuat satu request,
   sama seperti sekarang (E §4.2). Rute ini disusun di Laravel dari tiga panggilan Data API.
3. Parameter `f`: Laravel `f[]=…`, Data API `f=…` berulang (SPEC §4.4).

### 2.2 dashboard

| Data API | Kelas | Sumber (sama dengan Next.js, SPEC K-1) | Bentuk |
|---|---|---|---|
| `GET /v1/dashboard/ringkasan` | T | `serving.mart_wisman`, `bronze_file.pdrb_ekraf_makro`, `bronze_file.target_wisman` | B §2 |
| `GET /v1/dashboard/wisman/tahunan` | T | `serving.mart_wisman` + `target_wisman` | B §3.5 (1) |
| `GET /v1/dashboard/wisman/bulanan` | T | `serving.mart_wisman` | B §3.5 (2), sertakan bentuk `yoy` |
| `GET /v1/dashboard/wisman/kebangsaan?tahun\|periode&top=8` | P | `serving.mart_wisman` | B §3.5 (3) |
| `GET /v1/dashboard/wisman/pintu-masuk?tahun\|periode` | P | `silver.jumlah_wisatawan`, `silver.wisman_per_pintu_masuk_bulanan_bps` | B §3.5 (4) |
| `GET /v1/dashboard/lama-menginap/rata-rata` | T | `silver.data_rata_rata_lama_menginap_…` | B §3.5 (5) |
| `GET /v1/dashboard/lama-menginap/per-kelas?tamu&periode` | P | sama | B §3.5 (6) |
| `GET /v1/dashboard/lama-menginap/seri?tamu` | T | sama | B §3.5 (6) |
| `GET /v1/dashboard/wisnus/meta` | T | `silver.wisnus_perjalanan_per_kota_tujuan` | B §4.5 (1) |
| `GET /v1/dashboard/wisnus/tahunan?kota` | P | sama | B §4.5 (2) |
| `GET /v1/dashboard/wisnus/per-kota?tahun` | P | sama | B §4.5 (3) |
| `GET /v1/dashboard/wisnus/bulanan?kota` | P | sama | B §4.5 (4) |
| `GET /v1/dashboard/wisnus/yoy?kota` | P | sama | B §4.5 (5) |
| `GET /v1/dashboard/destinasi/meta?jenis` | T | `silver.jumlah_kunjungan_wisatawan_ke_obyek_wisata_menurut_lokasi_…` | `DestinasiStat` @ 61c2afd (halaman wisnus dan wisman) |
| `GET /v1/dashboard/destinasi/ringkasan?jenis&tahun&destinasi` | P | sama | sama: KPI + catatan |
| `GET /v1/dashboard/destinasi/per-destinasi?jenis&tahun` | P | sama | sama: grafik peringkat + tabel rincian |
| `GET /v1/dashboard/destinasi/bulanan?jenis&destinasi` | P | sama | sama: deret bulanan |
| `GET /v1/dashboard/tenaga-kerja/dki` | T | `silver.tenaga_kerja_ekraf_per_provinsi` | B §5.3 (1) |
| `GET /v1/dashboard/tenaga-kerja/subsektor?tahun` | P | `silver.tenaga_kerja_ekraf_per_subsektor_nasional` | B §5.3 (2) |
| `GET /v1/dashboard/tenaga-kerja/sertifikasi` | T | 2 view sertifikasi, UNION | B §5.3 (3) |
| `GET /v1/dashboard/pdrb-ekraf/makro` | T | `bronze_file.pdrb_ekraf_makro`, `target_kontribusi_ekraf_rpjmd` | B §6.3 (1), **pakai varian `kontribusi_vs_target` 13 baris** |
| `GET /v1/dashboard/pdrb-ekraf/subsektor/sebaran?periode` | P | `bronze_file.pdrb_ekraf_subsektor` | B §6.3 (2), dipisah |
| `GET /v1/dashboard/pdrb-ekraf/subsektor/pertumbuhan?periode` | P | sama | B §6.3 (2), dipisah |

Quirk B Q1–Q22 ditiru (SPEC K-10). Satu-satunya pengecualian: Q1. `TARGET_WISMAN` cukup punya
satu sumber, yaitu `bronze_file.target_wisman`, karena nilainya identik. Plan 03 memverifikasi
kesamaan itu dan STOP bila berbeda.

### 2.3 indikator

| Data API | Kelas | Sumber | Bentuk |
|---|---|---|---|
| `GET /v1/indikator?framework=GCI\|GPCI` | T | `bronze_file.gci_gpci_indicators` (lihat catatan 2), katalog, Silver | C §4.1, §4.3 |
| `GET /v1/indikator/{code}` | T (28 kunci) | pemilihan dataset (catatan 1) + Silver | C §4.3 |
| `GET /v1/gci/resmi` | T | `bronze_file.gci_kearney_resmi` | C §4.3 |
| `GET /v1/dataset-tematik?framework` | T | hitungan dari tabel sumber | C §4.1 |
| `GET /v1/pariwisata/wisatawan-internasional` | T | slug `wisman-jakarta-per-*` + `target_wisman` | C §3.1, §4.3 |
| `GET /v1/pariwisata/kuliner-michelin` | T | `jumlah-restoran-per-kelurahan` (+2) | C §3.2 |
| `GET /v1/pariwisata/seni-pertunjukan?tahun` | P | `data-seni-pertunjukan-dan-visual`, `jumlah-penyelenggaraan-event`, `bronze_file.seni_venue`, `artis_tampil_jakarta`, `artis-top-global-chart` | C §3.3 |

Catatan:

1. **[K-12] Pemilihan dataset indikator.** Data API v1 **memporting algoritma**
   `datasetsFor`/`pickData`/`primaryData` (`lib/indicator-data.ts`) dan `computeReadiness`/
   `latestValue` (`lib/gci/readiness.ts`) apa adanya. Alasannya, paritas harus tetap benar
   ketika katalog berubah, bukan hanya pada tanggal inventaris. Hasil pemilihan (slug terpilih
   per peran) dikirim di `meta.dataset_terpilih`, supaya batch 3 bisa membekukannya menjadi
   pemetaan eksplisit.
   - Defect D1–D10 (C §2.6), termasuk "Nilai terbaru" yang berisi sampah, **ikut ditiru**.
   - Perbaikannya adalah keputusan pemilik yang terpisah dan tidak termasuk batch ini.
2. **Daftar indikator.** App membaca `platform-v2/data/gci-gpci-indicators.json`, sedangkan
   salinan root yang masuk Bronze sudah basi (`cmp` berbeda di byte 1686, C §0.10).
   - Plan 01 menyalin versi app ke root.
   - Plan 06 bagian A membangun ulang image Dagster sehingga Bronze ikut terbarui.
   - Sampai saat itu, panggung memakai `INDIKATOR_BERKAS` (plan 02 aturan "Sumber daftar
     indikator"). Produksi tidak pernah memakai override itu.
3. Teks `MomNote` dan label tanggal hero yang ditulis tangan (C §4.4) tetap menjadi konstanta di
   layer Nuxt `indikator`/`atlas`. Itu teks tampilan, bukan data.

### 2.4 atlas (enam subhalaman statis)

| Data API | Kelas | Sumber (`lake.bronze_file.*`, F §2) | Bentuk |
|---|---|---|---|
| `GET /v1/atlas/restoran-gci` | T | `gci_venue_kurasi`, `gci_venue_osm`, `gci_venue_rating`, `gci_venue_alamat`, `gci_venue_harga`, `gci_resto_hotel` (merge + dedup ≤ 60 m) | D §4.2, C §3.4 |
| `GET /v1/atlas/direktori-restoran` | T | `restoran_kurasi`, `restoran_osm` (dedup + filter DKI) | D §4.3, C §3.5 |
| `GET /v1/atlas/pertunjukan?tahun` | T (per tahun) | `event_pertunjukan` | D §4.4, C §3.6 |
| `GET /v1/atlas/golf` | T | `golf` | D §4.5 |
| `GET /v1/atlas/suvenir` | T | `souvenir` | D §4.6 |
| `GET /v1/atlas/hotel` | T | `hotel_registri`, `hotel_tpk`, `hotel_los` | D §4.7, C §3.7 |

Usulan D §4.1 `/v1/atlas/sections` **tidak dipakai**. Redirect `/atlas/*` memakai konstanta
`DATA_SECTIONS` di frontend (plan 10). Kartu dataset di `/gci` dan `/gpci` memakai
`/v1/dataset-tematik`. Hitungan barisnya ada di `shared/hitungan.py` Data API.

Merge GCI dan dedup restoran wajib menghasilkan JSON yang sama persis dengan golden statis
(SPEC §3.6). Ingat bahwa `restoran_osm` dan `gci_venue_osm` di Bronze masih **mentah, sebelum
dedup** (D, ringkasan butir 3).

### 2.5 gmti, spasial, hotel-scraped

| Data API | Kelas | Sumber | Bentuk |
|---|---|---|---|
| `GET /v1/gmti/ringkasan` | T | `gmti_tempat`, `gmti_kecamatan`, `gmti_tipologi`, `gmti_capaian`, `gmti_ibadah` (`GMTI_META` dihitung ulang) | D §4.8 |
| `GET /v1/gmti/tempat?page&size=200&pilar&kota&q` | P | sama | D §4.9 |
| `GET /v1/spasial` | T | titik statis (atlas + seni_venue + gmti) + Silver berkoordinat + `serving.mart_hotel_scraped_booking` (seperti sekarang, 0 titik) + agregat kecamatan | D §4.10, E §2.7 |
| `GET /v1/spasial/titik/{id}` | P | sama; detail satu titik untuk popup | D §4.10 |
| `GET /v1/hotel-scraped?limit` | T | `bronze_file.booking_hotel_2026_09_15` (SPEC P5, hanya halaman ini) | D §4.11, E §2.8 |

`/v1/spasial` mengirim titik ringkas, plus kepadatan per kecamatan yang sudah dihitung. Dengan
begitu browser tidak lagi mengunduh `gmti-ibadah.json` 2 MB. Titik ringkas **membawa alamat**
(diputuskan pemilik 29 Okt 2026), supaya pencarian peta mencocokkan nama + alamat + wilayah
seperti `GmtiMapView` yang tayang; ukurannya ±1,26 MB vs ±0,85 MB tanpa alamat (golden 4.217
titik statis). Popup detail (sertifikat dll.) memakai `/v1/spasial/titik/{id}`.

### 2.6 beranda

| Data API | Kelas | Sumber | Bentuk |
|---|---|---|---|
| `GET /v1/beranda/ringkasan` | T | hitungan katalog primer, Σ baris sekunder, jumlah indikator per framework | A §7.1, empat angka hero + stat empat kartu (P4) |

### 2.7 sistem (hanya Laravel, tidak diteruskan ke Data API)

| Laravel | Ability | Isi |
|---|---|---|
| `GET /api/v1/sistem/kesehatan` | tanpa token | status app, Oracle, dan Data API (`/v1/health`) |
| `GET /api/v1/sistem/log?modul&dari&sampai&page` | admin | `LOG_HISTORY` |
| `GET /api/v1/sistem/job?page` | admin | `JOB_RUNS` |
| `POST /api/v1/sistem/job/sinkron` | admin | jalankan `portal:sinkron` sekarang |
| `POST /api/v1/sistem/cache/kosongkan` | admin | kosongkan cache (snapshot tidak dihapus) |

Data API juga punya `GET /v1/health` (tanpa token) dan `POST /v1/admin/cache/flush` (token
`dagster`, dipanggil di akhir job `refresh_lakehouse`). Pemasangan pemanggilnya di Dagster
dilakukan di plan 06, bukan sebelumnya.

---

## 3. Aturan penyeragaman untuk plan 01

1. **Nama.** Path dan field memakai Bahasa Indonesia dengan `snake_case`, seperti usulan B/C/D.
   Usulan E (`datasets`, `rows`, `columns`) diganti `dataset`, `baris`, `kolom`. Nama kolom
   dataset SDI tetap apa adanya.
2. **Bentuk respons.** `data` berisi muatan. `meta` berisi `generated_at`, `source[]`,
   `request_id`, dan untuk daftar berhalaman `page`, `size`, `total`, `has_more`.
   - Nama jumlah selalu `total`, bukan `count`.
   - Untuk dataset, `meta.total` = jumlah baris Silver hasil filter, dan
     `data.total_bronze` = hitungan `dataset_sync.total`. Usulan E memakai `count`/`total_rows`;
     keduanya diganti agar nama seragam, dan pemetaannya dicatat di `x-catatan`.
3. **Warna.** Warna yang sekarang dihitung di komponen (subsektor, "Lainnya" `#cbd5e1`, palet
   donut) **tidak** dikirim API, kecuali bila warna bergantung pada data dan tidak bisa
   ditentukan dari label. Palet tetap di `layers/shared/utils/palettes.ts`. Ini mengubah usulan
   B (`warna` di item); plan 01 memutuskan per endpoint dan mencatatnya.
4. **Label terformat.** Label periode yang sekarang diformat di frontend (`fmtPeriode`, `BULAN`)
   tetap diformat di frontend. Label yang sekarang dibangun dari data (misalnya
   `"2026 (s/d Jul)"`) dikirim API, sesuai usulan B.
5. **Nilai kosong** dikirim sebagai `null`, bukan `0` dan bukan string kosong, kecuali
   Next.js memang menampilkan 0.
6. Setiap endpoint di OpenAPI punya `example` nyata yang diambil dari golden atau query .148,
   bukan contoh karangan.
