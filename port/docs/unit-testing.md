<!-- Berkas ini DIHASILKAN scripts/dokumen/bangun.py. Jangan diedit tangan. -->

# Unit testing portal

Gabungan semua `docs/skenario/*.md`. Satu tes per ID; nama tes diawali ID-nya. Kolom *Berkas*
dicari dari isi `backend/tests` dan `frontend/tests`; kolom *Status* dari laporan JUnit terakhir
(CI menyimpannya sebagai artefak; salin ke lokasi di bawah, atau set `JUNIT=a.xml,b.xml`, lalu
jalankan ulang `scripts/ekspor-dokumen.sh`). Paritas (`*-P*`) hanya dijalankan lokal melawan
produksi (SPEC §7), jadi statusnya tidak ada di laporan CI.

## Laporan JUnit

| Suite | Berkas | Waktu | Lulus | Gagal | Dilewati | Total |
|---|---|---|---|---|---|---|
| Pest | `backend/storage/logs/pest-junit.xml` | belum ada laporan | | | | |
| Vitest | `frontend/test-results/vitest-junit.xml` | belum ada laporan | | | | |
| Playwright e2e | `frontend/test-results/e2e-junit.xml` | belum ada laporan | | | | |

## Cakupan

| Bagian | Cakupan |
|---|---|
| Backend (Pest, clover) | belum ada laporan (`backend/storage/logs/clover.xml`) |
| Frontend (Vitest, json-summary) | belum ada laporan (`frontend/coverage/coverage-summary.json`) |

## Ringkasan per fitur

| Fitur (`docs/skenario/…`) | Skenario |
|---|---|
| `atlas.md` | 18 |
| `dashboard.md` | 19 |
| `dataset.md` | 39 |
| `gmti.md` | 15 |
| `indikator.md` | 24 |
| `sistem.md` | 13 |
| **Total** | **128** |

## Fitur `atlas`

### Backend — Pest Feature (`backend/tests/Feature/Atlas`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| AT-B01 | Enam endpoint KONTRAK §2.4 (+ pertunjukan `tahun=2025`) diteruskan dengan `data` byte-identik | `backend/tests/Feature/Atlas/AtlasTest.php` | belum dijalankan |
| AT-B02 | Kelas T: request kedua dari snapshot; pertunjukan per tahun punya snapshot sendiri | `backend/tests/Feature/Atlas/AtlasTest.php` | belum dijalankan |
| AT-B03 | `tahun` bukan `YYYY` → 422 tanpa memanggil Data API | `backend/tests/Feature/Atlas/AtlasTest.php` | belum dijalankan |
| AT-B04 | Data API mati tanpa snapshot → 503 `UPSTREAM_UNAVAILABLE`, satu percobaan | `backend/tests/Feature/Atlas/AtlasTest.php` | belum dijalankan |
| AT-B05 | LOG_HISTORY modul `atlas`, aksi = nama rute | `backend/tests/Feature/Atlas/AtlasTest.php` | belum dijalankan |
| AT-B06 | Tanpa token → 401 | `backend/tests/Feature/Atlas/AtlasTest.php` | belum dijalankan |

