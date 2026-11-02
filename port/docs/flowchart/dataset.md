# Flowchart dataset

Layer Nuxt `dataset`, fitur Laravel `Features/Dataset`. Pola baca umum: [README.md](README.md).

Rute halaman: `/katalog`, `/sdi`, `/sdi/[slug]`.

| Rute API (nama) | Laravel `GET /api/v1/…` | Data API `GET /v1/…` | Kelas |
|---|---|---|---|
| `dataset.katalog` | `katalog?tier` | `katalog` | T (varian `tier=semua`, `tier=primer`) |
| `dataset.detail` | `dataset/{slug}` | `dataset/{slug}` | P |
| `dataset.kolom` | `dataset/{slug}/kolom` | `dataset/{slug}/kolom` | P |
| `dataset.facet` | `dataset/{slug}/facet` | `dataset/{slug}/facet` | P |
| `dataset.baris` | `dataset/{slug}/baris?page&size&sort&q&f[]` | `…/baris?…&f=…&f=…` | P |
| `dataset.agregat` | `dataset/{slug}/agregat?x&y&agg&q&f[]` | `…/agregat` | P |
| `dataset.halaman` | `dataset/{slug}/halaman` | gabungan detail + kolom + baris | P |
| `dataset.ekspor` | `dataset/{slug}/ekspor?format&q&f[]&sort` | `…/ekspor` | S |

## Katalog `/katalog` dan `/sdi`

`/katalog` meminta `tier=semua`, `/sdi` meminta `tier=primer`. Kedua varian diisi ulang tiap hari oleh
`portal:sinkron`. Cari, filter tier, dan lapisan dikerjakan di browser atas daftar yang sudah dimuat.

```mermaid
flowchart TD
    P["GET /katalog atau /sdi"] --> L["dataset.katalog (tier)"]
    L --> V{"tier valid?"}
    V -- tidak --> E422["422 INVALID_PARAM"]
    V -- ya --> T{"SNAPSHOT dataset.katalog?tier=… ada?"}
    T -- ya --> OK["daftar dataset + statistik<br/>sumber = snapshot"]
    T -- tidak --> D["Data API /v1/katalog"] -- sukses --> W["simpan SNAPSHOT"] --> OK
    D -- gagal --> E["503 UPSTREAM_UNAVAILABLE"]
```

## Detail `/sdi/[slug]`

```mermaid
flowchart TD
    P["GET /sdi/slug"] --> H["dataset.halaman (page=1, size=50)"]
    H --> D1["detail (cache P)"]
    D1 -- "404 NOT_FOUND" --> NF["'Dataset belum tersedia di lakehouse'<br/>kolom dan baris tidak dipanggil"]
    D1 -- ok --> D2["kolom (cache P)"] --> D3["baris (cache P)"]
    D3 --> G["data = {dataset, kolom, baris}<br/>meta = meta baris; sumber = cache bila ketiganya dari cache"]
    G --> UI["hero, meta, tabel, chart builder"]
    UI -->|"gulir"| B["dataset.baris page = dimuat/50 + 1"]
    UI -->|"chip filter / cari / sort"| B
    UI -->|"chart builder"| A["dataset.agregat + dataset.facet"]
    B -- "400 INVALID_FILTER" --> EF["diteruskan, tidak di-cache"]
    B -- "size > 200, sort tanpa arah" --> E422["422 tanpa memanggil Data API"]
```

## Ekspor CSV/XLSX

Browser mengunduh langsung lewat proxy `/_api/dataset/{slug}/ekspor` (bukan JSON). Batas baris
diatur Data API (`EXPORT_MAX_ROWS`, bawaan 100.000).

```mermaid
flowchart TD
    U["klik Unduh"] --> N["Nuxt proxy /_api/…/ekspor<br/>batas tunggu 330 s"]
    N --> L["dataset.ekspor (kelas S)"]
    L --> D["DataApiStream: timeout 300 s, tanpa ulang, stream"]
    D -- "200" --> S["StreamedResponse per 64 KiB<br/>Content-Disposition, X-Row-Count,<br/>X-Accel-Buffering: no"]
    S --> LOG["LOG_HISTORY: filter + jumlah baris"]
    D -- "413 TOO_LARGE" --> E413["413 dalam envelope<br/>(Next.js lama: 404)"]
    D -- "tak terjangkau" --> E503["503 UPSTREAM_UNAVAILABLE"]
    N -- "Laravel > 330 s" --> E504["504 GATEWAY_TIMEOUT"]
```
