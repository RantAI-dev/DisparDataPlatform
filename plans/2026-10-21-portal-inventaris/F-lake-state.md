# F — Keadaan lakehouse yang siap disajikan (inventaris read-only)

Tanggal query: 2026-10-21, sekitar 08:16–08:30 WIB (server `now()` = 2026-10-21 08:16:33).
Host: ClickHouse 26.7.3.19 @ 192.168.18.148:18123 (HTTP). Login sebagai `dispar`: dari
`platform-v2/.env.local`, `CH_USER` berisi `dispar`, bukan `dispar_app`.
Hanya dijalankan SELECT, SHOW, dan DESCRIBE. Tidak ada secret di berkas ini.

## 1. Database

`SHOW DATABASES` → INFORMATION_SCHEMA, _silver_meta, bronze_file, bronze_meta, bronze_meta_sec,
bronze_sdi, bronze_sec, console, default (kosong), gold, information_schema, konform, lake, serving, silver, system.

- **`konform_dev` TIDAK ADA.**
- `gold` = 6 view yang namanya sama dengan mart `serving` (mart_atlas/event/gci_readiness/kuliner/kunjungan_dtw/wisman).
- `console` = tabel milik konsol RantAI (alert_rule 4, app_kv 1, bi_board 11, bi_chart 39, chat_session 13). Bukan data pariwisata.
- `_silver_meta`: karantina 170, kolom_tipe 2109, quality 25472, rowcount_history 16123.

### serving (MergeTree), `count()`
| tabel | baris | catatan |
|---|---|---|
| mart_wisman | 940 | kode_negara, negara, kawasan, tahun, bulan_no, bulan, pintu_masuk, jumlah. Terakhir diubah 2026-10-06 |
| mart_gci_readiness | 28 | kode, framework, dimensi, grup, nama, definisi, pemilik, data_tersedia, readiness, readiness_urut |
| mart_kunjungan_dtw | 35 | destinasi, periode, wisnus, wisman, total, sumber, tanggal_terbit |
| mart_event | 9 | tahun, jumlah_event |
| mart_kuliner | 5 | wilayah, kode_wilayah, jenis_usaha, tahun, jumlah_usaha, total_kapasitas |
| mart_atlas | 4 | kategori, jumlah_poi, rata_rating, ada_koordinat |
| **mart_hotel_scraped_booking** | **0** | Dibaca oleh `app/api/hotels/scraped/route.ts`, tetapi KOSONG. Tidak ada SQL lakehouse yang membangunnya. Data crawl-nya ada di `bronze_file.booking_hotel_2026_09_15` (72 baris) |
| mart_wisman_refresh_baru | 276 | tabel staging |
| mart_*_baru (6 tabel) | 0 | tabel staging/swap, abaikan |

Referensi di kode yang **TIDAK ADA** di serving: `serving.mart_pdrb_ekraf` (komentar di `lib/dashboard/pdrb-ekraf.ts`) dan `serving.mart_gci` (contoh prompt di AI page).

### konform (batch 2a), `count()`
| tabel | jenis | baris | kolom |
|---|---|---|---|
| dim_periode | MergeTree | 17675 | periode_id, tingkat, tahun UInt16, semester?, triwulan?, bulan_no?, tanggal_awal Date, tanggal_akhir Date, label |
| dim_wilayah | MergeTree | 863 | kode, nama, tingkat, kode_induk?, kode_provinsi, kode_kabkota?, kode_kecamatan?, nama_kabkota?, nama_kecamatan?, di_dki UInt8 |
| dim_wilayah_kunci | MergeTree | 1621 | tingkat, kunci, kunci_induk, kode |
| dim_wilayah_ambigu | MergeTree | 49 | tingkat, kunci, kunci_induk, daftar_kode Array, jml_kode |
| dim_negara | MergeTree | 255 | kode, kode_iso2, nama, nama_inggris, kawasan, jenis |
| dim_negara_kunci | MergeTree | 721 | kunci, kode |
| dim_negara_ambigu | MergeTree | 0 | kunci, daftar_kode Array, jml_kode |
| dim_pintu_masuk | MergeTree | 22 | kode, nama, moda, kode_provinsi? |
| dim_pintu_masuk_kunci | MergeTree | 32 | kunci, kode |
| f_wisman_bulanan | View | 28 | periode_id, sumber, jumlah Float64. Periode 2024-01..2026-04, sumber `wisman_jakarta_per_bulan` |
| f_wisman_negara_bulanan | View | 1268 | periode_id, sumber, negara_asli, kode_negara?, jumlah. Periode 2024-01..2026-07, 2 sumber SDI |
| f_wisman_pintu_bulanan | View | 516 | periode_id, sumber, pintu_asli, kode_pintu?, jumlah. Periode 2010-01..2024-12, 2 sumber |
| f_wisnus_kota_bulanan | View | 534 | periode_id, sumber, kota_asli, kode_wilayah?, jumlah. Periode 2019-01..2026-05 |
| f_target_wisman | View | 6 | periode_id, sumber, target, dasar_hukum. Periode 2025..2030 |
| tak_cocok + tc_f_* (3) | View | 0 | fakta, kolom, nilai_asli, baris. Kosong, artinya semua kunci fakta cocok ke dimensi |

