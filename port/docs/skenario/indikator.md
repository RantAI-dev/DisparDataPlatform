# Skenario fitur indikator (plan 13)

Satu tes per ID, nama tes diawali ID-nya. Pola: `docs/pola-fitur.md`. Sumber tampilan: v2 tayang
(`464fc15`): `app/gci/**`, `app/gpci/**`, `components/{FrameworkView,GciOfficial,FrameworkDataLinks}.tsx`,
`components/indicators/*`, `components/pariwisata/{WismanDashboard,TahunFilter,VenueMap}.tsx`.

## Backend — Pest Feature (`backend/tests/Feature/Indikator`)

| ID | Skenario |
|---|---|
| IN-B01 | Endpoint KONTRAK §2.3 diteruskan byte-identik (daftar, detail berdata dan gap, kode huruf kecil, gci/resmi, dataset-tematik, 3 pariwisata) |
| IN-B02 | Detail kelas T dari snapshot; seni-pertunjukan kelas P dari cache, termasuk respons > 32 KB (ORA-01461) |
| IN-B03 | Kode tak dikenal → 404 |
| IN-B04 | `framework` wajib dan GCI/GPCI; `tahun` `YYYY` → 422 tanpa memanggil Data API |
| IN-B05 | Satu percobaan, timeout `dataapi.timeout_lambat` (60 s); Data API mati → 503 |
| IN-B06 | LOG_HISTORY modul `indikator` |
| IN-B07 | Tanpa token → 401 |

Data API (`lakehouse/data-api/tests/unit/indikator`): detail membawa `indikator` dan `konteks`.

## Frontend — Vitest (`frontend/tests/unit/indikator.spec.ts`)

| ID | Skenario |
|---|---|
| IN-F01 | Blok setengah lebar berurutan digabung; batang setengah hijau lalu kuning |
| IN-F02 | Sel peringkat artis "Nama ✓ · Negara" diurai |
| IN-F03 | `bulanLabel` |

## E2E — Playwright (`frontend/tests/e2e/indikator.spec.ts`)

| ID | Skenario |
|---|---|
| IN-E01 | `/gci` peringkat resmi + kartu + dataset; pindah ke `/gpci` |
| IN-E02 | Tabel kesiapan → detail → tautan kembali |
| IN-E03 | 28 indikator 200 tanpa error halaman; 9 gap "Data belum tersedia"; kode tak dikenal 404 |
| IN-E04 | Prefiks silang `/gpci/CE1`, `/gci/CI-FV` (C §2.1) |
| IN-E05 | Peta arketipe A (CI-MU) |
| IN-E06 | Seni pertunjukan: pilih tahun (`?tahun=`), pilih venue di peta → panel kanan berganti (desktop; di mobile peta v2 setinggi 0 px, ditiru) |

## Paritas (`frontend/tests/parity/indikator.spec.ts`)

| ID | Halaman | Catatan |
|---|---|---|
| IN-P01 | `/gci` | kolom "Nilai terbaru" tidak dibandingkan angkanya (defect D, urutan baris tak deterministik) |
| IN-P02 | `/gpci` | idem; mobile dibandingkan layar pertama |
| IN-P03 | 28 × `/gci|gpci/[code]` | peta di-mask |
| IN-P04 | `/gci/pariwisata/wisatawan-internasional` | |
| IN-P05 | `/gci/pariwisata/kuliner-michelin` | |
| IN-P06 | `/gci/pariwisata/seni-pertunjukan` | peta + iframe di-mask |
| IN-P07 | `/gci/pariwisata/seni-pertunjukan?tahun=2025` | idem |