### E2E — Playwright (`frontend/tests/e2e/atlas.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| AT-E01 | Restoran GCI: filter tier, paging "Muat N lagi", cari kosong → "Tidak ada entri…" | `frontend/tests/e2e/atlas.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| AT-E02 | Restoran GCI: ekspor CSV/XLSX — nama `data-restoran-GCI-…`, 13 kolom, baris = hanya ber-rating | `frontend/tests/e2e/atlas.spec.ts` | belum dijalankan |
| AT-E03 | Direktori: tombol EN, bahasa + mode daftar bertahan setelah reload, cari, ekspor XLS; tanpa tombol Verifikasi (P2) | `frontend/tests/e2e/atlas.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| AT-E04 | Golf: kicker `LAPANGAN GOLF` (P1), 14 pin, filter Driving Range, pilih kartu, ekspor CSV | `frontend/tests/e2e/atlas.spec.ts` | belum dijalankan |
| AT-E05 | Suvenir: relevansi bawaan 35/67, "Semua", mode tabel, ekspor XLSX | `frontend/tests/e2e/atlas.spec.ts` | belum dijalankan |
| AT-E06 | Hotel dan pertunjukan merender data | `frontend/tests/e2e/atlas.spec.ts` | belum dijalankan |

### Paritas (`frontend/tests/parity/atlas.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| AT-P01 | `/gci/pariwisata/restoran-gci` | `frontend/tests/parity/atlas.spec.ts` | paritas, lokal |
| AT-P02 | `/gci/pariwisata/direktori-restoran` — P2: bilah verifikasi + kolom footer; layar pertama | `frontend/tests/parity/atlas.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| AT-P03 | `/gpci/lapangan-golf` — P1: kicker; tile peta | `frontend/tests/parity/atlas.spec.ts` | paritas, lokal |
| AT-P04 | `/gpci/toko-suvenir` — iframe Maps | `frontend/tests/parity/atlas.spec.ts` | paritas, lokal |
| AT-P05 | `/gpci/hotel` | `frontend/tests/parity/atlas.spec.ts` | paritas, lokal |
| AT-P06 | `/gci/pariwisata/pertunjukan-budaya` — tile peta, iframe | `frontend/tests/parity/atlas.spec.ts` | paritas, lokal |

## Fitur `dashboard`

### Backend — Pest Feature (`backend/tests/Feature/Dashboard`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| DB-B01 | Ke-23 endpoint KONTRAK §2.2 diteruskan dengan `data` byte-identik (fixture rekaman) | `backend/tests/Feature/Dashboard/DashboardTest.php` | belum dijalankan |
| DB-B02 | Kelas T (mis. `lama-menginap/seri`) dari snapshot, kelas P (mis. `wisman/kebangsaan`) dari cache; urutan parameter tidak membuat entri ganda | `backend/tests/Feature/Dashboard/DashboardTest.php` | belum dijalankan |
| DB-B03 | Parameter di luar kontrak → 422 tanpa memanggil Data API (`tamu`/`jenis` wajib atau tak dikenal, tahun/periode salah bentuk, `top` > 50) | `backend/tests/Feature/Dashboard/DashboardTest.php` | belum dijalankan |
| DB-B04 | Data API mati → 503 `UPSTREAM_UNAVAILABLE` | `backend/tests/Feature/Dashboard/DashboardTest.php` | belum dijalankan |
| DB-B05 | LOG_HISTORY: modul `dashboard`, aksi = nama rute, sumber | `backend/tests/Feature/Dashboard/DashboardTest.php` | belum dijalankan |
| DB-B06 | Tanpa token → 401 | `backend/tests/Feature/Dashboard/DashboardTest.php` | belum dijalankan |
| DB-B07 | Parameter di luar kontrak endpoint (mis. `top` di pintu-masuk, `tahun` di destinasi/bulanan) tidak diteruskan ke Data API | `backend/tests/Feature/Dashboard/DashboardTest.php` | belum dijalankan |

### Frontend — Vitest (`frontend/tests/nuxt/dashboard.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| DB-F01 | `useDashboard`: kebangsaan selalu `top=8`; kota/destinasi kosong tidak dikirim | `frontend/tests/nuxt/dashboard.spec.ts` | belum dijalankan |

### E2E — Playwright (`frontend/tests/e2e/dashboard.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| DB-E01 | `/dashboard`: KPI ringkasan ("Rp 411 T", quirk Q3) dan kartu menu → PDRB ("Rp 410,6 T") | `frontend/tests/e2e/dashboard.spec.ts` | belum dijalankan |
| DB-E02 | Wisman: toggle tahun (kebangsaan + pintu masuk), pilih bulan (KPI bulan, pintu bulanan BPS), semester belum dirilis | `frontend/tests/e2e/dashboard.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| DB-E03 | Wisnus: filter kota tujuan | `frontend/tests/e2e/dashboard.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| DB-E04 | Tenaga kerja: pilih tahun subsektor | `frontend/tests/e2e/dashboard.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| DB-E05 | PDRB: toggle sebaran dan pertumbuhan dengan periode berbeda | `frontend/tests/e2e/dashboard.spec.ts` | belum dijalankan |
| DB-E06 | Perbesar grafik: modal, Esc menutup | `frontend/tests/e2e/dashboard.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |

