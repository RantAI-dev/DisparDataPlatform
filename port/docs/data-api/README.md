# Data API (pelengkap)

Portal tidak membaca ClickHouse sendiri: semua data datang dari **Data API** (FastAPI, read-only)
di repo lakehouse, `lakehouse/data-api/`. Dokumen ini disertakan karena portal bergantung padanya
(SPEC §8). Kode, deploy, dan perubahan kontraknya dikelola di repo lakehouse.

| Berkas | Isi |
|---|---|
| `openapi.yaml` | kontrak Data API, salinan `lakehouse/data-api/openapi.yaml`. SHA sumber tertulis di baris pertama (`scripts/salin-openapi.sh`); dihasilkan ulang oleh `scripts/ekspor-dokumen.sh` dari `docs/api/data-api.openapi.yaml` |
| `skenario-tes.md` | daftar tes Data API, dihasilkan dari `lakehouse/data-api/tests` |

Kontrak yang dipakai portal harus sama dengan Data API yang **dideploy**. Saat Data API dirilis,
salin ulang kontraknya (`scripts/salin-openapi.sh`) dan pastikan SHA di baris pertama `openapi.yaml`
sama dengan SHA image yang jalan.

## Aturan pokok

- Hanya `GET`, kecuali `POST /v1/admin/cache/flush`.
- Sukses `{data, meta}`; error `{error: {code, message, detail}}`. Portal membungkusnya ke envelope
  portal tanpa mengubah `data`.
- Kolom audit lakehouse tidak pernah keluar. Dokumentasi otomatis FastAPI mati di produksi.
- `x-kelas` di kontrak = kelas di portal (T/P/S); `x-sumber` = tabel ClickHouse yang dibaca.

## Operasi

### Token

Data API menerima Bearer token. Yang disimpan di env `DATA_API_TOKENS` hanya **hash** SHA-256,
berbentuk `nama:sha256hex` dipisah koma. Data API menolak start bila daftar ini kosong. Log Data
API hanya memuat nama klien, tidak pernah token.

```bash
TOKEN="$(openssl rand -hex 32)"                     # berikan ke portal sebagai DATA_API_TOKEN
printf %s "$TOKEN" | sha256sum | cut -c1-64         # tambahkan "portal:<hash>" ke DATA_API_TOKENS
```

### Rotasi token

1. Tambahkan hash token baru dengan nama lain (mis. `portal-2:<hash>`) ke `DATA_API_TOKENS`,
   restart Data API. Token lama dan baru sama-sama berlaku.
2. Ganti `DATA_API_TOKEN` di server Laravel, `php artisan config:cache`.
3. Pastikan portal sehat (`GET /api/v1/sistem/kesehatan` di portal), lalu hapus hash lama dan
   restart Data API.

Token yang salah membuat portal menjawab **502** `UPSTREAM_AUTH` di setiap endpoint yang perlu memanggil Data API (snapshot tetap terlayani).

### Flush cache

Data API menyimpan cache in-process (TTL bawaan 300 detik, `CACHE_TTL_DEFAULT`). Endpoint flush
disediakan untuk dipanggil setelah refresh data lake (token `dagster`); per 2 Nov 2026 pipeline
Dagster di repo lakehouse belum memanggilnya, jadi cache habis sendiri setelah TTL. Manual:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN_DAGSTER" https://<alamat-data-api>/v1/admin/cache/flush
```

Hanya token bernama `dagster` yang boleh memanggil flush. Flush Data API **tidak** mengosongkan
snapshot dan cache portal; untuk itu picu sinkron dan kosongkan cache portal
([../manual-book/admin.md](../manual-book/admin.md)).

### Batas baris ekspor

`EXPORT_MAX_ROWS` (bawaan **100.000**). Ekspor di atas batas dijawab 413 `TOO_LARGE`, diteruskan
portal apa adanya. Ekspor dibaca per 10.000 baris, jadi batas ini menjaga memori dan waktu, bukan
hanya ukuran berkas.

### Env lain

| Env | Isi | Bawaan |
|---|---|---|
| `CH_URL`, `CH_USER`, `CH_PASSWORD` | ClickHouse, akun read-only | — |
| `CACHE_TTL_DEFAULT` | TTL cache in-process (detik) | 300 |
| `DATA_API_DOCS` | `1` = hidupkan `/docs` FastAPI | mati |
| `PORT` | port uvicorn | 8080 |

Daftar lengkap: `lakehouse/data-api/README.md`.

### Siapa yang dihubungi

Bila Data API mati atau angkanya salah:

| Gejala | Hubungi |
|---|---|
| `sistem/kesehatan` portal: `data_api` gagal; semua endpoint P 503 | **pengelola lakehouse/Data API** (tim data konsultan) |
| 502 `UPSTREAM_AUTH` | pengelola Data API + **operator server portal** (rotasi token) |
| angka berbeda dengan sumber resmi | **pengelola lakehouse** (pipeline Dagster, Silver/Gold) |
| Data API sehat tetapi portal 5xx | **operator server portal** (Laravel/Oracle) |

Nama dan kontak orang yang memegang peran di atas dicatat di dokumen serah terima kontrak, bukan di
repo ini (repo publik).

Selama Data API mati, halaman kelas T portal tetap tampil dari snapshot
([../manual-book/operasi.md](../manual-book/operasi.md#bila-data-api-mati)).
