# Skenario fitur gmti, spasial, hotel-scraped (plan 15)

Satu tes per ID. Nama tes diawali ID-nya. Pola penulisan: `docs/pola-fitur.md`.

## Backend — Pest Feature (`backend/tests/Feature/Gmti`)

| ID | Skenario |
|---|---|
| GM-B01 | Lima endpoint KONTRAK §2.5 diteruskan dengan `data` byte-identik |
| GM-B02 | Kelas baca: ringkasan dan spasial dari snapshot (T); tempat dan titik dari cache (P) |
| GM-B03 | Parameter di luar kontrak (size > 200, pilar tak dikenal, page 0, limit > 500) → 422 tanpa memanggil Data API |
| GM-B04 | Titik tak dikenal → 404 `NOT_FOUND` diteruskan |
| GM-B05 | Data API mati tanpa snapshot → 503, satu percobaan |
| GM-B06 | LOG_HISTORY modul `gmti`, `spasial`, `hotel-scraped` |
| GM-B07 | Tanpa token → 401 |

## E2E — Playwright (`frontend/tests/e2e/gmti.spec.ts`)

| ID | Skenario |
|---|---|
| GM-E01 | `/gmti`: 8.666 tempat, "Tampilkan 200 lagi" memuat halaman server berikut, pilar Makan (174 + deskripsi), wilayah, cari, mode tabel |
| GM-E02 | `/gmti`: ekspor XLSX pilar Program — nama `jakarta-atlas-gmti-program-…`, 12 kolom, 43 baris |
| GM-E03 | `/spatial`: toggle kepadatan, chip Hotel, reset, wilayah, cari satu tempat, popup |
| GM-E04 | `/spatial`: API gagal → "Titik lakehouse belum dapat dimuat." dan "Coba lagi" memuat ulang (satu-satunya rute browser yang dipalsukan) |
| GM-E05 | `/scraped-hotels`: data Bronze tampil; membuka baris memperlihatkan tabel tipe kamar |

## Paritas (`frontend/tests/parity/gmti.spec.ts`)

| ID | Halaman | Mask / pengecualian |
|---|---|---|
| GM-P01 | `/gmti` | — |
| GM-P02 | `/spatial` | panel saja; tile/pin/choropleth di-mask; tinggi dihitung ulang setelah dock AI dibuang |
| GM-P03 | `/scraped-hotels` | respons produksi (kosong) disuntikkan ke portal; render atas data sama |
