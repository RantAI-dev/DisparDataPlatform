# Dataset — Atraksi Wisata Air DKI Jakarta

## Cakupan (final)

| | Baris |
|---|---|
| **Total venue** | **28** |
| Silver SDI (filter regex nama water-related, koordinat valid) | 23 |
| Silver SDI koordinat rusak → diperbaiki Photon | 2 |
| Nominatim/OSM enrichment (waterpark/marina/diving yang TIDAK ada di SDI) | 3 |
| Bergabung dengan klasifikasi `jenis` dari silver.potensi_DTW | 2 |

## Sumber

1. **Silver lakehouse** (basis 25 venue):
   - `silver.data_destinasi_pariwisata_yang_memiliki_aksesibilitas_amenitas_atau_atraksi` (175 baris, filter regex nama water-related → 25).
   - `silver.data_potensi_daya_tarik_wisata_unggulan_provinsi_dki_jakarta` (18 DTW) → join klasifikasi `jenis` ("WISATA BAHARI", dll.).
2. **Photon (OSM)** (fix untuk 2 silver rusak):
   - `[PULAU SABIRA, PULAU SEPA]` — silver view latitude di luar bbox; Photon forward search normalkan lat ke rentang Seribu.
3. **Nominatim (OSM)** (enrichment):
   - `CX Water Park` (Ciracas, leisure=water_park)
   - `Jetski Pantai Mutiara` (Pluit)
   - `Diving Spot` (Pulau Panggang, Kepulauan Seribu)
   - Cache per-query: `scripts/osm_water_attractions_cache.json`

## Temuan penting & catatan jujur

### Bug lat/lon-tertukar di silver view (untuk 19 dari 25 venue)

Silver view `data_destinasi_pariwisata_yang_memiliki_aksesibilitas_amenitas_atau_atraksi`
memiliki `latitude` & `longitude` **TERTUKAR** di source — `latitude` silver berisi
longitude Jakarta (~106.x); `longitude` silver berisi latitude Jakarta (~-6.x).
Telah diperbaiki di `scripts/build_water_attractions.py:validate_and_fix`.
Flag audit `koordinat_sumber_silver_di_swap: true` di setiap baris yang
diperbaiki.

### Bug literal desimal

Sebagian baris (DUNIA AIR TAWAR, MASJID SUNDA KELAPA, PULAU PARI, PULAU SEPA)
simpan longitude sebagai `-630464` (tanpa desimal). Heuristik `|v|>1000 dan
|v/1e5|<10` lalu `/1e5` menormalkan. 2 di antaranya setelah fix tetap
out-of-range → diteruskan ke Photon.

### Overpass tidak dipakai

Overpass mirror Swiss (`overpass.osm.ch`) mengembalikan valid OSM JSON tapi
0 elements untuk kategori water-recreation di bbox DKI — kemungkinan
mirror regional tidak punya coverage Indonesia. Nominatim forward-search
justru lebih andal untuk inventaris ini. Hasil 3 venue baru adalah
dari 22 query Nominatim.

## Kategori Kemenpar

