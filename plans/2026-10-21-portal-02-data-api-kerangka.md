# Plan 02 — Data API: kerangka, fitur dataset, katalog, beranda (needs 01)

Repo: ini. Branch `feat/data-api-kerangka`.
Commit: `feat(data-api): kerangka fastapi dan fitur dataset`.

## Hasil akhir

Layanan FastAPI di `lakehouse/data-api/` dengan struktur SPEC §3.2. Plan ini mengisi bagian
`shared/` dan tiga fitur: `dataset`, `beranda`, dan `katalog` (katalog bagian dari `dataset`).
Layanan bisa dijalankan lokal dengan `uv run data-api` dan membaca .148. Dockerfile ikut dibuat
dan bisa di-build, tetapi **belum dideploy**.

## Berkas

- `pyproject.toml`:
  - dependensi: fastapi, uvicorn, clickhouse-connect, pydantic v2, openpyxl (xlsx streaming)
  - extra `dev`: pytest, httpx, openapi-core / schemathesis, ruff
- `uv.lock`, `Dockerfile` (python:3.12-slim, user non-root, `PORT=8080`), `README.md`
  (Bahasa Indonesia: cara jalan, env, uji).
- `data_api/shared/*` sesuai SPEC §3.2. Env:

  | Env | Isi |
  |---|---|
  | `CH_URL`, `CH_USER`, `CH_PASSWORD` | koneksi ClickHouse |
  | `DATA_API_TOKENS` | daftar `nama:sha256`, dipisah koma |
  | `CACHE_TTL_DEFAULT` | TTL cache bawaan |
  | `EXPORT_MAX_ROWS=100000` | batas baris ekspor |

- `data_api/features/dataset/`:
  - port `lib/ch/store.ts` @ `6b858eb` fungsi per fungsi (inventaris E §3);
  - port tata bahasa filter `lib/ch/query-filter.ts` (E §2.3.1);
  - `katalog_tautan.toml` (KONTRAK §2.1 catatan 1).
- `data_api/features/beranda/`.
- Tes (lihat di bawah).

## Langkah 0 — buktikan klien di bawah `dispar_app` (sebelum kode lain)

1. Baca `CH_APP_PASSWORD` dari Env stack lakehouse lewat Portainer: `StackInspect`, hanya baca.
   Nilainya disimpan **hanya** di env shell, tidak di berkas.
2. Jalankan skrip kecil di `/tmp` dengan klien yang akan dipakai. Skrip memakai akun
   `dispar_app` ke .148 dan mengeksekusi:
   - `SELECT 1`;
   - satu query ke `lake.\`bronze_meta.dataset_catalog\``;
   - satu query ber-`ORDER BY … LIMIT … OFFSET`;
   - satu query yang diawali komentar `/* rid=x */`.
3. Kalau `clickhouse-connect` gagal karena setting atau `system.*`, pakai `httpx` polos dengan
   `FORMAT JSONEachRow`. Catat pilihan dan buktinya di PR.
4. Semua tes panggung plan 02–05 memakai `dispar_app`.

## Aturan

- **Klien dan penanda:** SPEC §3.3. Tanpa setting sesi; request id ditulis sebagai komentar
  SQL.
- **Proses:**
  - Satu worker uvicorn.
  - `/docs` mati kecuali `DATA_API_DOCS=1`.
  - Start gagal bila `DATA_API_TOKENS` kosong.
- **Hitungan bersama.** Hitungan yang dipakai lebih dari satu fitur ada di `shared/`, bukan di
  fitur:
  - `shared/hitungan.py`: jumlah baris tabel Bronze/Silver per slug, dipakai katalog sekunder,
    `dataset-tematik`, dan beranda;
  - `shared/indikator_sumber.py`: daftar indikator, dipakai beranda dan indikator.
- **Sumber daftar indikator.**
  - Produksi membaca `bronze_file.gci_gpci_indicators`.
  - Selama Bronze masih basi (sampai plan 06 bagian A), panggung boleh memakai env
    `INDIKATOR_BERKAS=<path platform-v2/data/gci-gpci-indicators.json>`.
  - Env ini **ditolak** bila `DATA_API_ENV=produksi`.
  - Saat start di produksi, ada pemeriksaan "salinan Bronze punya `officialNo`"; bila gagal,
    hanya keluar peringatan di log.
