# Plan 01 — Kontrak OpenAPI Data API + draf API Laravel + skrip golden

Repo: ini. Branch `feat/portal-kontrak`.
Commit: `docs(data-api): kontrak openapi v1 dan skrip golden paritas`.

## Masalah

Dua tim, executor Data API dan executor portal, akan bekerja paralel. Mereka butuh satu
kontrak yang presisi. Mereka juga butuh "oracle" yang membuktikan angka Data API sama dengan
yang tayang di Next.js. Saat ini keduanya baru ada sebagai usulan di inventaris.

## Hasil akhir

1. **`lakehouse/data-api/pyproject.toml` minimal.** Hanya extra `dev` (pytest,
   openapi-spec-validator, pyyaml) supaya gate plan ini bisa jalan. Plan 02 melengkapinya.
2. **`lakehouse/data-api/openapi.yaml`** (OpenAPI 3.1).
   - Cakupan: semua endpoint di KONTRAK §2.1–2.6, ditambah `/v1/health` dan
     `/v1/admin/cache/flush`.
   - Lengkap dengan parameter, skema `data` dan `meta`, skema error, serta `example` nyata.
   - Tidak ada operasi PATCH.
3. **`lakehouse/data-api/docs/laravel-openapi.draft.yaml`.**
   - Isi: path publik `/api/v1/*` dengan envelope Laravel (SPEC §4.4), rute gabungan
     `/dataset/{slug}/halaman`, rute `sistem/*`, skema keamanan Bearer.
   - Plan 10 menyalinnya ke repo portal `docs/api/`. Versi final dihasilkan scramble.
4. **`scripts/portal_golden.tsx`** + `scripts/tsconfig.portal-golden.json`.
   - Mekanisme sesuai **SPEC §3.6 lapis 1**: panggil fungsi `lib/*`, render komponen client
     asli dengan `react-dom/server`, dan stub `echarts-for-react` serta peta yang merekam prop
     `option`.
   - Jalankan dari `platform-v2/`:
     ```bash
     ./node_modules/.bin/tsx --tsconfig ../scripts/tsconfig.portal-golden.json \
       --env-file=.env.local ../scripts/portal_golden.tsx [--live] [--check]
     ```
     `CH_URL` ditimpa ke `http://192.168.18.148:18123` di dalam skrip bila env berisi `.187`.
   - Mode bawaan menulis **golden statis**: semua endpoint KONTRAK §2.4, `gmti/*`,
     `pdrb-ekraf/*`, `gci/resmi`, porsi statis `spasial`, dan `beranda` bagian statis. Hasilnya
     ke `lakehouse/data-api/tests/golden/*.json` (di-commit).
   - `--live` menulis **golden live** untuk endpoint bersumber Silver/serving ke
     `tests/golden/live/` (gitignore).
   - `--check` keluar ≠ 0 bila golden statis ter-commit berbeda dari hasil hitung ulang.
5. **Salinan daftar indikator diperbarui.**
   - `platform-v2/data/gci-gpci-indicators.json` (yang dipakai app) disalin ke
     `data/gci-gpci-indicators.json` (root, sumber Bronze yang basi; `cmp` berbeda di byte 1686).
   - Tunjukkan `git diff --stat` dan ringkasan field yang berubah.
   - Pastikan entri registri `lakehouse/sources.toml` untuk berkas itu ada dan kelasnya
     `saat_berubah`.
   - Berkas ini baru masuk Bronze setelah image Dagster dibangun ulang (plan 06 bagian A). Itu
     tidak dikerjakan di sini.

## Aturan

- Logika komponen **tidak boleh ditulis ulang** di skrip golden. Ia diperoleh dengan merender
  komponen asli dan membaca opsi yang terekam. Fungsi pemeta per endpoint hanya memindah nilai
  dari opsi/markup ke bentuk respons; di kode, setiap pemeta diberi komentar bahwa ia tidak
  menghitung.
- `platform-v2/` **tidak boleh diubah**: `git diff --stat -- platform-v2` harus kosong.
- Contoh di OpenAPI diambil dari golden (statis) atau hasil query .148, bukan karangan.
- Ikuti aturan penyeragaman KONTRAK §3. Setiap penyimpangan dari usulan inventaris, dan setiap
  keputusan warna per endpoint, dicatat sebagai `x-catatan`.
- Kode error dan status persis SPEC §3.3.
- Batas parameter: `size` maksimum 200 untuk baris dan 500 untuk katalog; `top` maksimum 50.

## Test

- `lakehouse/data-api/tests/test_openapi.py`:
  - spesifikasi valid;
  - tidak ada `patch`;
  - semua operasi punya `operationId`, `example`, dan respons 4xx/5xx yang merujuk skema error;
  - **semua path di daftar KONTRAK §2 ada**, termasuk `/v1/spasial/titik/{id}`. Daftar path
    ditulis eksplisit di tes.
- `--check` golden lulus. Skrip golden dijalankan dua kali dan hasilnya identik byte-per-byte.
- Tipe skrip golden diperiksa:
  `cd platform-v2 && npx tsc --noEmit -p ../scripts/tsconfig.portal-golden.json`.

## Gate lokal

```bash
cd lakehouse/data-api && uv run --extra dev pytest -q tests/test_openapi.py
cd platform-v2 && npx tsc --noEmit -p ../scripts/tsconfig.portal-golden.json
./node_modules/.bin/tsx --tsconfig ../scripts/tsconfig.portal-golden.json --env-file=.env.local ../scripts/portal_golden.tsx --check
git diff --stat -- platform-v2   # harus kosong
```

## Kriteria selesai

1. Setiap baris KONTRAK §2 punya operasi OpenAPI dan, bila statis, berkas golden.
2. Laporan PR mencantumkan jumlah record nyata per golden statis. Contoh: GCI venue 2.577,
   direktori 604, event 308, golf 14, suvenir 67, hotel 120/145/310, GMTI 8.331. Selisih dari
   angka inventaris D wajib dijelaskan.
3. Satu kali `--live` dijalankan terhadap .148. Daftar berkas dan ukurannya ditempel di PR
   (isinya tidak).

## STOP

- Sebuah komponen tidak bisa dirender di luar Next.js. Contoh: ia bergantung pada
  `next/navigation`, dan stub-nya tidak cukup. Laporkan komponen dan sebabnya. **Jangan**
  menulis ulang logikanya sebagai jalan pintas.
- Golden statis berbeda lebih dari 1% dari hitungan di inventaris D.

## Bukan cakupan

Implementasi Data API (02–05). Repo portal. Meng-ingest berkas indikator (plan 06).