Mapping mengikuti standar resmi [Aktivitas Wisata Air Kemenpar](https://sisupar.kemenpar.go.id/unsur-standar/detail-standardisasi/aktivitas-wisata-air)
(14 sub, lihat link) + kategori tambahan relevan (`waterpark_taman_air`,
`pelabuhan_rekreasi_marina`, `pantai_pulau_rekreasi`).
Nilai disimpan dalam kolom `kategori_kemenpar` sebagai `string[]`.

## File

| Path | Isi |
|---|---|
| `data/water-attractions-jakarta.json` | dataset 28 venue (canonical) |
| `data/sekunder/water-attractions-jakarta.json` | mirror — dibaca `lakehouse/ingest/dispar_ingest/secondary_ingest.py` |
| `platform-v2/data/water-attractions-jakarta.json` | mirror untuk app |
| `data/water-attractions-osm-additions.json` | 3 venue OSM dengan deduplication log |
| `data/atraksi-wisata-air-GCI-jakarta.tsv` | deliverable TSV untuk Dinas (28 baris + 1 header) |
| `scripts/build_water_attractions.py` | script Phase 1 (silver + fix koordinat + tulis dataset) |
| `scripts/geocode_water_attractions_pass.py` | script Phase 2A (Photon untuk silver rusak) |
| `scripts/crawl_osm_water_attractions.py` | script Phase 2B (Nominatim multi-query untuk venue tambahan) |
| `scripts/water_attractions_intermediate.json` | cache per-batch |
| `scripts/osm_water_attractions_cache.json` | cache 22 query Nominatim (24 jam TTL) |

## Cara menjalankan ulang

```bash
cd /home/alfi/repos/DisparDataPlatform
python3 scripts/build_water_attractions.py         # Phase 1: 25 silver
python3 scripts/geocode_water_attractions_pass.py # Phase 2A: Photon fix 2 rusak
python3 scripts/crawl_osm_water_attractions.py    # Phase 2B: Nominatim enrichment
# Lalu merge OSM addition (lihat akhir scripts/crawl_osm_water_attractions.py):
#   python3 -c "..."  atau buat script merge terpisah.
```

## Langkah selanjutnya

1. **Ingest ke lakehouse** → `bronze_sec.water_attractions_jakarta` →
   Silver. Dijalankan via `python -m dispar_ingest.secondary_ingest`
   di dalam container `lake-dagster` (network `lakenet`) — env `CH_PASSWORD`
   otomatis berisi sandi `dispar` (write) yang didefinisikan Portainer stack 6.
2. **Daftar di `/sdi`** — entri `sec-water-attractions` sudah ditambah
   di `platform-v2/lib/secondary.ts` dengan `href: /sdi/water-attractions-jakarta`.
   `tsc --noEmit` lulus.
3. **Halaman `/sdi/[slug]`** — otomatis baca dari `silver.water_attractions_jakarta`
   lewat `lib/ch/store.ts`.

## Runbook ingest (2026-09-18)

1. `git pull --ff-only` di repo DisparDataPlatform.
2. Taruh JSON di lokasi yang dapat dibaca container lakehouse —
   karena `lake-dagster` mount-bind ke `/repo` dari repo LAMA
   (`jakarta-restaurant-data`), JSON kita upload manual via
   `docker exec` ke `/tmp/ingest-data/water-attractions-jakarta.json`
   (base64 dari `data/sekunder/water-attractions-jakarta.json`).
3. Jalan `python -m dispar_ingest.secondary_ingest /tmp/ingest-data`
   di dalam container → tulis `bronze_sec.water_attractions_jakarta`
   + `bronze_meta_sec.{dataset_catalog,dataset_sync,dataset_column}`
   lewat Lakekeeper REST catalog (data di RustFS).
4. Untuk Silver tipe: panggil `tebak_tipe` per kolom lalu
   `CREATE OR REPLACE VIEW silver.<slug> AS SELECT ... FROM lake.\`bronze_sec.<slug>\``
   (lihat jejak di /tmp/check_final.py). Skrip `dispar_ingest.silver`
   yang otomatis memproses 226 tabel bisa gagal ditulis ke log
   karena stdout ter-buffer — bila perlu, generate per-slug.
5. Verifikasi: `SELECT count() FROM silver.water_attractions_jakarta`
   (harus 28). Spot-check 3 baris random.

## Diagnostik otentikasi (2026-09-17 → 2026-09-18)

`platform-v2/.env.local` punya `CH_PASSWORD=` yang sebenarnya berisi sandi
user `dispar_app` (read-only), bukan `dispar` (write). Dua variabel env
terpisah didefinisikan di `lakehouse/compose.yaml` (`CH_PASSWORD` &
`CH_APP_PASSWORD`). Sandi `dispar` sebenarnya hanya tersedia di
Portainer stack 6 Env (`dispar-lakehouse`). Container `lake-dagster` (yang
sudah membawa image `dispar-ingest` ikut) membawa env itu otomatis;
exec ke dalamnya lewat Portainer MCP `docker_proxy` untuk pekerjaan
write/DDL.
