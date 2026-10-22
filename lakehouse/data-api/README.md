# Data API Disparekraf

Layanan HTTP read-only di atas lakehouse (ClickHouse) untuk portal Nuxt + Laravel. Kontraknya
`openapi.yaml` (ditulis tangan, sumber kebenaran). Desain: `plans/2026-10-21-portal-SPEC.md` §3.

- FastAPI + `httpx` polos ke ClickHouse HTTP dengan `FORMAT JSONEachRow`. `clickhouse-connect`
  tidak dipakai karena membaca `system.*` saat inisialisasi, dan itu ditolak profil `app_readonly`.
- Tanpa setting sesi. Request id ditulis sebagai komentar SQL `/* rid=… */`.
- Satu worker uvicorn. Cache in-process dikosongkan oleh `POST /v1/admin/cache/flush`.

## Struktur

```
data_api/
  main.py              app, request id, log JSON, bentuk error, /v1/health, /v1/admin/cache/flush
  shared/              klien CH, auth, cache, filter, halaman, hitungan, daftar indikator
    queries.py         SQL milik shared/
    lake.py            metadata dan baris lake (Silver, Bronze ber-cache) yang dipakai >1 fitur
    atlas_gabungan.py  gabung + dedup Restoran GCI dan Direktori (katalog, atlas, spasial)
    peta.py            peta kecamatan DKI (dki-jakarta.geojson) dan uji titik-dalam-poligon
    katalog_sekunder.toml  44 entri katalog sekunder (teks app, baris dari lake)
  features/<fitur>/    router.py, service.py, models.py (response_model), queries.py (satu-satunya
                       tempat SQL fitur), logika.py (port logika Next.js murni, bila ada)
                       fitur: dataset, beranda, dashboard, indikator, atlas, gmti, spasial, hotel_scraped
tests/
  unit/ contract/      gate default, ClickHouse palsu
  panggung/            read-only ke ClickHouse panggung, dibandingkan dengan golden live (-m panggung)
  golden/              oracle paritas dari logika Next.js (scripts/portal_golden.tsx)
```

Fitur tidak mengimpor fitur lain, `shared/` tidak mengimpor fitur, dan SQL hanya ada di
`queries.py`. Ketiganya dijaga `tests/unit/test_impor.py`.

## Env

| Env | Isi | Bawaan |
|---|---|---|
| `CH_URL`, `CH_USER`, `CH_PASSWORD` | koneksi ClickHouse (akun `dispar_app`) | `http://localhost:8123`, `dispar_app`, kosong |
| `DATA_API_TOKENS` | `nama:sha256hex` dipisah koma. **Wajib**; kosong = menolak start | — |
| `CACHE_TTL_DEFAULT` | TTL cache bawaan (detik) | `300` |
| `EXPORT_MAX_ROWS` | batas baris ekspor; di atasnya 413 | `100000` |
| `DATA_API_DOCS` | `1` = hidupkan `/docs`, `/redoc`, `/openapi.json` | mati |
| `DATA_API_ENV` | `produksi` menolak `INDIKATOR_BERKAS` | — |
| `INDIKATOR_BERKAS` | panggung saja: path `gci-gpci-indicators.json` pengganti Bronze yang basi | — |
| `PORT` | port uvicorn | `8080` |

Hash token dibuat dengan `printf %s "$TOKEN" | sha256sum`. Token mentah tidak pernah disimpan
atau dicatat; log hanya memuat nama klien. Token bernama `dagster` adalah satu-satunya yang boleh
memanggil flush cache.

## Jalan lokal

```bash
cd lakehouse/data-api
export CH_URL=http://<host-clickhouse>:18123 CH_USER=dispar_app
read -rs CH_PASSWORD && export CH_PASSWORD      # dari Env stack lakehouse di Portainer
export DATA_API_TOKENS="lokal:$(printf %s rahasia-lokal | sha256sum | cut -c1-64)"
uv run data-api                                  # http://localhost:8080
curl -H 'Authorization: Bearer rahasia-lokal' 'localhost:8080/v1/katalog?tier=primer'
```

## Uji

```bash
uv run --extra dev ruff check .
uv run --extra dev pytest -q                     # unit + kontrak, tanpa jaringan
uv run --extra dev pytest -q -m panggung         # read-only; butuh CH_* di env
docker build -t dispar-data-api:dev .
```

Sebelum uji panggung, buat ulang golden live pada menit yang sama dengan
`scripts/portal_golden.tsx --live` (cara jalan ada di kepala berkas itu).

## Penyimpangan dari Next.js yang disengaja

- Baris tanpa `sort` memakai urutan deterministik `cityHash64` baris (SPEC §3.3). Next.js
  mengembalikan urutan simpan, yang tidak tetap.
- Agregat dengan nilai sama diurut `name` sebagai pengurut kedua.
- Daftar tabel Silver/serving di-cache 10 menit, bukan sampai restart.
- Ekspor dibaca per halaman 10.000 baris dan ditolak 413 di atas `EXPORT_MAX_ROWS`.
- Sel ekspor (CSV/XLSX) berupa teks yang diawali `=`, `+`, `-`, `@`, tab, atau CR diberi awalan `'`
  agar tidak dijalankan sebagai formula di Excel/Sheets. Angka, termasuk angka yang dikirim sebagai
  teks, tidak diubah.
- Dashboard: query ClickHouse yang gagal menghasilkan 200 dengan data kosong dan `meta.peringatan`
  (Q21), bukan 5xx; kegagalan tidak di-cache.
- Indikator: `trendSeries` tidak diport (tren tidak tampil di `/gci` dan `/gpci`); `latest` yang gagal
  dibaca (mis. timeout 30 detik) menjadi null. `meta.dataset_terpilih` = daftar slug datar.
- Spasial: dedup, `cities`, dan kepadatan per kecamatan dihitung di server; ibadah tanpa koordinat
  dikirim sebagai `kepadatan_tanpa_koordinat`, jadi browser tidak perlu `gmti-ibadah.json`. Titik
  tambahan diurutkan lake lalu ibadah. Detail popup lewat `/v1/spasial/titik/{id}`.
- Hotel-scraped membaca `bronze_file.booking_hotel_2026_09_15` dan statistiknya tanpa jendela 7 hari
  (SPEC P5); `/v1/spasial` tetap membaca mart seperti Next.js. Histogram harga dihitung di server.

Paritas atlas, GMTI, dan dedup bergantung pada urutan pindai Bronze (tabel tanpa kolom ordinal), yang
saat ini sama dengan urutan berkas `data/statis`.
