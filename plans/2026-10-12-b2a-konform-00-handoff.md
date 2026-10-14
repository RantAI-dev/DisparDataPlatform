# Handoff: Batch 2a — Kerangka konform, tiga dimensi, fakta perintis

Dokumen operasional eksekusi batch 2a. Dibaca oleh executor dan reviewer; diperbarui
tiap kali satu PR selesai di-merge ke `origin/main`.

## Urutan dan ketergantungan

```
[F1 pulihkan compose] ──┐
                         ├──> [06 operasi: image, tukar container, verifikasi]
[F2 sdi-meta] ──────────┼───> [01 kerangka] ──┬──> [02 dim_periode] ──┐
                        │                     ├──> [03 dim_wilayah] ──┼──> [05 fakta perintis] ──┤
                        │                     │                       │                           │
                        │                     └──> [04 dim_negara] ───┘                           │
                        │                                                                         │
                        └────────────────────── BUTUH "lanjut deploy" DARI PEMILIK ───────────────┘
```

Eksekusi per baris tabel di bawah. Jangan mulai plan sebelum semua yang ada di kolom `Butuh`
berstatus `selesai`. Stop mutlak setelah plan 05: plan 06 menyentuh server produksi dan butuh
jawaban tegas pemilik atas kriteria yang terkumpul di handoff ini.

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
| 03 | `dim_wilayah` dari kode Kemendagri | 01 | selesai | #17 | `03a4b0e` |
| 04 | `dim_negara` ISO 3166 + ember BPS | 03 | selesai | #18 | `27ef784` |
| 05 | Fakta perintis: wisman dan wisnus | 02, 03, 04 | selesai | #19 | `48a7b61` |
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
