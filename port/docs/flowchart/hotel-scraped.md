# Flowchart hotel scraped

Layer Nuxt `gmti` (halaman berbahasa Inggris, tiruan Next.js), fitur Laravel `Features/Gmti` dengan
modul log `hotel-scraped`. Pola baca umum: [README.md](README.md).

Rute halaman: `/scraped-hotels`.

| Rute API (nama) | Laravel `GET /api/v1/…` | Data API | Kelas |
|---|---|---|---|
| `hotel-scraped` | `hotel-scraped?limit` | `/v1/hotel-scraped` | T |

```mermaid
flowchart TD
    P["GET /scraped-hotels"] --> L["hotel-scraped (T)"]
    L --> V{"limit ≤ 500?"}
    V -- tidak --> E422["422 INVALID_PARAM"]
    V -- ya --> T{"SNAPSHOT?"}
    T -- ya --> OK["tabel hotel<br/>sumber = snapshot"]
    T -- tidak --> D["Data API 60 s, tanpa ulang"]
    D -- sukses --> W["simpan SNAPSHOT"] --> OK
    D -- gagal --> E503["503 UPSTREAM_UNAVAILABLE"]
```
