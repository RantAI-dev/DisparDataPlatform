# Flowchart indikator

Layer Nuxt `indikator`, fitur Laravel `Features/Indikator`. Pola baca umum: [README.md](README.md).

Rute halaman: `/gci`, `/gpci`, `/gci/[code]`, `/gpci/[code]`, `/gci/pariwisata/wisatawan-internasional`,
`/gci/pariwisata/kuliner-michelin`, `/gci/pariwisata/seni-pertunjukan`.

Semua rute memanggil Data API dengan satu percobaan 60 s (`DATA_API_TIMEOUT_LAMBAT`): pemilihan
dataset indikator di Data API bisa belasan detik saat cache-nya dingin. Hasil kelas T disimpan di
snapshot, jadi pengunjung biasanya tidak menunggu.

| Rute API (nama) | Laravel `GET /api/v1/…` | Kelas |
|---|---|---|
| `indikator.daftar` | `indikator?framework` | T (varian `GCI`, `GPCI`) |
| `indikator.detail` | `indikator/{code}` | T (varian 28 kode) |
| `indikator.gci-resmi` | `gci/resmi` | T |
| `indikator.dataset-tematik` | `dataset-tematik?framework` | T (varian `GCI`, `GPCI`) |
| `indikator.wisatawan-internasional` | `pariwisata/wisatawan-internasional` | T |
| `indikator.kuliner-michelin` | `pariwisata/kuliner-michelin` | T |
| `indikator.seni-pertunjukan` | `pariwisata/seni-pertunjukan?tahun` | P |

```mermaid
flowchart TD
    P1["GET /gci atau /gpci"] --> A["indikator.daftar + gci-resmi + dataset-tematik"]
    P2["GET /gci/CODE atau /gpci/CODE"] --> B["indikator.detail"]
    P3["GET /gci/pariwisata/…"] --> C["wisatawan-internasional / kuliner-michelin<br/>seni-pertunjukan (tahun)"]
    A --> T{"SNAPSHOT?"}
    B --> T
    C -->|"kelas T"| T
    C -->|"seni-pertunjukan, kelas P"| K{"cache?"}
    T -- ya --> OK["render<br/>sumber = snapshot, stale bila > 36 jam"]
    T -- tidak --> D["Data API 60 s, tanpa ulang"]
    K -- ya --> OK
    K -- tidak --> D
    D -- sukses --> W["simpan snapshot / cache"] --> OK
    D -- "404 kode tak dikenal" --> NF["halaman 404 Nuxt<br/>(9 kode tanpa data tetap 200: 'belum tersedia')"]
    P1 & P2 & P3 -.->|"framework / tahun tak valid"| E422["422 INVALID_PARAM"]
    D -- "timeout / mati" --> E503["503 UPSTREAM_UNAVAILABLE"]
```

Kode GCI dan GPCI saling diterima (`/gpci/CE1`, `/gci/CI-FV`) seperti di Next.js; tidak ada redirect.
