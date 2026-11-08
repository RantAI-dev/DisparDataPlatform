<!-- Berkas ini DIHASILKAN scripts/dokumen/bangun.py. Jangan diedit tangan. -->

# Unit testing portal

Gabungan semua `docs/skenario/*.md`. Satu tes per ID; nama tes diawali ID-nya. Kolom *Berkas*
dicari dari isi `backend/tests` dan `frontend/tests`; kolom *Status* dari laporan JUnit terakhir
(CI menyimpannya sebagai artefak; salin ke lokasi di bawah, atau set `JUNIT=a.xml,b.xml`, lalu
jalankan ulang `scripts/ekspor-dokumen.sh`). Paritas (`*-P*`) hanya dijalankan lokal melawan
produksi (SPEC §7), jadi statusnya tidak ada di laporan CI.

Asal laporan: run **lokal**, bukan CI: laporan terbaru 2026-10-29 01:04 UTC, checkout `40be871` ditambah perubahan backend/frontend yang belum di-commit.

## Laporan JUnit

| Suite | Berkas | Waktu | Lulus | Gagal | Dilewati | Total |
|---|---|---|---|---|---|---|
| Pest | `backend/storage/logs/pest-junit.xml` | 2026-10-29 01:04 UTC | 59 | 0 | 0 | 59 |
| Vitest | `frontend/test-results/vitest-junit.xml` | belum ada laporan | | | | |
| Playwright e2e | `frontend/test-results/e2e-junit.xml` | belum ada laporan | | | | |

## Cakupan

| Bagian | Cakupan | Waktu laporan |
|---|---|---|
| Backend (Pest, clover) | belum ada laporan (`backend/storage/logs/clover.xml`) | |
| Frontend (Vitest, json-summary) | belum ada laporan (`frontend/coverage/coverage-summary.json`) | |

Cakupan backend dari Pest (pcov, `app/`); cakupan frontend dari Vitest saja (`app/`, `layers/`,
`server/`). E2E Playwright tidak diukur cakupannya.

## Ringkasan per fitur

