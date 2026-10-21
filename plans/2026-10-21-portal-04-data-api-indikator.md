# Plan 04 — Data API: indikator GCI/GPCI + halaman pariwisata (needs 02)

Repo: ini. Branch `feat/data-api-indikator`.
Commit: `feat(data-api): endpoint indikator gci gpci dan halaman pariwisata`.

## Hasil akhir

`data_api/features/indikator/` mengimplementasikan KONTRAK §2.3. Data API mengembalikan, untuk
setiap halaman indikator dan pariwisata, KPI, blok grafik, dan tabel yang identik dengan yang
dirender Next.js `6b858eb`.

## Sumber logika yang diporting (inventaris C)

| Logika | Lokasi asal |
|---|---|
| Model indikator | `platform-v2/data/gci-gpci-indicators.json` (bukan salinan root yang basi), benchmark, `GciOfficial`, C §1 |
| Pemilihan dataset | `lib/indicator-data.ts` (`datasetsFor`, `pickData`, `primaryData`), port apa adanya (KONTRAK K-12) |
| Readiness | `lib/gci/readiness.ts` (`computeReadiness`, `latestValue`, `trendSeries`), C §1.3 |
| Agregasi | `lib/agg.ts` (`groupSum`, `groupCount`, `byPeriod`, `topN`, `total`, `idNum`) |
| Tujuh arketipe | C §2.4 (A peta titik, B tren-lokasi, C wilayah, D registri, E event, F okupansi, G survei), termasuk swap lat/lng (benar secara data), top-15, dan Σ rata-rata |
| Halaman pariwisata | C §3.1–3.3, termasuk headline dan target yang ditulis tangan (C §4.4) |

## Aturan

- **Defect D1–D10 ditiru.** Tes menuliskannya secara eksplisit. Contoh: tes "CE3 memilih
  `data-pemberian-rekomendasi-penyelenggaraan-pertunjukan-musik` selama katalog hari ini", dan
  tes "CI-SH rata-rata keseluruhan = Σ rata-rata".
- `meta.dataset_terpilih` berisi slug per peran (utama, kedua, readiness top-5).
- **Sumber daftar indikator:** `shared/indikator_sumber.py` (plan 02).
  - Produksi membaca `bronze_file.gci_gpci_indicators`. Salinan itu baru benar setelah plan 06
    bagian A, karena plan 01 sudah memperbarui berkas root-nya.
  - Panggung plan ini memakai `INDIKATOR_BERKAS` yang menunjuk berkas `platform-v2`.
  - Tes unit membuktikan kedua sumber menghasilkan struktur yang sama untuk fixture yang sama.
  - **Jangan** membundel JSON ke image Data API.
- Angka yang ditulis tangan di komponen (Kearney 52→58/74→71, 2.767.622, skor 156, Michelin 0)
  diambil dari `bronze_file.gci_kearney_resmi` bila ada di sana. Bila tidak ada, ia menjadi
  konstanta tampilan di frontend dan dicatat di `x-catatan`.
- Endpoint `GET /v1/indikator/{code}` menerima kode dengan prefiks silang seperti sekarang (C §2.1).

## Test

- **Unit:**
  - per arketipe dengan fixture buatan;
  - `pickData` dengan katalog palsu, mencakup kasus seri dan kasus kolom wajib hilang;
  - `computeReadiness` untuk ketiga status;
  - `latestValue` yang menghasilkan sampah (D9), ditiru.
- **Contract:** semua endpoint.
- **Panggung:**
  - 28 indikator, ditambah 3 halaman pariwisata, dibandingkan dengan golden live, termasuk status
    readiness (GCI 3/2/3, GPCI 5/9/6 per C §0.2, atau nilai hari itu).
  - Slug terpilih per indikator dibandingkan dengan tabel C §4.2. Setiap beda ditulis di PR.

## Gate lokal

```bash
cd lakehouse/data-api && uv run --extra dev ruff check . && uv run --extra dev pytest -q
uv run --extra dev pytest -q -m panggung -k indikator
```

## Kriteria selesai

1. 28 + 3 + `gci/resmi` + `dataset-tematik` lulus kontrak dan panggung.
2. PR berisi tabel `code → slug terpilih → status → nilai terbaru`, hasil Data API hari itu,
   berdampingan dengan hasil Next.js.

## STOP

- Komponen indikator tidak bisa dirender oleh skrip golden (plan 01 STOP pertama).
- Sebuah arketipe membutuhkan baris Silver lebih dari 100.000 untuk satu indikator tanpa
  agregasi SQL. Dalam kasus itu pindahkan agregasinya ke SQL dengan hasil yang identik; bila
  tidak bisa identik, STOP.
