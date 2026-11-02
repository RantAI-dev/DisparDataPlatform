# Flowchart GMTI

Layer Nuxt `gmti`, fitur Laravel `Features/Gmti`. Pola baca umum, termasuk penyegaran snapshot basi dan jawaban berperingatan: [README.md](README.md).
Fitur yang sama melayani [spasial.md](spasial.md) dan [hotel-scraped.md](hotel-scraped.md).

Rute halaman: `/gmti`.

| Rute API (nama) | Laravel `GET /api/v1/…` | Data API | Kelas |
|---|---|---|---|
| `gmti.ringkasan` | `gmti/ringkasan` | `/v1/gmti/ringkasan` | T |
| `gmti.tempat` | `gmti/tempat?pilar&kota&jenis&q&page&size` | `/v1/gmti/tempat` | P |

Data API dipanggil dengan satu percobaan 60 s.

```mermaid
flowchart TD
    P["GET /gmti"] --> R["gmti.ringkasan (T)"]
    R --> T{"SNAPSHOT?"}
    T -- ya --> OK["skor pilar + ringkasan<br/>sumber = snapshot"]
    T -- tidak --> D["Data API 60 s"] -- sukses --> W["simpan SNAPSHOT"] --> OK
    D -- gagal --> E503["503 UPSTREAM_UNAVAILABLE"]
    OK -->|"pilih pilar / cari / halaman"| TP["gmti.tempat (P)"]
    TP --> V{"size ≤ 200, page ≥ 1,<br/>pilar dikenal?"}
    V -- tidak --> E422["422 INVALID_PARAM"]
    V -- ya --> C{"cache?"}
    C -- ya --> L["daftar tempat<br/>sumber = cache"]
    C -- tidak --> D2["Data API 60 s"] -- sukses --> CW["simpan cache"] --> L
    D2 -- gagal --> E503P["503 UPSTREAM_UNAVAILABLE<br/>daftar: 'Gagal memuat daftar fasilitas ibadah (…).<br/>Muat ulang halaman untuk mencoba lagi.'"]
```
