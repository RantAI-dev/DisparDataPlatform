# Flowchart autentikasi

SPEC §4.4. Tidak ada login pengguna: yang memegang token adalah **akun layanan** (`USERS`), dibuat
`ServiceAccountSeeder`. Token Sanctum dibuat `php artisan portal:token {akun} {read|admin}` dan
hanya dicetak sekali (yang disimpan di `PERSONAL_ACCESS_TOKENS` adalah hash-nya).

| Pemegang | Ability | Dipakai untuk |
|---|---|---|
| server Nuxt (`NUXT_FRONTEND_TOKEN`) | `read` | semua rute fitur, lewat SSR dan proxy `/_api` |
| operator | `admin` | `sistem.log`, `sistem.job`, `sistem.job.sinkron`, `sistem.cache.kosongkan` |
| publik, tanpa token | — | `sistem.kesehatan` saja |

Token **tidak pernah** sampai ke browser: SSR memanggil Laravel langsung dari server, browser
memanggil proxy Nitro `/_api/**` yang menyisipkan token.

```mermaid
flowchart TD
    B["Browser"] --> PX["Nuxt /_api/**"]
    PX --> M{"metode GET/HEAD?"}
    M -- tidak --> E405["405 METHOD_NOT_ALLOWED"]
    M -- ya --> SG{"segmen pertama 'sistem',<br/>'.', '..', atau / tersembunyi?"}
    SG -- ya --> E404["404 NOT_FOUND<br/>(rute admin tidak dibuka lewat browser)"]
    SG -- tidak --> FW["teruskan ke /api/v1/** + Bearer token frontend<br/>+ X-Forwarded-For + X-Request-Id"]
    SSR["Nuxt SSR"] --> FW2["/api/v1/** + Bearer token frontend"]
    OP["operator (curl)"] --> FW3["/api/v1/sistem/** + Bearer token admin"]
    FW & FW2 & FW3 --> PATCH{"PATCH?"}
    PATCH -- ya --> E405b["405 (RejectPatch)"]
    PATCH -- tidak --> TH{"grup api: throttle<br/>120/menit per klien + IP"}
    TH -- lewat --> E429["429 TOO_MANY_REQUESTS + Retry-After"]
    TH -- ok --> AU{"rute butuh token?<br/>(semua kecuali sistem.kesehatan)"}
    AU -- tidak --> H["jalankan"]
    AU -- ya --> TK{"token Sanctum valid?"}
    TK -- tidak --> E401["401 UNAUTHORIZED"]
    TK -- ya --> AB{"ability cocok?<br/>read untuk fitur, admin untuk sistem"}
    AB -- tidak --> E403["403 FORBIDDEN"]
    AB -- ya --> H
    H --> LOG["LogRequest.terminate → LOG_HISTORY<br/>(KLIEN = nama akun layanan)"]
    PX -. "Laravel mati" .-> E503["503 UPSTREAM_UNAVAILABLE"]
    PX -. "Laravel > 330 s" .-> E504["504 GATEWAY_TIMEOUT"]
```

## Kode error

Semua error `/api/*` dalam envelope gagal `{success: false, message, errors: {code}, meta: {request_id}}`
(`App\Shared\Http\ExceptionRenderer`).

| HTTP | `errors.code` | Kapan |
|---|---|---|
| 401 | `UNAUTHORIZED` | token tidak ada atau tidak valid |
| 403 | `FORBIDDEN` | token tidak punya ability rute |
| 404 | `NOT_FOUND` | alamat tidak ada, atau Data API menjawab 404 (slug/kode/titik tak dikenal) |
| 405 | `METHOD_NOT_ALLOWED` | metode tidak diizinkan (termasuk semua PATCH) |
| 409 | `JOB_BERJALAN` | `sistem.job.sinkron` saat sinkron lain masih berjalan |
| 413 | `TOO_LARGE` | ekspor di atas batas baris Data API |
| 422 | `INVALID_PARAM` | parameter di luar kontrak; rincian di `errors.fields` |
| 429 | `TOO_MANY_REQUESTS` | batas laju terlampaui |
| 4xx lain | kode dari Data API | mis. 400 `INVALID_FILTER` |
| 502 | `UPSTREAM_AUTH` | token layanan Data API di server portal salah |
| 502 | `UPSTREAM_UNAVAILABLE` | Data API mengirim JSON yang tidak valid |
| 503 | `UPSTREAM_UNAVAILABLE` | Data API tidak terjangkau dan tidak ada snapshot |
| 500 | `INTERNAL` | kesalahan lain di server |
