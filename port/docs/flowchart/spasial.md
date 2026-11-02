# Flowchart spasial

Layer Nuxt `gmti` (halaman peta), fitur Laravel `Features/Gmti` dengan modul log `spasial`. Pola baca
umum, termasuk penyegaran snapshot basi dan jawaban berperingatan: [README.md](README.md).

Rute halaman: `/spatial` (juga tujuan redirect `/atlas`, `/atlas/*/map`, `/gmti/map`).

| Rute API (nama) | Laravel `GET /api/v1/…` | Data API | Kelas |
|---|---|---|---|
| `spasial.index` | `spasial` | `/v1/spasial` | T |
| `spasial.titik` | `spasial/titik/{id}` | `/v1/spasial/titik/{id}` | P |

`/v1/spasial` menggabungkan ± 5.000 titik dan kepadatan per kecamatan (point-in-polygon) di Data
API; satu percobaan 60 s, hasilnya disimpan di snapshot.

```mermaid
flowchart TD
    P["GET /spatial"] --> S["spasial.index (T)"]
    S --> T{"SNAPSHOT spasial?"}
    T -- ya --> M["peta Leaflet: titik, cluster,<br/>kepadatan kecamatan"]
    T -- tidak --> D["Data API 60 s"] -- sukses --> W["simpan SNAPSHOT"] --> M
    D -- gagal --> E503["503 UPSTREAM_UNAVAILABLE"]
    M -->|"klik titik"| TI["spasial.titik id (P)"]
    TI --> C{"cache?"}
    C -- ya --> POP["popup detail"]
    C -- tidak --> D2["Data API 60 s"]
    D2 -- sukses --> POP
    D2 -- "404 NOT_FOUND" --> NF["404 NOT_FOUND diteruskan"]
    D2 -- gagal --> E503
```
