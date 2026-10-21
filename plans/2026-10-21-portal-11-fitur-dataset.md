# Plan 11 — Portal: fitur dataset + beranda + docs (pola acuan) (needs 10, 02)

Repo: `dispar-portal`. Branch `feat/fitur-dataset`.
Commit: `feat(dataset): katalog, detail dataset sdi, beranda, dan halaman docs`.

## Mengapa plan ini istimewa

Ini fitur pertama yang dikerjakan **utuh**: Data API → Laravel → Nuxt → tes → paritas.
Fitur 12–15 menyalin polanya. Karena itu pola yang dipakai di sini harus ditulis eksplisit di
`docs/pola-fitur.md`:

- daftar berkas per fitur dan urutan membuatnya;
- cara memalsukan Data API di tes;
- cara menulis skenario;
- cara menjalankan uji paritas per halaman.

Fitur berikutnya hanya boleh menyimpang dari pola dengan catatan di PR.

## Rute

`/`, `/katalog`, `/sdi`, `/sdi/[slug]`, `/docs` (KONTRAK §1). Komponen embed `SdiTable` dan
`RawDataDisclosure` sudah ada di `shared`; plan ini menyambungkannya ke API dataset.

## Backend

- `Features/Dataset`: semua rute KONTRAK §2.1 versi Laravel, termasuk gabungan
  `/dataset/{slug}/halaman` dan ekspor (stream passthrough, header `Content-Disposition` dan
  `X-Row-Count` diteruskan).
  - `f[]` diterjemahkan ke `f` berulang.
  - Kelas cache sesuai SPEC §4.6.
- `Features/Beranda`: `GET /api/v1/beranda/ringkasan`.
- Setiap rute punya atribut `modul` untuk log. Ekspor mencatat filter.

## Frontend

- Layer `dataset`:
  - `pages/katalog.vue` dan `pages/sdi/index.vue` memakai komponen `CatalogView`
    (`primaryOnly`);
  - `pages/sdi/[slug].vue` memuat hero, `DatasetFilters`, `DatasetCharts`, dan tabel dengan
    infinite scroll;
  - perilaku dan string persis inventaris E §1.1–1.3 (@ `6b858eb`, termasuk filter chips, sort
    kolom, field "Periode", ekspor terfilter, chart dari `/agregat`);
  - preferensi chart builder di `localStorage` dengan kunci yang sama.
- Layer `beranda`: `pages/index.vue` sesuai A §7.1, dengan angka dari API (P4).
- Layer `docs`: `pages/docs.vue` meniru tampilan A §7.4.
  - Isinya dihasilkan dari **`php artisan scramble:export`** (bukan draf) dengan skrip build
    `scripts/docs-dari-openapi.ts` → `layers/docs/data/endpoints.json`.
  - CI gagal bila `endpoints.json` tidak sama dengan hasil ekspor terbaru.
  - Base URL sesuai env.
  - Rute `sistem/*` tidak ditampilkan.
- Slug acuan untuk paritas detail ditetapkan di plan ini dan ditulis di `docs/skenario/dataset.md`.
  Ada tiga slug: satu primer bertier Silver dengan kolom tanggal, satu sekunder, dan satu dengan
  kolom angka besar. Plan 17 memakai slug yang sama.

## Skenario uji (tulis sebagai daftar ID di `docs/skenario/dataset.md`, lalu satu tes per ID)

**Backend (Pest Feature, Data API palsu):**

- skenario E §4.2 butir 1–6 dan 9 untuk lapisan Laravel: envelope, kode error diteruskan, log,
  cache hit/miss;
- `f[]` terjemah;
- ekspor stream dan log ekspor;
- Data API 503 → 503 envelope.

**Frontend (Vitest):**

- composable `useDataset`: paging infinite, debounce cari 350 ms, serialisasi filter ke URL dan
  kembali.

**E2E (Playwright, melawan Data API lokal plan 02):**

- cari katalog;
- filter lapisan;
- buka detail;
- tambah dan hapus filter chip;
- sort kolom;
- scroll memuat halaman berikutnya;
- ekspor CSV terfilter (cek nama berkas dan BOM);
- buat chart dari chart builder;
- 404 slug tak dikenal.

## Paritas (cara yang dipakai semua fitur)

`tests/parity/dataset.spec.ts` membandingkan `/`, `/katalog`, `/sdi`, dan 3 slug detail dengan
`dispar.rantai.dev` sesuai SPEC §7: visual ≤ 2%, himpunan angka identik, interaksi sama.
Pengecualian P3 (isi `/docs`) dan P4 (angka beranda) memakai mask yang tertulis di spec tes.
Laporan HTML dilampirkan di PR.

## Gate lokal

```bash
cd backend && vendor/bin/pint --test && vendor/bin/pest
cd frontend && npm run lint && npx vue-tsc --noEmit && npx vitest run && npx playwright test tests/e2e/dataset.spec.ts tests/parity/dataset.spec.ts
```

## Kriteria selesai

1. Semua skenario di `docs/skenario/dataset.md` punya tes yang lulus.
2. Paritas lulus untuk semua rute plan ini.
3. `docs/pola-fitur.md` ada dan sudah dipakai reviewer sebagai checklist.
