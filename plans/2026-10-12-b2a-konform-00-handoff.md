# Batch 2a: kerangka konform, tiga dimensi, fakta perintis

Batch kedua dari peta jalan (`plans/2026-10-08-lakehouse-00-peta-jalan.md`), dipecah dua:

- **2a (berkas ini):** kerangka, `dim_periode`, `dim_wilayah`, `dim_negara`, dan dua domain
  fakta perintis (wisman, wisnus) sampai jalan di produksi.
- **2b (belum ditulis):** domain fakta sisanya (akomodasi, tenaga kerja, PDRB, destinasi,
  kuliner + usaha/KBLI, event, atlas/GMTI, indikator). Ditulis planner setelah laporan 2a,
  karena bentuknya mengikuti kerangka yang terbukti di sini.

Tujuan 2a: fakta dari sumber berbeda bisa digabung lewat kunci yang sama, dan itu terbukti
dengan angka di data produksi, bukan hanya di test.

## Istilah

- **Konform**: database ClickHouse baru `konform`. Isinya hanya tiga jenis objek:
  `dim_*` (dimensi), `f_*` (fakta bentuk panjang), `tc_*` + `tak_cocok` (nilai yang gagal
  dijodohkan). View Silver otomatis (`silver.*`) dan mart (`serving.*`) tidak disentuh.
- **Fakta**: view `konform.f_*`. Satu baris per baris sumber: tidak ada baris sumber yang
  dibuang atau dijumlahkan. Kolom kunci dimensi boleh NULL bila tak cocok; nilai aslinya tetap
  ada di kolom `*_asli`. Tiap fakta punya kolom `sumber` (nama view Silver asalnya), sehingga
  dua sumber yang angkanya berbeda hidup berdampingan dan mart di batch 3 yang memilih.
- **Kontrak**: berkas TOML per objek konform di `lakehouse/clickhouse/konform/kontrak/`.
  Menyatakan grain, kolom, tipe, satuan, dimensi rujukan, pemilik, kelas refresh, dan uji.
- **Panggung**: database `konform_dev` di ClickHouse produksi. Tempat executor menerapkan SQL
  konform terhadap data sungguhan sebelum ada deploy. Dibuat dan dihapus oleh perintah
  `panggung` (plan 01).
- **Keluarga kolom**: sekumpulan nama kolom Silver yang maknanya sama (mis. `wilayah`, `kota`,
  `kota_adm`). Tingkat kecocokan sebuah dimensi diukur per keluarga, atas semua view Silver.

## Fakta terverifikasi planner (12 Okt 2026)

Server dan akses (tidak berubah dari batch 1):
- Server di `192.168.18.148`. ClickHouse `:18123`, Dagster `:13030`, Portainer `:9443`.
  CLAUDE.md dan `docs/` masih menulis `.187`; jangan perbaiki di batch ini.
- Kredensial ClickHouse akun `dispar`: `platform-v2/.env.local` (`CH_USER`, `CH_PASSWORD`),
  host ditimpa ke `.148`. Dagster GraphQL tanpa login.
- Bronze bukan database ClickHouse. Ia dibaca lewat database `lake`:
  ``lake.`bronze_file.<tabel>` ``. `SHOW TABLES FROM lake` yang benar; `system.tables` tidak
  mendaftarnya.

Pipeline (`lakehouse/orchestrate/dispar_orchestrate/definitions.py`, HEAD `5ab55c8`):
- Job `refresh_lakehouse` harian 09:00 WIB, sukses 10–12 Okt. Urutan aset: `bronze_sdi` →
  `bronze_files` → `bronze_sekunder`, `sdi_meta` → `lake_db` → `functions_dim` → `silver_auto`
  → `quality_gate` → `curated_gold` → `gold_iceberg`.
- `functions_dim` menerapkan daftar tetap `00-functions.sql`, `10-dim.sql`, `11-dim-more.sql`.
  `curated_gold` menerapkan glob `2*.sql` dan `3*.sql` di `lakehouse/clickhouse/sql/`
  (`refresh.py:78-96`).
- `silver_auto` membuat ulang `silver.<tabel bronze>` untuk tiap tabel Bronze. Ia tidak
  menghapus view lain.
- `quality_gate` memeriksa semua tabel di database `silver` saja.
- Image Dagster memuat seluruh `lakehouse/` dan tiap `path` di `lakehouse/sources.toml`
  (`lakehouse/scripts/build-dagster-image.sh`). Berkas data yang tidak terdaftar di registri
  tidak ikut ke image.\
- Fungsi SQL (`CREATE FUNCTION`) di ClickHouse bersifat global, bukan per database.

Keadaan Silver:
- 277 view + 4 tabel dimensi di `silver`. `periode_data` bertipe `Nullable(Date)` di 52 view
  dan `Nullable(Float64)` di 137 view. Yang Float64: 186.572 baris berisi tahun 4 digit
  (1996–2026), 2.242 baris `202606`, 156 baris `2062026` (rusak di sumber).
- Kolom `bulan` ada di 55 view; isinya campuran nama bulan, angka `1`–`12`, dan `KOSONG`.
- `silver.dim_wilayah` hanya 6 kota/kabupaten DKI. `silver.dim_negara` 23 negara.\
  Keduanya dipakai `silver.wisman`, `silver.restoran`, dan `refresh_wisman`: jangan diubah.

Tingkat kecocokan awal (nilai non-kosong, dijodohkan dengan `kunci_cocok()` ke dimensi lama):