### Paritas (`frontend/tests/parity/dashboard.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| DB-P01 | `/dashboard` | `frontend/tests/parity/dashboard.spec.ts` | paritas, lokal |
| DB-P02 | `/dashboard/wisman` | `frontend/tests/parity/dashboard.spec.ts` | paritas, lokal |
| DB-P03 | `/dashboard/wisnus` | `frontend/tests/parity/dashboard.spec.ts` | paritas, lokal |
| DB-P04 | `/dashboard/tenaga-kerja` | `frontend/tests/parity/dashboard.spec.ts` | paritas, lokal |
| DB-P05 | `/dashboard/pdrb-ekraf` | `frontend/tests/parity/dashboard.spec.ts` | paritas, lokal |

## Fitur `dataset`

### Backend — Pest Feature (`backend/tests/Feature/{Dataset,Beranda}`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| DS-B01 | Katalog (`tier=semua`, `tier=primer`) diteruskan: `data` byte-identik, `meta.source` ikut | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B02 | Katalog kelas T: request kedua dari snapshot, Data API dipanggil sekali | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B03 | Detail diteruskan; slug tak dikenal → 404 envelope `NOT_FOUND` | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B04 | Baris meneruskan `page`, `size`, `q`, `sort`; `f[]` → `f=` berulang | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B05 | Baris kelas P: request kedua dari cache (`meta.sumber = cache`), isi sama | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B06 | Filter tak valid: 400 `INVALID_FILTER` Data API diteruskan dan tidak di-cache | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B07 | Parameter di luar kontrak (size > 200, sort tanpa arah, agg/format tak dikenal, agregat tanpa x) → 422 tanpa memanggil Data API | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B08 | `halaman` = `{dataset, kolom, baris}` dari tiga panggilan; `meta.total` = baris Silver; slug tak dikenal → 404 tanpa memanggil kolom/baris | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B09 | Facet dan agregat diteruskan; agregat membawa filter | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B10 | Ekspor dialirkan byte-identik (BOM, CRLF), header `Content-Disposition` `-terfilter`, `X-Row-Count`, `X-Accel-Buffering: no`; LOG_HISTORY mencatat filter dan jumlah baris | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B11 | Ekspor di atas batas → 413 `TOO_LARGE` dalam envelope | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B12 | Data API mati → 503 `UPSTREAM_UNAVAILABLE` (katalog tanpa snapshot, baris, halaman) | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B13 | Tiap request tercatat: modul `dataset`, aksi = nama rute, `request_id` = `meta.request_id`, jumlah baris, sumber | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| DS-B14 | Tanpa token → 401 | `backend/tests/Feature/Dataset/DatasetTest.php` | belum dijalankan |
| BR-B01 | Ringkasan beranda diteruskan, request kedua dari snapshot | `backend/tests/Feature/Beranda/BerandaTest.php` | belum dijalankan |

### Frontend — Vitest (`frontend/tests/{unit,nuxt}`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| DS-F01 | `useDatasetBaris`: muat awal lewat `halaman`, halaman berikut lewat `baris` dengan `page = baris_dimuat / 50 + 1` | `frontend/tests/nuxt/dataset.spec.ts` | belum dijalankan |
| DS-F02 | `useDatasetBaris`: pencarian di-debounce 350 ms dan di-trim; ketikan beruntun hanya memicu satu request | `frontend/tests/nuxt/dataset.spec.ts` | belum dijalankan |
| DS-F03 | Serialisasi filter: `rowQueryParams` ↔ `parseRowQuery` bolak-balik (in berulang, range terbuka, sort, q) dan bentuk `f[]` untuk Laravel | `frontend/tests/unit/dataset.spec.ts` | belum dijalankan |
| DS-F04 | `useDatasetBaris`: jawaban usang (filter lama) dibuang | `frontend/tests/nuxt/dataset.spec.ts` | belum dijalankan |
| DS-F05 | `useDatasetBaris`: 404 → "Dataset belum tersedia di lakehouse", gagal jaringan → "Gagal memuat data" | `frontend/tests/nuxt/dataset.spec.ts` | belum dijalankan |
| DS-F06 | Chart builder: `isNumericCol`, `pickDefaultDim`, dan sanitasi preferensi `localStorage["dispar:dataset-charts:{slug}"]` sama dengan v2 | `frontend/tests/unit/dataset.spec.ts` | belum dijalankan |
| DS-F07 | `fmtPeriode`, `renderCell`/`fmtCell`, label chip filter (`Kebangsaan: 5 nilai`, rentang `…`) | `frontend/tests/unit/dataset.spec.ts` | belum dijalankan |
| DS-F08 | `/docs`: `endpoints.json` = hasil `scripts/docs-dari-openapi.ts` atas ekspor Scramble terbaru; rute `sistem/*` tidak ada | `frontend/tests/unit/dataset.spec.ts` | belum dijalankan |