`?` = Nullable.

### silver
297 objek: **293 View + 4 ReplacingMergeTree** (dim_bulan 14, dim_negara 61 varian, dim_periode 7670, dim_wilayah 19).
Silver dibaca app dengan dua cara:
(a) **dinamis**: `store.ts` membaca `SELECT * FROM silver.<table_name>` untuk slug katalog mana pun yang tabelnya ada di `SHOW TABLES FROM silver`. Dari 221 baris katalog (184 primer + 37 sekunder), 219 punya view silver.
(b) **eksplisit**, berdasarkan nama:

| view silver | baris | dipakai oleh |
|---|---|---|
| data_rata_rata_lama_menginap_wisatawan_mancanegara_dan_wisatawan_nusantara_pada_hotel_berbintang_di_provinsi_dki_jakarta | 330 | lib/dashboard/data.ts |
| jumlah_tenaga_kerja_pariwisata_dan_ekonomi_kreatif_yang_tersertifikasi | 17 | data.ts |
| jumlah_tenaga_kerja_pariwisata_dan_ekonomi_kreatif_yang_tersertifikasi_tahun_2023_dan_2024 | 16 | data.ts |
| jumlah_wisatawan | 21 | data.ts |
| tenaga_kerja_ekraf_per_provinsi | 522 | data.ts |
| tenaga_kerja_ekraf_per_subsektor_nasional | 80 | data.ts |
| wisman_per_pintu_masuk_bulanan_bps | 36 | data.ts |
| wisnus_perjalanan_per_kota_tujuan | 534 | data.ts |
| data_jumlah_kunjungan_..._berdasarkan_kebangsaan | 276 | GOLD_SOURCES → mart_wisman |
| data_usaha_jasa_makanan_dan_minuman_jenis_usaha_restoran_di_dki_jakarta | 3957 | → mart_kuliner |
| data_event_pariwisata_dan_kebudayaan_dki_jakarta_2011_2019 | 1391 | → mart_event |
| kunjungan_31_dtw_juli_2026_sumber_mentah | 35 | → mart_kunjungan_dtw |
| atlas_restoran / atlas_souvenir / atlas_nightlife / atlas_pertunjukan | 84 / 67 / 76 / 170 | → mart_atlas, ATLAS_TABLES |
| gci_gpci_indicators | 28 | → mart_gci_readiness |
| wisman / restoran / kunjungan_dtw / event / atlas | 940 / 3957 / 35 / 1391 / 397 | model kurasi |
| dim_indikator | 28 | dimensi |

Semua view di atas ADA dan bisa dibaca.

## 2. lake: bronze_file + bronze_meta
`SHOW TABLES FROM lake` → 231 tabel Iceberg: bronze_file 68, bronze_meta 4, bronze_meta_sec 3, bronze_sdi 182, bronze_sec 38, gold 6.
Database `bronze_file` (ClickHouse) berisi 63 view di atas Iceberg. Kelima tabel `ref_*` hanya bisa dibaca lewat `lake.`.

### Ekspor data statis (plan b1-raw-04) → nama tabel dan jumlah baris (bronze = silver kecuali disebut lain)
| nama di plan | tabel | baris |
|---|---|---|
| restoran-kurasi | bronze_file.restoran_kurasi | 181 |
| restoran-osm | restoran_osm | 534 |
| gci-venue-kurasi | gci_venue_kurasi | 65 |
| gci-venue-osm | gci_venue_osm | 2573 |
| gci-venue-rating | gci_venue_rating | 1785 |
| gci-venue-alamat | gci_venue_alamat | 2573 |
| gci-venue-harga | gci_venue_harga | 1147 |
| gci-resto-hotel | gci_resto_hotel | 107 (plan: ±108) |
| event-pertunjukan | event_pertunjukan | 308 |
| golf | golf | 14 |
| souvenir | souvenir | 67 |
| hotel-registri / tpk / los | hotel_registri / hotel_tpk / hotel_los | 120 / 145 / 310 |
| gmti-tempat / kecamatan / tipologi / capaian / ibadah | gmti_tempat / gmti_kecamatan / gmti_tipologi / gmti_capaian / gmti_ibadah | 1105 / 44 / 11 / 15 / 8331 |
| seni-venue | seni_venue | 138 |
| artis-tampil-jakarta | artis_tampil_jakarta | 3 |
| pdrb-ekraf-makro / subsektor | pdrb_ekraf_makro / pdrb_ekraf_subsektor | 9 / 112 |
| gci-gpci-benchmark | gci_gpci_benchmark | 28 |
| target-wisman | target_wisman | 6 |
| target-kontribusi-ekraf-rpjmd | target_kontribusi_ekraf_rpjmd | 5 |
| gci-kearney-resmi | gci_kearney_resmi | 8 |
| booking crawl | booking_hotel_2026_09_15 | 72 |