| Keluarga | Kolom | Baris | Cocok |
|---|---|---|---|
| wilayah kota | `wilayah`, `kota`, `kabupaten_atau_kota`, `kota_adm`, `kota_administrasi`, `nama_kabupaten_kota`, `wilayah_usaha`, `kota_tujuan` | 173.470 | 9,3% |
| kecamatan | `kecamatan`, `kecamatan_usaha` | 162.544 | 0% |
| kelurahan | `kelurahan`, `kelurahan_usaha` | 150.034 | 0% |
| negara | `negara_asal`, `kebangsaan`, `negara`, `asal_negara` | 73.860 | ±31% |

Yang tak cocok terbanyak: `KOTA ADM. JAKARTA SELATAN` dan ejaan sejenis (±147 ribu baris),
kab/kota luar DKI (`KOTA BEKASI`, `KAB. TEGAL`), negara di luar 23 yang terdaftar (`MAROKO`,
`SWISS`, `HONGARIA`, `SRILANGKA`). Jumlah baris bergeser tiap hari; yang diuji adalah
persentasenya.

Sumber fakta perintis (view Silver, baris per 12 Okt):
- `wisman_jakarta_per_bulan` 28, `wisman_jakarta_per_negara` 604,
  `wisman_jakarta_per_pintu_masuk` 480, `wisman_per_pintu_masuk_bulanan_bps` 36,
  `target_wisman` 6, `data_jumlah_wisatawan_mancanegara_berdasarkan_kebangsaan` 644,
  `wisnus_perjalanan_per_kota_tujuan` 534.
- Sumber wisman tidak saling cocok: `target_wisman` 2025 = 1.286.092, sedangkan
  `serving.mart_wisman` 2025 = 2.754.220. Itu beda definisi sumber, bukan bug. Batch ini tidak
  memilih yang benar.

Repo:
- Tidak ada CI. Gate Python: `cd lakehouse/ingest && uv run --extra dev pytest -q` →
  180 lulus di `origin/main` `e8c682c` (12 Okt; sama dengan di `5ab55c8`).

## Keputusan planner (pemilik boleh membatalkan)

1. Objek konform hidup di database `konform`, terpisah dari `silver`. Alasan: gerbang batch 3
   ("app tidak membaca `silver.`") tetap bermakna, dan `quality_gate` lama tidak berubah.
2. Data rujukan dimensi (kode wilayah, ISO negara, alias) adalah berkas CSV di
   `data/referensi/`, terdaftar di registri, masuk Bronze seperti berkas lain. Dimensi dibangun
   dari Bronze, bukan dari `VALUES` di SQL.
3. Fakta mempertahankan semua baris sumber dan kolom `sumber`. Menyatukan atau memilih sumber
   adalah pekerjaan Gold (batch 3).
4. Kawasan negara memakai tujuh nilai yang sudah ada di `silver.dim_negara`: Asia, Eropa,
   Afrika, Amerika, Oseania, Timur Tengah, Lainnya. "Timur Tengah" = SAU, ARE, BHR, KWT, QAT,
   OMN, YEM, IRQ, IRN, JOR, LBN, SYR, ISR, PSE. Negara lain mengikuti benuanya.
5. Uji kontrak yang gagal dicatat, tidak menghentikan job harian. Belum ada yang membaca
   `konform`; menjadikannya gerbang adalah batch 4.

## Yang boleh diubah di server sebelum plan 06

Hanya dua hal, keduanya lewat akun `dispar`:
- Objek di database `konform_dev` (dibuat dan dihapus bebas).
- Fungsi SQL global berawalan `kf_`.\

Semua yang lain dibaca saja: tidak ada ingest, tidak ada DDL di `silver`, `serving`, `konform`,
atau `lake`, tidak ada trigger job, tidak ada restart.

## Status (executor memperbarui tabel ini)

Batch base: `e8c682c` (plan ditulis terhadap `5ab55c8`; 10 commit sesudahnya hanya menyentuh `lakehouse/sources.toml` +3 tabel sekunder dan `tests/test_sources.py` di sisi lakehouse)

"PR green" = gate lokal lulus + reviewer APPROVE. "main green" = gate lokal lulus lagi di
`origin/main` setelah merge.

| Plan | Judul | Butuh | Status | PR | Merge SHA |
|---|---|---|---|---|---|
| F1 | Pulihkan `compose.yaml` yang terpangkas (perbaikan batch 1) | — | selesai | #13 | `7d726f6` |
| F2 | Pengaman metadata SDI yang bolong (perbaikan batch 1) | — | selesai | #14 | `9bcb9a2` |
| 01 | Kerangka konform: penerap SQL, panggung, kontrak, uji | F2 | selesai | #15 | `b226924` |
| 02 | `dim_periode` dan fungsi periode | 01 | selesai | #16 | `6757b76` |
| 03 | `dim_wilayah` dari kode Kemendagri | 01 | belum | | |
| 04 | `dim_negara` ISO 3166 + ember BPS | 03 | belum | | |
| 05 | Fakta perintis: wisman dan wisnus | 02, 03, 04 | belum | | |
| 06 | OPERASI: image baru, tukar container, verifikasi | F1, F2, 01–05 + "lanjut deploy" | belum | | |

F1 dan F2 berasal dari review pasca-merge batch 1 (12 Okt 2026): PR #7 memangkas
`lakehouse/compose.yaml` menjadi 40 baris tak valid, dan pengaman metadata PR #10 tidak
menutup kegagalan `/detail` maupun gangguan ClickHouse. PR #11 lulus. 01 butuh F2 karena
keduanya menyentuh `definitions.py`.

## Di luar batch ini (sudah diketahui, sengaja ditunda)

- `lake-rustfs` dibatasi 3 GB secara live; compose Portainer masih 1 GB. Bucket `lakehouse`
  punya ±11 ribu direktori untuk ±285 tabel. Backup harian sekarang 15–23 menit.
- Listing di `backup.py` belum dibungkus retry.
- `files.read_json` salah baca berkas `{columns, rows}`.