- **Satu-satunya tempat SQL adalah `queries.py`.** Nama tabel dan kolom berasal dari metadata
  server dan divalidasi dengan regex identifier (pola `app/api/spatial/route.ts`), tidak pernah
  dari input pengguna mentah. Nilai input memakai parameter terikat clickhouse-connect.
- Hasil `SHOW TABLES FROM silver/serving` di-cache dengan TTL 10 menit dan dikosongkan oleh
  `/v1/admin/cache/flush`. Dengan begitu daftar tabel tidak lagi basi sampai restart (E §4.4).
- **Urutan default deterministik** untuk baris (SPEC §3.3).
- **Ekspor.**
  - CSV: BOM + CRLF + RFC 4180.
  - XLSX: sheet `Data`.
  - Nama berkas `{slug}.csv`, atau `{slug}-terfilter.csv` bila ada `q`, `f`, atau `sort`.
  - Header `X-Row-Count`.
  - Respons dikirim sebagai stream per halaman 10.000 baris. Bila total di atas
    `EXPORT_MAX_ROWS` → 413.
- Setiap query bekerja di bawah batas profil `app_readonly`: tanpa `system.*` dan ≤ 100.000
  baris per query. Ini dibuktikan oleh uji panggung, yang memakai akun `dispar_app` sungguhan
  (langkah 0).
- **Ekspor XLSX** tidak bisa di-stream per halaman dengan openpyxl. Tulis dulu ke berkas
  sementara (mode `write_only`), lalu kirim sebagai stream. Berkas sementara dihapus di
  `finally`.
- Logging berupa JSON satu baris per request ke stdout (request_id, path, status, durasi,
  baris). Token tidak pernah dicatat.

## Test (wajib, tiap skenario satu tes)

Skenario minimal ada di inventaris E §4.2 "Unit and feature test scenarios" butir 1–6, 9, 10,
disesuaikan dengan nama path baru. Ditambah:

- autentikasi: tanpa token → 401, token salah → 401, `/v1/health` tanpa token → 200;
- impor fitur silang dilarang (tes pemindai impor);
- `contract/`: setiap endpoint fitur ini divalidasi terhadap `openapi.yaml` dengan ClickHouse
  palsu (fixture);
- `panggung/test_dataset_live.py` (penanda `panggung`, tidak masuk gate default): bandingkan
  `/v1/katalog`, `/v1/dataset/{slug}`, dan `/baris` untuk 5 slug (satu per tier/medallion)
  dengan golden live plan 01. Harus sama persis.

## Gate lokal

```bash
cd lakehouse/data-api && uv run --extra dev ruff check . && uv run --extra dev pytest -q
uv run --extra dev pytest -q -m panggung   # terhadap .148; tempel keluaran di PR
docker build -t dispar-data-api:dev lakehouse/data-api   # build saja, jangan push/deploy
```

## Kriteria selesai

1. Semua tes lulus. Keluaran tes panggung ditempel di PR.
2. `curl` lokal ke `/v1/katalog?tier=primer` menghasilkan `meta.total` = 184 (atau nilai hari
   itu, ditulis di PR beserta query pembandingnya).
3. Ekspor:
   - Cari slug Silver terbesar dengan query `count()`, lalu tulis hasilnya.
   - Bila ada slug di atas 100.000 baris, tunjukkan 413 pada slug itu.
   - Bila tidak ada, tunjukkan 413 dengan `EXPORT_MAX_ROWS` diturunkan di bawah ukuran slug
     terbesar.
   - Tunjukkan juga satu ekspor CSV dan satu XLSX yang berhasil.

## STOP

- Ada query yang butuh `system.*` atau melebihi 100.000 baris tanpa bisa dihalamankan.
- Katalog sekunder di lake tidak bisa dicocokkan dengan 43 entri `lib/secondary.ts` tanpa
  menebak.

## Bukan cakupan

Fitur dashboard, indikator, atlas, gmti, spasial, hotel (03–05). Deploy (06).