### E2E — Playwright (`frontend/tests/e2e/dataset.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| DS-E01 | `/katalog`: cari mengurangi baris; kosong → "Tidak ada dataset yang cocok." | `frontend/tests/e2e/dataset.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| DS-E02 | `/katalog`: filter tier dan lapisan (Silver) | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |
| DS-E03 | `/sdi` → klik "Lihat data →" membuka detail S1 dengan hero, meta, dan tabel | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |
| DS-E04 | Detail: tambah chip filter (kebangsaan JEPANG) lalu hapus | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |
| DS-E05 | Detail: klik header kolom → ▲ → ▼ → ↕ | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |
| DS-E06 | Detail: gulir memuat 50 baris berikutnya | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |
| DS-E07 | Detail: unduh CSV terfilter → nama `…-terfilter.csv`, diawali BOM | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |
| DS-E08 | Detail: chart builder "+ Tambah grafik" → kartu chart dengan canvas, bertahan setelah reload | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |
| DS-E09 | `/sdi/tidak-ada` → "Dataset belum tersedia di lakehouse. Coba buka di portal SDI ↗." | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |
| BR-E01 | `/` merender hero dengan angka dari API dan tautan kartu | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |
| DC-E01 | `/docs` merender daftar endpoint dari OpenAPI; tanpa `sistem/*` | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |

### Paritas (`frontend/tests/parity/dataset.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| DS-P01 | `/` — P4: angka hero beranda (hidup vs beku Next.js) | `frontend/tests/parity/dataset.spec.ts` | paritas, lokal |
| DS-P02 | `/katalog` | `frontend/tests/parity/dataset.spec.ts` | paritas, lokal |
| DS-P03 | `/sdi` | `frontend/tests/parity/dataset.spec.ts` | paritas, lokal |
| DS-P04 | `/sdi/{S1}`, `/sdi/{S2}`, `/sdi/{S3}` | `frontend/tests/parity/dataset.spec.ts` | paritas, lokal |
| DC-P01 | `/docs` — P3: isi endpoint (dihasilkan dari OpenAPI); hanya kerangka dibandingkan | `frontend/tests/parity/dataset.spec.ts` | paritas, lokal |

## Fitur `gmti`

### Backend — Pest Feature (`backend/tests/Feature/Gmti`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| GM-B01 | Lima endpoint KONTRAK §2.5 diteruskan dengan `data` byte-identik | `backend/tests/Feature/Gmti/GmtiTest.php` | belum dijalankan |
| GM-B02 | Kelas baca: ringkasan dan spasial dari snapshot (T); tempat dan titik dari cache (P) | `backend/tests/Feature/Gmti/GmtiTest.php` | belum dijalankan |
| GM-B03 | Parameter di luar kontrak (size > 200, pilar tak dikenal, page 0, limit > 500) → 422 tanpa memanggil Data API | `backend/tests/Feature/Gmti/GmtiTest.php` | belum dijalankan |
| GM-B04 | Titik tak dikenal → 404 `NOT_FOUND` diteruskan | `backend/tests/Feature/Gmti/GmtiTest.php` | belum dijalankan |
| GM-B05 | Data API mati tanpa snapshot → 503, satu percobaan | `backend/tests/Feature/Gmti/GmtiTest.php` | belum dijalankan |
| GM-B06 | LOG_HISTORY modul `gmti`, `spasial`, `hotel-scraped` | `backend/tests/Feature/Gmti/GmtiTest.php` | belum dijalankan |
| GM-B07 | Tanpa token → 401 | `backend/tests/Feature/Gmti/GmtiTest.php` | belum dijalankan |

