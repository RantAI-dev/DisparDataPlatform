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

### Paritas interaksi dan ekspor (`frontend/tests/parity/{interaksi,ekspor}.spec.ts`)

| ID | Halaman | Langkah |
|---|---|---|
| IX-P08 | `/gmti` | pilar Makan & minum + wilayah Jakarta Selatan (GM-E01) |
| IX-P25 | `/gmti` | Tampilkan 200 lagi (GM-E01) |
| IX-P26 | `/gmti` | cari istiqlal (GM-E01) |
| IX-P27 | `/gmti` | mode tabel (GM-E01) |
| IX-P28 | `/spatial` | toggle Kepadatan kecamatan (GM-E03); peta di-mask |
| IX-P29 | `/spatial` | chip Hotel (GM-E03); peta di-mask |
| IX-P30 | `/spatial` | chip Hotel lalu Reset filter (GM-E03); peta di-mask |
| IX-P31 | `/spatial` | wilayah Jakarta Selatan (GM-E03); peta di-mask |
| IX-P32 | `/spatial` | cari Canary Coffee Shop + popup titik (GM-E03); popup ikut dibandingkan |
| IX-P42 | `/scraped-hotels` | buka baris hotel (GM-E05): dilewati, P5 (produksi kosong) |
| EK-P08 | `/gmti` | isi ekspor XLSX pilar Semua (GM-E02) |
| EK-P09 | `/gmti` | isi ekspor XLSX pilar Ibadah (GM-E02) |
| EK-P10 | `/gmti` | isi ekspor XLSX pilar Makan & minum (GM-E02) |
| EK-P11 | `/gmti` | isi ekspor XLSX pilar Menginap (GM-E02) |
| EK-P12 | `/gmti` | isi ekspor XLSX pilar Destinasi & fasilitas (GM-E02) |
| EK-P13 | `/gmti` | isi ekspor XLSX pilar Program dan Event (GM-E02) |