| Fitur (`docs/skenario/…`) | Skenario |
|---|---|
| `atlas.md` | 35 |
| `dashboard.md` | 30 |
| `dataset.md` | 46 |
| `gmti.md` | 31 |
| `indikator.md` | 29 |
| `sistem.md` | 24 |
| **Total** | **195** |

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
| AT-E02 | Restoran GCI: ekspor CSV/XLSX — nama `data-restoran-GCI-…`, 13 kolom, baris = hanya ber-rating | `frontend/tests/e2e/atlas.spec.ts`<br>`frontend/tests/parity/ekspor.spec.ts` | belum dijalankan |
| AT-E03 | Direktori: tombol EN, bahasa + mode daftar bertahan setelah reload, cari, ekspor XLS; tanpa tombol Verifikasi (P2) | `frontend/tests/e2e/atlas.spec.ts`<br>`frontend/tests/parity/ekspor.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| AT-E04 | Golf: kicker `LAPANGAN GOLF` (P1), 14 pin, filter Driving Range, pilih kartu, ekspor CSV | `frontend/tests/e2e/atlas.spec.ts`<br>`frontend/tests/parity/ekspor.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| AT-E05 | Suvenir: relevansi bawaan 35/67, "Semua", mode tabel, ekspor XLSX | `frontend/tests/e2e/atlas.spec.ts`<br>`frontend/tests/parity/ekspor.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| AT-E06 | Hotel dan pertunjukan merender data | `frontend/tests/e2e/atlas.spec.ts` | belum dijalankan |

### Paritas (`frontend/tests/parity/atlas.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| AT-P01 | `/gci/pariwisata/restoran-gci` | `frontend/tests/parity/atlas.spec.ts` | paritas, lokal |
| AT-P02 | `/gci/pariwisata/direktori-restoran` — P2: bilah verifikasi + kolom footer; layar pertama | `frontend/tests/parity/atlas.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| AT-P03 | `/gpci/lapangan-golf` — P1: kicker; tile peta | `frontend/tests/parity/atlas.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| AT-P04 | `/gpci/toko-suvenir` — iframe Maps | `frontend/tests/parity/atlas.spec.ts` | paritas, lokal |
| AT-P05 | `/gpci/hotel` | `frontend/tests/parity/atlas.spec.ts` | paritas, lokal |
| AT-P06 | `/gci/pariwisata/pertunjukan-budaya` — tile peta, iframe | `frontend/tests/parity/atlas.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P06 | `/gci/pariwisata/restoran-gci` — filter tier Cafe (AT-E01) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P07 | `/gci/pariwisata/direktori-restoran` — bahasa EN (AT-E03); P2, layar pertama | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P17 | `/gci/pariwisata/restoran-gci` — paging Muat lagi (AT-E01) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P18 | `/gci/pariwisata/restoran-gci` — cari tanpa hasil (AT-E01) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P19 | `/gci/pariwisata/direktori-restoran` — mode daftar (AT-E03); P2, layar pertama | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P20 | `/gci/pariwisata/direktori-restoran` — cari Toscana (AT-E03); P2, layar pertama | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P21 | `/gpci/lapangan-golf` — Driving Range + pilih kartu (AT-E04); P1 | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P22 | `/gpci/toko-suvenir` — Semua + mode tabel (AT-E05) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P23 | `/gci/pariwisata/pertunjukan-budaya` — tahun 2025 (pilihan UI: Semua/2025/2026) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P24 | `/gci/pariwisata/pertunjukan-budaya` — tahun 2026 | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| EK-P01 | `/gci/pariwisata/restoran-gci` — isi ekspor CSV (AT-E02) | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |
| EK-P02 | `/gci/pariwisata/restoran-gci` — isi ekspor XLSX (AT-E02) | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |
| EK-P03 | `/gci/pariwisata/direktori-restoran` — isi ekspor XLS (AT-E03) | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |
| EK-P04 | `/gpci/lapangan-golf` — isi ekspor CSV (AT-E04) | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |
| EK-P05 | `/gpci/toko-suvenir` — isi ekspor XLSX (AT-E05) | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |
| EK-P06 | `/gpci/hotel` — isi ekspor XLSX | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |
| EK-P07 | `/gci/pariwisata/pertunjukan-budaya` — isi ekspor XLSX | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |

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
| DB-E05 | PDRB: toggle sebaran dan pertumbuhan dengan periode berbeda | `frontend/tests/e2e/dashboard.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| DB-E06 | Perbesar grafik: modal, Esc menutup | `frontend/tests/e2e/dashboard.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |

### Paritas (`frontend/tests/parity/dashboard.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| DB-P01 | `/dashboard` | `frontend/tests/parity/dashboard.spec.ts` | paritas, lokal |
| DB-P02 | `/dashboard/wisman` | `frontend/tests/parity/dashboard.spec.ts` | paritas, lokal |
| DB-P03 | `/dashboard/wisnus` | `frontend/tests/parity/dashboard.spec.ts` | paritas, lokal |
| DB-P04 | `/dashboard/tenaga-kerja` | `frontend/tests/parity/dashboard.spec.ts` | paritas, lokal |
| DB-P05 | `/dashboard/pdrb-ekraf` | `frontend/tests/parity/dashboard.spec.ts` | paritas, lokal |
| IX-P02 | `/dashboard/wisman` — tahun 2024 lalu bulan Mei (DB-E02) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P03 | `/dashboard/wisnus` — filter kota tujuan (DB-E03) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P04 | `/dashboard/tenaga-kerja` — tahun subsektor 2022 (DB-E04) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P05 | `/dashboard/pdrb-ekraf` — modal Perbesar grafik (DB-E06) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P15 | `/dashboard/pdrb-ekraf` — sebaran subsektor 2022 (DB-E05) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P16 | `/dashboard/wisman` — bulan 2025-03: pintu masuk semesteran (DB-E02) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P34 | `/dashboard/wisman` — modal Perbesar grafik pertama (WismanStat) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P35 | `/dashboard/wisman` — modal Perbesar "Per kelas hotel" (LosByClass; wisnus memakai komponen sama) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P36 | `/dashboard/wisman` — modal Perbesar "per destinasi" (DestinasiStat; wisnus memakai komponen sama) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P37 | `/dashboard/wisnus` — modal Perbesar grafik pertama (WisnusStat) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P38 | `/dashboard/tenaga-kerja` — modal Perbesar grafik pertama | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |

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
| DS-E02 | `/katalog`: filter tier dan lapisan (Silver) | `frontend/tests/e2e/dataset.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| DS-E03 | `/sdi` → klik "Lihat data →" membuka detail S1 dengan hero, meta, dan tabel | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |
| DS-E04 | Detail: tambah chip filter (kebangsaan JEPANG) lalu hapus | `frontend/tests/e2e/dataset.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| DS-E05 | Detail: klik header kolom → ▲ → ▼ → ↕ | `frontend/tests/e2e/dataset.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| DS-E06 | Detail: gulir memuat 50 baris berikutnya | `frontend/tests/e2e/dataset.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| DS-E07 | Detail: unduh CSV terfilter → nama `…-terfilter.csv`, diawali BOM | `frontend/tests/e2e/dataset.spec.ts`<br>`frontend/tests/parity/ekspor.spec.ts` | belum dijalankan |
| DS-E08 | Detail: chart builder "+ Tambah grafik" → kartu chart dengan canvas, bertahan setelah reload | `frontend/tests/e2e/dataset.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| DS-E09 | `/sdi/tidak-ada` → "Dataset belum tersedia di lakehouse. Coba buka di portal SDI ↗." | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |
| BR-E01 | `/` merender hero dengan angka dari API dan tautan kartu | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |
| DC-E01 | `/docs` merender daftar endpoint dari OpenAPI; tanpa `sistem/*` | `frontend/tests/e2e/dataset.spec.ts` | belum dijalankan |

### Paritas (`frontend/tests/parity/dataset.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| DS-P01 | `/` — P4: angka hero beranda (hidup vs beku Next.js) | `frontend/tests/parity/dataset.spec.ts` | paritas, lokal |
| DS-P02 | `/katalog` | `frontend/tests/parity/dataset.spec.ts` | paritas, lokal |
| DS-P03 | `/sdi` | `frontend/tests/parity/dataset.spec.ts` | paritas, lokal |
| DS-P04 | `/sdi/{S1}`, `/sdi/{S2}`, `/sdi/{S3}` | `frontend/tests/parity/dataset.spec.ts`<br>`frontend/tests/parity/ekspor.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| DC-P01 | `/docs` — P3: isi endpoint (dihasilkan dari OpenAPI); hanya kerangka dibandingkan | `frontend/tests/parity/dataset.spec.ts` | paritas, lokal |
| IX-P01 | `/katalog` — cari dataset (DS-E01) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P10 | `/katalog` — tier Sekunder + lapisan Gold (DS-E02) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P11 | `/sdi/{S1}` — chip filter Kebangsaan JEPANG (DS-E04); baris produksi disuntikkan | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P12 | `/sdi/{S1}` — sort Jumlah Kunjungan ▲ (DS-E05); baris produksi disuntikkan | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P13 | `/sdi/{S1}` — gulir memuat 50 baris berikutnya (DS-E06); halaman 1 dan 2 produksi disuntikkan | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P14 | `/sdi/{S1}` — chart builder + Tambah grafik (DS-E08) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| EK-P14 | `/sdi/{S1}` — isi CSV terfilter Kebangsaan JEPANG (DS-E07); pengecualian "Urutan baris" (diterima pemilik 3 Nov 2026) | `frontend/tests/parity/bantu.ts`<br>`frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |

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
| GM-E02 | `/gmti`: ekspor XLSX pilar Program — nama `jakarta-atlas-gmti-program-…`, 12 kolom, 43 baris | `frontend/tests/e2e/gmti.spec.ts`<br>`frontend/tests/parity/ekspor.spec.ts` | belum dijalankan |
| GM-E03 | `/spatial`: toggle kepadatan, chip Hotel, reset, wilayah, cari satu tempat, popup | `frontend/tests/e2e/gmti.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |
| GM-E04 | `/spatial`: API gagal → "Titik lakehouse belum dapat dimuat." dan "Coba lagi" memuat ulang (satu-satunya rute browser yang dipalsukan) | `frontend/tests/e2e/gmti.spec.ts` | belum dijalankan |
| GM-E05 | `/scraped-hotels`: data Bronze tampil; membuka baris memperlihatkan tabel tipe kamar | `frontend/tests/e2e/gmti.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | belum dijalankan |

### Paritas (`frontend/tests/parity/gmti.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| GM-P01 | `/gmti` | `frontend/tests/parity/gmti.spec.ts` | paritas, lokal |
| GM-P02 | `/spatial` — panel saja; tile/pin/choropleth di-mask; tinggi dihitung ulang setelah dock AI dibuang | `frontend/tests/parity/gmti.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| GM-P03 | `/scraped-hotels` — respons produksi (kosong) disuntikkan ke portal; render atas data sama | `frontend/tests/parity/gmti.spec.ts` | paritas, lokal |
| IX-P08 | `/gmti` — pilar Makan & minum + wilayah Jakarta Selatan (GM-E01) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P25 | `/gmti` — Tampilkan 200 lagi (GM-E01) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P26 | `/gmti` — cari istiqlal (GM-E01) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P27 | `/gmti` — mode tabel (GM-E01) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P28 | `/spatial` — toggle Kepadatan kecamatan (GM-E03); peta di-mask | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P29 | `/spatial` — chip Hotel (GM-E03); peta di-mask | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P30 | `/spatial` — chip Hotel lalu Reset filter (GM-E03); peta di-mask | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P31 | `/spatial` — wilayah Jakarta Selatan (GM-E03); peta di-mask | `frontend/tests/parity/gmti.spec.ts`<br>`frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P32 | `/spatial` — cari Canary Coffee Shop + popup titik (GM-E03); popup ikut dibandingkan | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P42 | `/scraped-hotels` — buka baris hotel (GM-E05): dilewati, P5 (produksi kosong) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| EK-P08 | `/gmti` — isi ekspor XLSX pilar Semua (GM-E02) | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |
| EK-P09 | `/gmti` — isi ekspor XLSX pilar Ibadah (GM-E02) | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |
| EK-P10 | `/gmti` — isi ekspor XLSX pilar Makan & minum (GM-E02) | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |
| EK-P11 | `/gmti` — isi ekspor XLSX pilar Menginap (GM-E02) | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |
| EK-P12 | `/gmti` — isi ekspor XLSX pilar Destinasi & fasilitas (GM-E02) | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |
| EK-P13 | `/gmti` — isi ekspor XLSX pilar Program dan Event (GM-E02) | `frontend/tests/parity/ekspor.spec.ts` | paritas, lokal |

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
| IX-P09 | `/gci/pariwisata/seni-pertunjukan` — pilih tahun 2024 lewat combobox (IN-E06) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P33 | `/gci/pariwisata/seni-pertunjukan` — pilih venue di peta (IN-E06); desktop saja (peta 0 px di layar sempit, K-10) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P39 | `/gci/pariwisata/kuliner-michelin` — modal Perbesar grafik | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P40 | `/gci/pariwisata/seni-pertunjukan` — modal Perbesar grafik | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |
| IX-P41 | `/gci/pariwisata/wisatawan-internasional` — modal Perbesar grafik (IndikatorWismanDashboard) | `frontend/tests/parity/interaksi.spec.ts` | paritas, lokal |

## Fitur `sistem`

### Backend — Pest Feature (`backend/tests/Feature/Sistem`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| SI-B01 | `portal:sinkron` semua sukses: satu snapshot per rute kelas T × varian (28 kode indikator, tier katalog, tahun pertunjukan); endpoint P tidak dipanggil | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B02 | Sebagian gagal: snapshot lama tetap, JOB_RUNS `sebagian`, kegagalan dirinci per rute + varian | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B03 | HASH sama → isi tidak ditulis ulang (`berubah` 0), DIAMBIL_PADA diperbarui sehingga tidak tertandai basi | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B04 | Tidak tumpang tindih: jadwal 11:00 Asia/Jakarta `withoutOverlapping`; kunci dipegang → cron dilewati, pemicu manual 409 | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B05 | Snapshot lebih tua dari 36 jam → `meta.stale = true` | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B06 | Snapshot hilang dan Data API mati → 503 `UPSTREAM_UNAVAILABLE` | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B07 | `portal:bersihkan-log` menghapus tepat yang lebih tua dari 180 hari (LOG_HISTORY + JOB_RUNS) | `backend/tests/Feature/Sistem/AdminTest.php` | belum dijalankan |
| SI-B08 | `sistem/log`: filter modul dan tanggal (hari WIB), 50 per halaman terbaru dulu; `sistem/job` berhalaman | `backend/tests/Feature/Sistem/AdminTest.php` | belum dijalankan |
| SI-B09 | Rute admin menolak token `read` (403) dan tanpa token (401) | `backend/tests/Feature/Sistem/AdminTest.php` | belum dijalankan |
| SI-B10 | `POST sistem/job/sinkron` → 202, sinkron dijalankan sebagai proses CLI terlepas yang mewarisi kunci (`portal:sinkron --manual --klien=… --pemilik=…`); pemicu kedua 409; `PEMICU=manual` | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B11 | `POST sistem/cache/kosongkan` menghapus cache Data API, snapshot tetap | `backend/tests/Feature/Sistem/AdminTest.php` | belum dijalankan |
| SI-B12 | Rute admin tercatat di LOG_HISTORY modul `sistem`; `sistem/kesehatan` (healthcheck container) tidak | `backend/tests/Feature/Sistem/AdminTest.php` | belum dijalankan |
| SI-B13 | Snapshot basi dan Data API hidup → disegarkan saat dibaca (kunci berparameter bebas di luar varian sinkron) | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B14 | Jawaban Data API berperingatan (Q21, data dikosongkan) tidak menimpa snapshot: sinkron menghitungnya gagal; baca memakai snapshot lama ber-`stale` | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B16 | Proses sinkron gagal dimulai → 500 dan kunci dilepas | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B17 | Snapshot basi dan Data API mati → satu percobaan penyegaran, request berikutnya selama jeda langsung mendapat snapshot lama ber-`stale` | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |
| SI-B15 | Jawaban berperingatan tanpa snapshot diteruskan, tidak disimpan (T) dan tidak di-cache (P) | `backend/tests/Feature/Sistem/SinkronTest.php` | belum dijalankan |

### E2E — Playwright (`frontend/tests/e2e/sistem.spec.ts`, project `sistem`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| SI-E01 | Tabel di atas, satu tes per baris: sinkron manual (token admin), kosongkan cache, Data API dimatikan lewat sakelar pemutar fixture (`POST /__uji/mati`) | `frontend/tests/e2e/sistem.spec.ts` | belum dijalankan |

### Paritas redirect (`frontend/tests/parity/redirect.spec.ts`)

| ID | Skenario | Berkas tes | Status |
|---|---|---|---|
| RD-P01 | `/atlas` | `frontend/tests/parity/redirect.spec.ts` | paritas, lokal |
| RD-P02 | `/atlas/golf`, `/atlas/tidak-ada` (404) | `frontend/tests/parity/redirect.spec.ts` | paritas, lokal |
| RD-P03 | `/atlas/restaurants/map`, `/atlas/hotel/map` (404) | `frontend/tests/parity/redirect.spec.ts` | paritas, lokal |
| RD-P04 | `/gmti/map` | `frontend/tests/parity/redirect.spec.ts` | paritas, lokal |
| RD-P05 | `/katalog/hotel` | `frontend/tests/parity/redirect.spec.ts` | paritas, lokal |
| RD-P06 | `/readiness` | `frontend/tests/parity/redirect.spec.ts` | paritas, lokal |