### E2E — Playwright (`frontend/tests/e2e/gmti.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| GM-E01 | `/gmti`: 8.666 tempat, "Tampilkan 200 lagi" memuat halaman server berikut, pilar Makan (174 + deskripsi), wilayah, cari, mode tabel | `frontend/tests/e2e/gmti.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| GM-E02 | `/gmti`: ekspor XLSX pilar Program — nama `jakarta-atlas-gmti-program-…`, 12 kolom, 43 baris | `frontend/tests/e2e/gmti.spec.ts` | belum dijalankan |
| GM-E03 | `/spatial`: toggle kepadatan, chip Hotel, reset, wilayah, cari satu tempat, popup | `frontend/tests/e2e/gmti.spec.ts` | belum dijalankan |
| GM-E04 | `/spatial`: API gagal → "Titik lakehouse belum dapat dimuat." dan "Coba lagi" memuat ulang (satu-satunya rute browser yang dipalsukan) | `frontend/tests/e2e/gmti.spec.ts` | belum dijalankan |
| GM-E05 | `/scraped-hotels`: data Bronze tampil; membuka baris memperlihatkan tabel tipe kamar | `frontend/tests/e2e/gmti.spec.ts` | belum dijalankan |

### Paritas (`frontend/tests/parity/gmti.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| GM-P01 | `/gmti` | `frontend/tests/parity/gmti.spec.ts` | paritas, lokal |
| GM-P02 | `/spatial` — panel saja; tile/pin/choropleth di-mask; tinggi dihitung ulang setelah dock AI dibuang | `frontend/tests/parity/gmti.spec.ts` | paritas, lokal |
| GM-P03 | `/scraped-hotels` — respons produksi (kosong) disuntikkan ke portal; render atas data sama | `frontend/tests/parity/gmti.spec.ts` | paritas, lokal |

## Fitur `indikator`

### Backend — Pest Feature (`backend/tests/Feature/Indikator`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| IN-B01 | Endpoint KONTRAK §2.3 diteruskan byte-identik (daftar, detail berdata dan gap, kode huruf kecil, gci/resmi, dataset-tematik, 3 pariwisata) | `backend/tests/Feature/Indikator/IndikatorTest.php` | belum dijalankan |
| IN-B02 | Detail kelas T dari snapshot; seni-pertunjukan kelas P dari cache, termasuk respons > 32 KB (ORA-01461) | `backend/tests/Feature/Indikator/IndikatorTest.php` | belum dijalankan |
| IN-B03 | Kode tak dikenal → 404 | `backend/tests/Feature/Indikator/IndikatorTest.php` | belum dijalankan |
| IN-B04 | `framework` wajib dan GCI/GPCI; `tahun` `YYYY` → 422 tanpa memanggil Data API | `backend/tests/Feature/Indikator/IndikatorTest.php` | belum dijalankan |
| IN-B05 | Satu percobaan, timeout `dataapi.timeout_lambat` (60 s); Data API mati → 503 | `backend/tests/Feature/Indikator/IndikatorTest.php` | belum dijalankan |
| IN-B06 | LOG_HISTORY modul `indikator` | `backend/tests/Feature/Indikator/IndikatorTest.php` | belum dijalankan |
| IN-B07 | Tanpa token → 401 | `backend/tests/Feature/Indikator/IndikatorTest.php` | belum dijalankan |

### Frontend — Vitest (`frontend/tests/unit/indikator.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| IN-F01 | Blok setengah lebar berurutan digabung; batang setengah hijau lalu kuning | `frontend/tests/unit/indikator.spec.ts` | belum dijalankan |
| IN-F02 | Sel peringkat artis "Nama ✓ · Negara" diurai | `frontend/tests/unit/indikator.spec.ts` | belum dijalankan |
| IN-F03 | `bulanLabel` | `frontend/tests/unit/indikator.spec.ts` | belum dijalankan |

