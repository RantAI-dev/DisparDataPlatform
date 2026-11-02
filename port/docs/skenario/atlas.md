# Skenario fitur atlas (plan 14)

Satu tes per ID. Nama tes diawali ID-nya. Pola penulisan: `docs/pola-fitur.md`.

## Backend — Pest Feature (`backend/tests/Feature/Atlas`)

| ID | Skenario |
|---|---|
| AT-B01 | Enam endpoint KONTRAK §2.4 (+ pertunjukan `tahun=2025`) diteruskan dengan `data` byte-identik |
| AT-B02 | Kelas T: request kedua dari snapshot; pertunjukan per tahun punya snapshot sendiri |
| AT-B03 | `tahun` bukan `YYYY` → 422 tanpa memanggil Data API |
| AT-B04 | Data API mati tanpa snapshot → 503 `UPSTREAM_UNAVAILABLE`, satu percobaan |
| AT-B05 | LOG_HISTORY modul `atlas`, aksi = nama rute |
| AT-B06 | Tanpa token → 401 |

## E2E — Playwright (`frontend/tests/e2e/atlas.spec.ts`)

| ID | Skenario |
|---|---|
| AT-E01 | Restoran GCI: filter tier, paging "Muat N lagi", cari kosong → "Tidak ada entri…" |
| AT-E02 | Restoran GCI: ekspor CSV/XLSX — nama `data-restoran-GCI-…`, 13 kolom, baris = hanya ber-rating |
| AT-E03 | Direktori: tombol EN, bahasa + mode daftar bertahan setelah reload, cari, ekspor XLS; tanpa tombol Verifikasi (P2) |
| AT-E04 | Golf: kicker `LAPANGAN GOLF` (P1), 14 pin, filter Driving Range, pilih kartu, ekspor CSV |
| AT-E05 | Suvenir: relevansi bawaan 35/67, "Semua", mode tabel, ekspor XLSX |
| AT-E06 | Hotel dan pertunjukan merender data |

## Paritas (`frontend/tests/parity/atlas.spec.ts`)

| ID | Halaman | Mask / pengecualian |
|---|---|---|
| AT-P01 | `/gci/pariwisata/restoran-gci` | — |
| AT-P02 | `/gci/pariwisata/direktori-restoran` | P2: bilah verifikasi + kolom footer; layar pertama |
| AT-P03 | `/gpci/lapangan-golf` | P1: kicker; tile peta |
| AT-P04 | `/gpci/toko-suvenir` | iframe Maps |
| AT-P05 | `/gpci/hotel` | — |
| AT-P06 | `/gci/pariwisata/pertunjukan-budaya` | tile peta, iframe |
