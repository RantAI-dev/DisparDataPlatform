# API portal

| Berkas | Isi |
|---|---|
| `laravel-openapi.json` | ekspor Scramble dari kode (`php artisan scramble:export`). CI backend gagal bila berbeda dengan kode |
| `openapi.json` | versi **beku** untuk serah terima/rilis: salinan `laravel-openapi.json` saat `scripts/ekspor-dokumen.sh` dijalankan |
| `laravel-openapi.draft.yaml` | draf awal dari repo lakehouse (plan 01); sejarah, bukan acuan |
| `data-api.openapi.yaml` | kontrak Data API, salinan dari repo lakehouse (`scripts/salin-openapi.sh`, SHA di baris pertama) |

Tampilan:

- Swagger/Elements Laravel di `/docs/api` (Scramble) memuat **semua** rute, termasuk `sistem/*`.
- Halaman `/docs` di Nuxt dibangkitkan dari `laravel-openapi.json` lewat `npm run docs:api` dan
  **menyaring** `sistem/*` (DS-F08), karena rute itu hanya untuk operator.

## Aturan

**Alamat.** Semua rute di `/api/v1/…`. Hanya `GET` dan `POST`; **tidak ada PATCH** (dijawab 405
oleh middleware `RejectPatch`), juga tidak ada PUT/DELETE. `POST` hanya untuk aksi admin
(`sistem/job/sinkron`, `sistem/cache/kosongkan`).

**Autentikasi.** Bearer token Sanctum di header `Authorization`. Ability `read` untuk rute fitur,
`admin` untuk `sistem/*`; `sistem/kesehatan` publik. Token dibuat `php artisan portal:token`.
Tanpa token → 401, ability salah → 403. Rincian: [../flowchart/autentikasi.md](../flowchart/autentikasi.md).

**Parameter berulang** ditulis `f[]=a&f[]=b` (PHP menelan `f=` berulang). Laravel meneruskannya ke
Data API sebagai `f=a&f=b`. Parameter di luar kontrak (nilai di luar daftar, `size` terlalu besar,
format tanggal salah) → 422 tanpa memanggil Data API.

**Envelope sukses.**

```json
{
  "success": true,
  "message": "OK",
  "data": { "…": "isi Data API, diteruskan byte-identik" },
  "meta": { "…": "meta Data API", "request_id": "…", "sumber": "data_api|cache|snapshot", "stale": false }
}
```

`data` tidak pernah diubah bentuknya (objek kosong tetap `{}`). `meta.sumber` menyebut dari mana
jawaban datang; `meta.stale = true` bila snapshot lebih tua dari 36 jam.

**Envelope gagal.**

```json
{ "success": false, "message": "<pesan Indonesia>", "errors": { "code": "NOT_FOUND" }, "meta": { "request_id": "…" } }
```

422 menambah `errors.fields` (pesan per parameter). Daftar kode error lengkap:
[../flowchart/autentikasi.md](../flowchart/autentikasi.md#kode-error).

**Ekspor** (`GET dataset/{slug}/ekspor`) bukan JSON: body berkas CSV/XLSX dialirkan, dengan header
`Content-Disposition`, `X-Row-Count`. Di atas 100.000 baris → 413 `TOO_LARGE`.

**Batas laju.** 120 request/menit per klien + IP (`PORTAL_BATAS_PER_MENIT`); di atasnya 429 dengan
`Retry-After`.

**Request ID.** Kirim `X-Request-Id` untuk menelusuri satu request; bila tidak, Laravel membuatnya.
Nilainya kembali di header respons dan `meta.request_id`, dan diteruskan ke Data API.

**Log.** Setiap request `/api/*` tercatat di `LOG_HISTORY` (termasuk 404/405 dan ekspor beserta
filternya). Parameter bernama `token`, `api_token`, `access_token`, `password` tidak pernah
dicatat. Rincian: [../flowchart/log-history.md](../flowchart/log-history.md).