Semua ada. Tidak ada yang TIDAK ADA.

### bronze_file lainnya
atlas_* (lihat atas), data_dinas_pariwisata 124, gci_gpci_compliance_sheet 52, gci_gpci_indicators 28,
gci_gpci_pariwisata_data_ada 19, _data_gaada 9, _sheet 28, halal_crawl 6, jumlah_pengunjung_event_202607 790,
jumlah_pengunjung_event_geocoded_202607 804, kontak_pengelola_31_dtw 31, kunjungan_31_dtw_juli_2026_sumber_mentah 35,
mom_artis 100, mom_tripadvisor 39, ragunan_harian_juli_2026 31,
satudata_ekraf_tenaga_kerja_provinsi_{2020..2024} masing-masing 38, _provinsi_jenis_kelamin_{2020..2024} masing-masing 76,
_subsektor_tahun_{2020..2024} masing-masing 16,
ref_negara_alias 159, ref_negara_iso3166 255, ref_pintu_masuk 22, ref_wilayah_alias 32, ref_wilayah_kemendagri 863.

**Nama bentrok:** `bronze_file.water_attractions_jakarta` (14) dan `bronze_file.wellness_jakarta` (15) berisi kamus data (key/label/type/description). Isinya bukan data venue.
`silver.water_attractions_jakarta` (28) dan `silver.wellness_jakarta` (84) dibaca dari `lake.bronze_sec.*`, bukan dari bronze_file.

### bronze_meta
| tabel | baris |
|---|---|
| bronze_meta.dataset_catalog | 184 (semua tier `primer`). updated_at maks 2026-10-21T03:19:38Z |
| bronze_meta.dataset_sync | 183 |
| bronze_meta.dataset_column | 979 |
| bronze_meta.ingest_log | 3458 |
| bronze_meta_sec.dataset_catalog | 37 |
| bronze_meta_sec.dataset_sync | 37 |
| bronze_meta_sec.dataset_column | 398 |

## 4. Katalog yang dipakai app (`platform-v2/lib/ch/store.ts`)
`lake.\`bronze_meta.dataset_catalog\`` UNION ALL `lake.\`bronze_meta_sec.dataset_catalog\`` (184 + 37 = 221).
Kolom (semua Nullable): slug, title, description, tags String, views Int64, updated_at String, tier, table_name.
Tabel pendamping:
- `dataset_sync`: slug, title, description, sumber_data, frekuensi, satuan, klasifikasi, kontak, author, total Int64, table_name, synced_at DateTime64(6,UTC).
- `dataset_column`: slug, ord Int64, key_asli, key_safe, tipe, deskripsi.

## 5. Akun
- Akun produksi app: `dispar_app`, sesuai `CH_USER: dispar_app` di `lakehouse/compose.yaml`. Plaintext password, host ::/0, profile `app_readonly`:
  readonly=1, allow_experimental_database_iceberg=1, max_execution_time=30, max_result_rows=100000 (throw),
  max_memory_usage=1e9, use_query_cache=1.
- Grant `dispar_app` (system.grants): SELECT/SHOW/READ dan seterusnya pada `*.*`. Hak tulis dibatasi oleh readonly=1.
- **BELUM DIUJI langsung sebagai dispar_app.** `.env.local` berisi akun `dispar`, bukan password dispar_app.
  Hak baca tersirat dari grant global SELECT. App produksi juga sudah membaca serving/silver/lake dengan akun ini.
- Catatan untuk Data API: `use_query_cache=1` membuat query ke `system.*` gagal untuk akun ini. max_result_rows 100000 akan throw, jadi pagination wajib.

## 6. Paparan publik
Dari CLAUDE.md dan `lakehouse/compose.yaml`: Internet → Cloudflare Tunnel (`dispar-cloudflared`, host network, stack dispar-platform)
→ host:13031 → container `dispar-v2` :3032 (`PORT: 3032`; port juga dipetakan ke 13032) → `lake-clickhouse:8123` sebagai dispar_app.
Publik: https://dispar.rantai.dev. ClickHouse :18123 terbuka di LAN (kami menjangkaunya di .148).
Portainer tidak disentuh. Catatan: dokumen masih menyebut .187, tetapi host aktual saat ini .148.

## Belum diperiksa
- Login langsung sebagai dispar_app (password tidak ada di .env.local).
- Jumlah baris per tabel bronze_sdi (182) dan bronze_sec (38). Tidak diminta.
- Isi `_silver_meta.karantina` (170 baris) tidak diurai.
