# Skenario fitur dataset + beranda + docs (plan 11)

Satu tes per ID. Nama tes diawali ID-nya, jadi `grep -r "DS-B04"` menemukan tesnya. Pola penulisan:
`docs/pola-fitur.md`.

## Slug acuan

Dipakai e2e, uji paritas, dan plan 17. Ditetapkan 30 Okt 2026 dari katalog yang hidup.

| Kode | Slug | Mengapa |
|---|---|---|
| S1 | `data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan` | primer, Silver, kolom tanggal (`periode_data`), 1.000+ baris (scroll) |
| S2 | `penerbangan-langsung-internasional-jakarta` | sekunder (`/sdi/…` dari katalog sekunder), banyak kolom teks |
| S3 | `data-pendapatan-asli-daerah-pad-sektor-pariwisata` | angka besar (ratusan miliar rupiah, format id-ID) |

## Backend — Pest Feature (`backend/tests/Feature/{Dataset,Beranda}`)

Data API dipalsukan dengan rekaman `fixtures/data-api` (`dataApiDariFixture()`).

| ID | Skenario |
|---|---|
| DS-B01 | Katalog (`tier=semua`, `tier=primer`) diteruskan: `data` byte-identik, `meta.source` ikut |
| DS-B02 | Katalog kelas T: request kedua dari snapshot, Data API dipanggil sekali |
| DS-B03 | Detail diteruskan; slug tak dikenal → 404 envelope `NOT_FOUND` |
| DS-B04 | Baris meneruskan `page`, `size`, `q`, `sort`; `f[]` → `f=` berulang |
| DS-B05 | Baris kelas P: request kedua dari cache (`meta.sumber = cache`), isi sama |
| DS-B06 | Filter tak valid: 400 `INVALID_FILTER` Data API diteruskan dan tidak di-cache |
| DS-B07 | Parameter di luar kontrak (size > 200, sort tanpa arah, agg/format tak dikenal, agregat tanpa x) → 422 tanpa memanggil Data API |
| DS-B08 | `halaman` = `{dataset, kolom, baris}` dari tiga panggilan; `meta.total` = baris Silver; slug tak dikenal → 404 tanpa memanggil kolom/baris |
| DS-B09 | Facet dan agregat diteruskan; agregat membawa filter |
| DS-B10 | Ekspor dialirkan byte-identik (BOM, CRLF), header `Content-Disposition` `-terfilter`, `X-Row-Count`, `X-Accel-Buffering: no`; LOG_HISTORY mencatat filter dan jumlah baris |
| DS-B11 | Ekspor di atas batas → 413 `TOO_LARGE` dalam envelope |
| DS-B12 | Data API mati → 503 `UPSTREAM_UNAVAILABLE` (katalog tanpa snapshot, baris, halaman) |
| DS-B13 | Tiap request tercatat: modul `dataset`, aksi = nama rute, `request_id` = `meta.request_id`, jumlah baris, sumber |
| DS-B14 | Tanpa token → 401 |
| BR-B01 | Ringkasan beranda diteruskan, request kedua dari snapshot |

## Frontend — Vitest (`frontend/tests/{unit,nuxt}`)

| ID | Skenario |
|---|---|
| DS-F01 | `useDataset`: muat awal lewat `halaman`, halaman berikut lewat `baris` dengan `page = baris_dimuat / 50 + 1` |
| DS-F02 | `useDataset`: pencarian di-debounce 350 ms dan di-trim; ketikan beruntun hanya memicu satu request |
| DS-F03 | Serialisasi filter: `rowQueryParams` ↔ `parseRowQuery` bolak-balik (in berulang, range terbuka, sort, q) dan bentuk `f[]` untuk Laravel |
| DS-F04 | `useDataset`: jawaban usang (filter lama) dibuang |
| DS-F05 | `useDataset`: 404 → "Dataset belum tersedia di lakehouse", gagal jaringan → "Gagal memuat data" |
| DS-F06 | Chart builder: `isNumericCol`, `pickDefaultDim`, dan sanitasi preferensi `localStorage["dispar:dataset-charts:{slug}"]` sama dengan v2 |
| DS-F07 | `fmtPeriode`, `renderCell`/`fmtCell`, label chip filter (`Kebangsaan: 5 nilai`, rentang `…`) |
| DS-F08 | `/docs`: `endpoints.json` = hasil `scripts/docs-dari-openapi.ts` atas ekspor Scramble terbaru; rute `sistem/*` tidak ada |

## E2E — Playwright (`frontend/tests/e2e/dataset.spec.ts`)

Nuxt hasil build + Laravel + fixture-server (rekaman `fixtures/data-api`).

| ID | Skenario |
|---|---|
| DS-E01 | `/katalog`: cari mengurangi baris; kosong → "Tidak ada dataset yang cocok." |
| DS-E02 | `/katalog`: filter tier dan lapisan (Silver) |
| DS-E03 | `/sdi` → klik "Lihat data →" membuka detail S1 dengan hero, meta, dan tabel |
| DS-E04 | Detail: tambah chip filter (kebangsaan JEPANG) lalu hapus |
| DS-E05 | Detail: klik header kolom → ▲ → ▼ → ↕ |
| DS-E06 | Detail: gulir memuat 50 baris berikutnya |
| DS-E07 | Detail: unduh CSV terfilter → nama `…-terfilter.csv`, diawali BOM |
| DS-E08 | Detail: chart builder "+ Tambah grafik" → kartu chart dengan canvas, bertahan setelah reload |
| DS-E09 | `/sdi/tidak-ada` → "Dataset belum tersedia di lakehouse. Coba buka di portal SDI ↗." |
| BR-E01 | `/` merender hero dengan angka dari API dan tautan kartu |
| DC-E01 | `/docs` merender daftar endpoint dari OpenAPI; tanpa `sistem/*` |

## Paritas (`frontend/tests/parity/dataset.spec.ts`)

Melawan `dispar.rantai.dev`, SPEC §7. Portal memakai Laravel + Data API lokal (data hidup).

| ID | Halaman | Mask / pengecualian |
|---|---|---|
| DS-P01 | `/` | P4: angka hero beranda (hidup vs beku Next.js) |
| DS-P02 | `/katalog` | — |
| DS-P03 | `/sdi` | — |
| DS-P04 | `/sdi/{S1}`, `/sdi/{S2}`, `/sdi/{S3}` | — |
| DC-P01 | `/docs` | P3: isi endpoint (dihasilkan dari OpenAPI); hanya kerangka dibandingkan |
