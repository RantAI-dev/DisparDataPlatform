# Skenario fitur sistem: sinkron, snapshot, log admin (plan 16)

Satu tes per ID. Nama tes diawali ID-nya. Pola penulisan: `docs/pola-fitur.md`.

## Backend — Pest Feature (`backend/tests/Feature/Sistem`)

| ID | Skenario |
|---|---|
| SI-B01 | `portal:sinkron` semua sukses: satu snapshot per rute kelas T × varian (28 kode indikator, tier katalog, tahun pertunjukan); endpoint P tidak dipanggil |
| SI-B02 | Sebagian gagal: snapshot lama tetap, JOB_RUNS `sebagian`, kegagalan dirinci per rute + varian |
| SI-B03 | HASH sama → isi tidak ditulis ulang (`berubah` 0), DIAMBIL_PADA diperbarui sehingga tidak tertandai basi |
| SI-B04 | Tidak tumpang tindih: jadwal 11:00 Asia/Jakarta `withoutOverlapping`; kunci dipegang → cron dilewati, pemicu manual 409 |
| SI-B05 | Snapshot lebih tua dari 36 jam → `meta.stale = true` |
| SI-B06 | Snapshot hilang dan Data API mati → 503 `UPSTREAM_UNAVAILABLE` |
| SI-B07 | `portal:bersihkan-log` menghapus tepat yang lebih tua dari 180 hari (LOG_HISTORY + JOB_RUNS) |
| SI-B08 | `sistem/log`: filter modul dan tanggal (hari WIB), 50 per halaman terbaru dulu; `sistem/job` berhalaman |
| SI-B09 | Rute admin menolak token `read` (403) dan tanpa token (401) |
| SI-B10 | `POST sistem/job/sinkron` → 202, sinkron dijalankan sebagai proses CLI terlepas yang mewarisi kunci (`portal:sinkron --manual --klien=… --pemilik=…`); pemicu kedua 409; `PEMICU=manual` |
| SI-B11 | `POST sistem/cache/kosongkan` menghapus cache Data API, snapshot tetap |
| SI-B12 | Rute admin tercatat di LOG_HISTORY modul `sistem`; `sistem/kesehatan` (healthcheck container) tidak |
| SI-B13 | Snapshot basi dan Data API hidup → disegarkan saat dibaca (kunci berparameter bebas di luar varian sinkron) |
| SI-B14 | Jawaban Data API berperingatan (Q21, data dikosongkan) tidak menimpa snapshot: sinkron menghitungnya gagal; baca memakai snapshot lama ber-`stale` |
| SI-B16 | Proses sinkron gagal dimulai → 500 dan kunci dilepas |
| SI-B17 | Snapshot basi dan Data API mati → satu percobaan penyegaran, request berikutnya selama jeda langsung mendapat snapshot lama ber-`stale` |
| SI-B15 | Jawaban berperingatan tanpa snapshot diteruskan, tidak disimpan (T) dan tidak di-cache (P) |

## Perilaku halaman saat Data API mati

Keadaan: `portal:sinkron` sudah berjalan, cache dikosongkan, lalu Data API tidak bisa dihubungi.
Endpoint kelas T dilayani snapshot; endpoint kelas P menjawab 503 dan bagian halamannya menampilkan
keadaan gagal yang sama dengan Next.js. Dibuktikan `frontend/tests/e2e/sistem.spec.ts` (SI-E01).

| Rute | Perilaku | Bagian yang gagal (teks yang tampil) |
|---|---|---|
| `/` | utuh | — |
| `/katalog` | utuh | — |
| `/sdi` | utuh | — |
| `/sdi/[slug]` | tidak tersedia | seluruh isi: "Sumber data sedang tidak tersedia. Coba buka di portal SDI ↗." |
| `/docs` | utuh | (statis, tidak memanggil Data API) |
| `/dashboard` | utuh | — |
| `/dashboard/wisman` | sebagian | donut kebangsaan, pintu masuk, per destinasi: "Tidak ada data."; per kelas hotel: "Data lama menginap belum tersedia." |
| `/dashboard/wisnus` | sebagian | grafik per kota/tahunan/bulanan/YoY dan destinasi: "Tidak ada data."; per kelas hotel: "Data lama menginap belum tersedia." |
| `/dashboard/tenaga-kerja` | sebagian | subsektor nasional: "Tidak ada data." |
| `/dashboard/pdrb-ekraf` | sebagian | sebaran dan pertumbuhan subsektor: "Tidak ada data." |
| `/gci`, `/gpci` | utuh | — |
| `/gci/[code]`, `/gpci/[code]` | utuh | — |
| `/gci/pariwisata/wisatawan-internasional` | sebagian | tiga tabel dataset SDI di bawah ringkasan: "Sumber data sedang tidak tersedia. Coba buka di portal SDI ↗." |
| `/gci/pariwisata/kuliner-michelin` | sebagian | tiga tabel dataset SDI di bawah ringkasan: "Sumber data sedang tidak tersedia. Coba buka di portal SDI ↗." |
| `/gci/pariwisata/seni-pertunjukan` | tidak tersedia | seluruh isi kosong di bawah navigasi (halaman merender isinya hanya bila data ada) |
| `/gci/pariwisata/restoran-gci` | utuh | — |
| `/gci/pariwisata/direktori-restoran` | utuh | — |
| `/gci/pariwisata/pertunjukan-budaya` | utuh | — |
| `/gpci/hotel`, `/gpci/lapangan-golf`, `/gpci/toko-suvenir` | utuh | — |
| `/gmti` | sebagian | daftar tempat: "Gagal memuat daftar fasilitas ibadah (ApiError: Sumber data sedang tidak tersedia.). Muat ulang halaman untuk mencoba lagi." |
| `/spatial` | sebagian | peta dan panel utuh; detail titik (`spasial/titik/{id}`, P) gagal 503: popup tetap terbuka dengan data ringkas tanpa pesan, sertifikat tidak menyusul |
| `/scraped-hotels` | utuh | — |

## E2E — Playwright (`frontend/tests/e2e/sistem.spec.ts`, project `sistem`)

| ID | Skenario |
|---|---|
| SI-E01 | Tabel di atas, satu tes per baris: sinkron manual (token admin), kosongkan cache, Data API dimatikan lewat sakelar pemutar fixture (`POST /__uji/mati`) |

Project `sistem` berjalan sesudah project lain (`dependencies`), karena mematikan Data API bersama.
