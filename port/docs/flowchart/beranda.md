# Flowchart beranda dan /docs

Layer Nuxt `beranda` dan `docs`. Pola baca umum, termasuk penyegaran snapshot basi dan jawaban berperingatan: [README.md](README.md).

| Rute halaman | Rute API (nama) | Laravel | Data API | Kelas |
|---|---|---|---|---|
| `/` | `beranda.ringkasan` | `GET /api/v1/beranda/ringkasan` | `GET /v1/beranda/ringkasan` | T |
| `/docs` | — | — (isi statis dari `layers/docs/data/endpoints.json`) | — | — |

## Beranda `/`

```mermaid
flowchart TD
    P["GET /"] --> SSR["Nuxt SSR: useBeranda()"]
    SSR --> L["Laravel beranda.ringkasan<br/>(token read)"]
    L --> T{"SNAPSHOT beranda.ringkasan ada?"}
    T -- ya --> R["hero + kartu tautan<br/>sumber = snapshot"]
    T -- tidak --> D["Data API /v1/beranda/ringkasan<br/>timeout 10 s, ulang 2×"]
    D -- sukses --> W["simpan SNAPSHOT"] --> R
    D -- gagal --> E["503 UPSTREAM_UNAVAILABLE<br/>Nuxt menampilkan halaman error"]
```

## Dokumentasi API `/docs`

Halaman tidak memanggil API saat dibuka. Isinya `layers/docs/data/endpoints.json`, yang dibangkitkan
`npm run docs:api` dari ekspor Scramble `docs/api/laravel-openapi.json`; rute `sistem/*` disaring
(DS-F08).

```mermaid
flowchart LR
    K["kode Laravel"] -->|"php artisan scramble:export"| O["docs/api/laravel-openapi.json"]
    O -->|"npm run docs:api<br/>(tanpa /sistem/*)"| J["layers/docs/data/endpoints.json"]
    J --> P["GET /docs (statis)"]
```