### E2E — Playwright (`frontend/tests/e2e/indikator.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| IN-E01 | `/gci` peringkat resmi + kartu + dataset; pindah ke `/gpci` | `frontend/tests/e2e/indikator.spec.ts` | belum dijalankan |
| IN-E02 | Tabel kesiapan → detail → tautan kembali | `frontend/tests/e2e/indikator.spec.ts` | belum dijalankan |
| IN-E03 | 28 indikator 200 tanpa error halaman; 9 gap "Data belum tersedia"; kode tak dikenal 404 | `frontend/tests/e2e/indikator.spec.ts` | belum dijalankan |
| IN-E04 | Prefiks silang `/gpci/CE1`, `/gci/CI-FV` (C §2.1) | `frontend/tests/e2e/indikator.spec.ts` | belum dijalankan |
| IN-E05 | Peta arketipe A (CI-MU) | `frontend/tests/e2e/indikator.spec.ts` | belum dijalankan |
| IN-E06 | Seni pertunjukan: pilih tahun (`?tahun=`), pilih venue di peta → panel kanan berganti (desktop; di mobile peta v2 setinggi 0 px, ditiru) | `frontend/tests/e2e/indikator.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |

### Paritas (`frontend/tests/parity/indikator.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| IN-P01 | `/gci` — kolom "Nilai terbaru" tidak dibandingkan angkanya (defect D, urutan baris tak deterministik) | `frontend/tests/parity/indikator.spec.ts` | paritas, lokal |
| IN-P02 | `/gpci` — idem; mobile dibandingkan layar pertama | `frontend/tests/parity/indikator.spec.ts` | paritas, lokal |
| IN-P03 | 28 × `/gci/gpci/[code]` — peta di-mask | `frontend/tests/parity/indikator.spec.ts` | paritas, lokal |
| IN-P04 | `/gci/pariwisata/wisatawan-internasional` | `frontend/tests/parity/indikator.spec.ts` | paritas, lokal |
| IN-P05 | `/gci/pariwisata/kuliner-michelin` | `frontend/tests/parity/indikator.spec.ts` | paritas, lokal |
| IN-P06 | `/gci/pariwisata/seni-pertunjukan` — peta + iframe di-mask | `frontend/tests/parity/indikator.spec.ts` | paritas, lokal |
| IN-P07 | `/gci/pariwisata/seni-pertunjukan?tahun=2025` — idem | `frontend/tests/parity/indikator.spec.ts` | paritas, lokal |
| IN-P08 | `/gci/pariwisata/seni-pertunjukan?tahun=2024` — idem (semua tahun event tersedia) | `frontend/tests/parity/indikator.spec.ts` | paritas, lokal |

## Fitur `sistem`

### Backend — Pest Feature (`backend/tests/Feature/Sistem`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| SI-B01 | `portal:sinkron` semua sukses: satu snapshot per rute kelas T × varian (28 kode indikator, tier katalog, tahun pertunjukan); endpoint P tidak dipanggil | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B02 | Sebagian gagal: snapshot lama tetap, JOB_RUNS `sebagian`, kegagalan dirinci per rute + varian | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B03 | HASH sama → snapshot tidak ditulis ulang (`berubah` 0) | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B04 | Tidak tumpang tindih: jadwal 11:00 Asia/Jakarta `withoutOverlapping`; kunci dipegang → cron dilewati, pemicu manual 409 | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B05 | Snapshot lebih tua dari 36 jam → `meta.stale = true` | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B06 | Snapshot hilang dan Data API mati → 503 `UPSTREAM_UNAVAILABLE` | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B07 | `portal:bersihkan-log` menghapus tepat yang lebih tua dari 180 hari (LOG_HISTORY + JOB_RUNS) | `backend/tests/Feature/Sistem/AdminTest.php` | belum dijalankan |
| SI-B08 | `sistem/log`: filter modul dan tanggal (hari WIB), 50 per halaman terbaru dulu; `sistem/job` berhalaman | `backend/tests/Feature/Sistem/AdminTest.php` | belum dijalankan |
| SI-B09 | Rute admin menolak token `read` (403) dan tanpa token (401) | `backend/tests/Feature/Sistem/AdminTest.php` | belum dijalankan |
| SI-B10 | `POST sistem/job/sinkron` → 202, sinkron berjalan setelah respons, `PEMICU=manual` | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B11 | `POST sistem/cache/kosongkan` menghapus cache Data API, snapshot tetap | `backend/tests/Feature/Sistem/AdminTest.php` | belum dijalankan |
| SI-B12 | Rute admin tercatat di LOG_HISTORY modul `sistem` | `backend/tests/Feature/Sistem/AdminTest.php` | belum dijalankan |

### E2E — Playwright (`frontend/tests/e2e/sistem.spec.ts`, project `sistem`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| SI-E01 | Tabel di atas, satu tes per baris: sinkron manual (token admin), kosongkan cache, Data API dimatikan lewat sakelar pemutar fixture (`POST /__uji/mati`) | `frontend/tests/e2e/sistem.spec.ts` | belum dijalankan |

