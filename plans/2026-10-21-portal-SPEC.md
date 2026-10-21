# Spesifikasi desain: Portal Disparekraf (Nuxt + Laravel) di server Kominfo

Dokumen planner, 21 Okt 2026. Dibaca executor sebelum plan mana pun di batch `portal`.
Keputusan bertanda **[K-n]** boleh dibatalkan pemilik; plan mengikuti nilai default di sini
sampai ada keputusan lain yang tertulis di handoff.

Bahan bukti (dibaca, bukan disalin ulang di sini):
`plans/2026-10-21-portal-inventaris/A-shell-shared.md`, `B-dashboard.md`, `C-indikator.md`,
`D-atlas-gmti-spatial.md`, `E-sdi-api.md`, `F-lake-state.md`. Inventaris A–D dibuat terhadap
`a0580ba`; E terhadap `origin/main` `6b858eb`. Selisih kedua commit hanya menyentuh halaman
`/sdi/[slug]` dan `lib/secondary.ts`, jadi **baseline paritas = `6b858eb`** (yang tayang di
`dispar.rantai.dev`).

---

## 1. Tujuan dan batas

**Tujuan.** Membangun ulang app `platform-v2` (Next.js) sebagai aplikasi baru di repo terpisah:

- **Frontend Nuxt** dan **backend Laravel 10**, keduanya berjalan di server Disparekraf
  (Kominfo). Repo awalnya di GitHub, lalu pindah ke GitLab mereka.
- Halaman **semirip mungkin, idealnya persis**, dengan versi Next.js: tata letak, warna, teks,
  angka, perilaku interaksi.
- **Data tetap dari lakehouse kita** (ClickHouse di 192.168.18.148). Server Kominfo tidak
  menyimpan data pariwisata.
- **Oracle 19c hanya untuk data milik aplikasi**: log history, token klien, catatan job, dan
  snapshot cadangan respons.

**Di luar cakupan:**

- Fitur AI (`/ai`, `AiDock`, `/api/ai/*`, `features/ai/`, `lib/ai/`).
- Lakehouse itu sendiri. Ingest, Silver, Gold, dan Dagster tidak dipindah.
- Kode mati: `MapView.tsx`, `SouvenirMapView.tsx`, `CompassRose.tsx`.
- `/api/admin/sync`. Rute ini sudah mati, karena penarikan SDI adalah tugas Dagster.

**Syarat dari pihak Disparekraf (brief) dan cara memenuhinya:**

| Syarat | Dipenuhi oleh |
|---|---|
| Backend Laravel 10, frontend bebas (Nuxt bila diseragamkan) | §4, §5 |
| Arsitektur microservice, frontend hanya mengonsumsi API | Nuxt → Laravel saja; Laravel → Data API saja |
| Aturan API seragam: autentikasi, log history di tiap modul | §4.4, §4.5 |
| Oracle 19c, migrasi bisa dari dump SQL | §6; dump DDL + seed dihasilkan dari migration |
| CRON untuk mengambil data sendiri | §4.6, job `portal:sinkron` |
| Tidak boleh PATCH | §4.3, dijaga uji arsitektur |
| Data diagram, flowchart, unit test semua skenario, manual book, dokumentasi API | §8 dan plan 18 |
| Repo pindah ke GitLab | §9 dan plan 19 |

---

## 2. Arsitektur

```
 Browser
   │  (halaman + /_api/** lewat proxy Nitro, token tidak pernah ke browser)
   ▼
 [Nuxt SSR]  ───── server Kominfo ─────┐
   │  Authorization: Bearer <token klien "frontend">
   ▼                                   │
 [Laravel 10 API /api/v1/*] ───────────┘──► Oracle 19c
   │  - envelope, auth, log history         (USERS, PERSONAL_ACCESS_TOKENS,
   │  - cache + snapshot cadangan            LOG_HISTORY, JOB_RUNS, SNAPSHOT, CACHE)
   │  Authorization: Bearer <token layanan>
   ▼  HTTPS (Cloudflare)
 [Data API /v1/*]  ───── server kita (192.168.18.148, stack 6) ─────
   │  FastAPI, read-only, akun ClickHouse dispar_app
   ▼
 ClickHouse: serving.* · konform.* · silver.* · lake.`bronze_file.*` · lake.`bronze_meta*`
```

Prinsip yang tidak boleh dilanggar:

1. **Hanya Data API yang menulis SQL ke ClickHouse.** Laravel tidak punya driver ClickHouse.
2. **Data API mengembalikan data pada grain tampilan.** Nuxt dan Laravel tidak mengagregasi,
   tidak menggabung, dan tidak men-dedup. Merge GCI, dedup restoran, top-N, YoY, dan rata-rata
   semuanya dihitung di Data API. Pengecualian: dataset kecil (≤ ±3.000 baris) boleh
   difilter, dicari, dan diurutkan di browser bila halaman Next.js sekarang melakukannya.
3. **[K-1] Data API v1 meniru query dan logika Next.js sekarang persis**, dari tabel yang sama
   (`serving.mart_wisman`, view Silver yang sama, `bronze_file.*` hasil ekspor batch 1).
   Akibatnya angka di portal identik dengan yang tayang. Memindah sumber ke `konform.f_*` atau
   ke mart Gold batch 3 adalah pekerjaan batch 3, dengan pemeriksaan selisih yang eksplisit.
   Kontrak respons tidak berubah saat itu.
4. **Data API milik repo ini** (`lakehouse/data-api/`), bukan milik portal. Portal hanya
   memegang salinan OpenAPI-nya untuk uji kontrak.
5. **Server Kominfo tidak menjangkau LAN kita.** Data API dipublikasikan lewat Cloudflare
   Tunnel dengan hostname baru **[K-2] `data-api.rantai.dev`**, ditambah token layanan.
   ClickHouse tidak pernah dibuka ke internet.

---

## 3. Data API (repo ini, `lakehouse/data-api/`)

### 3.1 Teknologi

**[K-3]** Python 3.12 + FastAPI + `clickhouse-connect` + `uv` + `pytest`, sama dengan toolchain
`lakehouse/ingest`. Alasannya: lakehouse sudah Python, pemeliharanya sama, dan merge/dedup yang
sekarang di TS cukup ditulis ulang sekali di sini.

### 3.2 Struktur (per fitur, sama dengan pola portal)

```
lakehouse/data-api/
├─ pyproject.toml  uv.lock  Dockerfile  README.md
├─ openapi.yaml                  ← KONTRAK, ditulis tangan (plan 01), sumber kebenaran
├─ data_api/
│  ├─ main.py                    app FastAPI, pasang router tiap fitur
│  ├─ shared/
│  │  ├─ ch.py                   klien ClickHouse (pool, timeout, retry, penanda query)
│  │  ├─ auth.py                 Bearer token dari env DATA_API_TOKENS
│  │  ├─ errors.py               bentuk error tunggal + kode
│  │  ├─ paging.py               page/size/sort, batas 100.000 baris
│  │  ├─ filters.py              tata bahasa f= (port lib/ch/query-filter.ts)
│  │  ├─ cache.py                TTL in-process + invalidasi
│  │  ├─ hitungan.py             jumlah baris per tabel/slug (katalog, dataset-tematik, beranda)
│  │  ├─ indikator_sumber.py     daftar indikator (beranda, indikator)
│  │  └─ format.py               periode, angka, normalisasi teks
│  └─ features/
│     ├─ dataset/   router.py  service.py  queries.py  models.py
│     ├─ dashboard/ …
│     ├─ indikator/ …
│     ├─ atlas/     …
│     ├─ gmti/      …
│     ├─ spasial/   …
│     ├─ hotel_scraped/ …
│     └─ beranda/   …   (ringkasan beranda + katalog gabungan)
└─ tests/
   ├─ golden/                    keluaran logika Next.js (oracle paritas, lihat 3.6)
   ├─ unit/<fitur>/              logika murni: merge, dedup, agregasi, filter
   ├─ contract/                  setiap respons divalidasi ke openapi.yaml
   └─ panggung/                  uji live read-only ke .148, tidak masuk gate default
```

Aturan pemisahan: sebuah fitur tidak mengimpor fitur lain, `shared/` tidak mengimpor fitur, dan
SQL hanya ada di `queries.py`. Ketiganya dijaga oleh satu tes yang memindai impor.

### 3.3 Aturan umum endpoint

- **Metode.** Hanya `GET`, kecuali `POST /v1/admin/cache/flush`, yang dipanggil Dagster
  sesudah refresh.
- **Autentikasi.** `Authorization: Bearer <token>`. Token disimpan sebagai hash SHA-256 di env
  `DATA_API_TOKENS` (daftar `nama:hash`). `GET /v1/health` tanpa token.
- **Respons sukses:** `{ "data": …, "meta": { "generated_at", "source": [tabel…], "request_id", … } }`.
- **Respons error:** `{ "error": { "code", "message", "detail" } }`. Kode yang dipakai:
  `NOT_FOUND` 404, `INVALID_PARAM` 400, `INVALID_FILTER` 400, `TOO_LARGE` 413,
  `UNAUTHORIZED` 401, `UPSTREAM_UNAVAILABLE` 503.
- **Header.** `X-Request-Id` diterima lalu dipantulkan balik.
- **Penanda query.** Request id ditulis sebagai **komentar SQL** (`/* rid=<id> */ SELECT …`),
  **bukan** setting `log_comment`, karena profil `app_readonly` (`readonly=1`) menolak setiap
  setting sesi (CLAUDE.md).
- **Klien ClickHouse.**
  - Klien tidak boleh mengirim setting sesi apa pun dan tidak boleh membaca `system.*`, baik
    saat start maupun saat query. `use_query_cache=1` membuat query `system.*` gagal.
  - Pilihannya: HTTP polos (`httpx`) dengan `FORMAT JSONEachRow`, atau `clickhouse-connect`
    yang dibuktikan lulus di bawah `dispar_app` sebelum dipakai (plan 02 langkah 0).
- **Akun uji.** Tes panggung (plan 02–05) dijalankan **dengan akun `dispar_app` sungguhan**.
  `CH_APP_PASSWORD` dibaca saat dipakai dari Env stack 6 lewat Portainer (GET, hanya baca) dan
  disimpan hanya di env shell, tidak ke berkas. Emulasi `readonly=1` di akun `dispar` tidak
  cukup, karena tidak meniru query cache.
- **Proses.** Uvicorn **satu worker** (cache in-process dan flush hanya benar dengan satu
  worker); skala nanti lewat replika di belakang cache bersama, bukan sekarang.
- **Dokumentasi otomatis FastAPI** (`/docs`, `/redoc`, `/openapi.json`) **mati** kecuali
  `DATA_API_DOCS=1`. Kontrak publik adalah `openapi.yaml` di repo.
- **Token kosong.** Bila `DATA_API_TOKENS` kosong atau tidak ada, aplikasi menolak start.
- **Batas.** Profil `app_readonly` melempar error di atas 100.000 baris, jadi semua daftar besar
  wajib berhalaman. Ekspor di atas 100.000 baris mendapat `413 TOO_LARGE`.
- **Urutan baris.** Daftar tanpa `sort` tetap memakai urutan deterministik, yaitu kolom kunci
  atau `cityHash64` dari baris. Infinite scroll tidak boleh melompati atau menggandakan baris.
- **Tipe.** Bilangan dikirim sebagai angka JSON, bukan string. Tanggal ISO-8601. Kolom audit
  (`_ingested_at`, `_source_url`, `_batch_id`, `_row_hash`, `_tenant`) tidak pernah keluar.
- **Cache.** In-process dengan TTL per endpoint, dikosongkan oleh `POST /v1/admin/cache/flush`.

### 3.4 Daftar endpoint

Daftar lengkap, beserta bentuk data dan rujukan ke inventaris, ada di
`plans/2026-10-21-portal-KONTRAK.md`. Plan 01 mengubahnya menjadi `openapi.yaml` yang presisi.

### 3.5 Deploy

- Container baru `dispar-data-api` di stack 6 (`lakehouse/compose.yaml`), port host **13040**,
  network `lakenet`, akun `dispar_app`.
- Hostname Cloudflare diarahkan ke `localhost:13040`.
- Ini **operasi produksi** (plan 06) dan butuh "lanjut deploy" dari pemilik. Ketiga jebakan
  redeploy stack 6 di CLAUDE.md berlaku.
- Menambah hostname pada tunnel dilakukan pemilik. Executor hanya membaca konfigurasi tunnel.
- Hook flush cache di Dagster dan pembaruan daftar indikator di Bronze butuh **image Dagster
  baru**. `lake-dagster` adalah container standalone dan tidak tersentuh redeploy stack. Ini
  dikerjakan plan 06 bagian A.

### 3.6 Oracle paritas (golden)

Sumber kebenaran "angka harus sama" adalah **logika Next.js yang tayang**. Logika itu ada di
dua tempat: fungsi `lib/*` dan agregasi yang tertanam di komponen client (misalnya
`WismanStat`, `WisnusStat`, `PdrbEkrafStat`, `GciView`, yang memakai hook dan tidak
mengekspor fungsi). Karena itu oracle-nya berlapis.

**Lapis 1, golden Data API** (dipakai plan 01–05). Skrip `scripts/portal_golden.tsx`
dijalankan dari `platform-v2/` dengan `./node_modules/.bin/tsx --env-file=.env.local`, dan host
`CH_URL` ditimpa ke .148.

- Untuk logika di `lib/*`: impor dan panggil fungsinya langsung. Pengecualian: fungsi yang
  memakai `next/cache` (`lib/report.ts`, `unstable_cache`) tidak dipanggil; panggil fungsi murni
  di bawahnya (`computeReadiness`, bukan `getReadiness`).
- Untuk logika di komponen: **render komponen asli** dengan `react-dom/server`
  `renderToStaticMarkup`, memberi props yang sama dengan halaman server.
  - `echarts-for-react` dan peta di-alias (opsi `--tsconfig` / `paths` khusus skrip) ke stub
    yang **merekam prop `option`**.
  - Teks KPI diambil dari markup.
  - Untuk setiap endpoint, satu fungsi pemeta kecil di skrip mengubah rekaman `option` + KPI
    menjadi bentuk respons endpoint. Pemeta ini hanya memindah nilai, tidak menghitung.
  - Ini menangkap keadaan **default** halaman. Keadaan lain (filter, tahun lain) diuji di lapis
    2.
- Ada dua keluaran:
  - **Golden statis** untuk sumber `bronze_file.*`, ditulis ke
    `lakehouse/data-api/tests/golden/` dan di-commit.
  - **Golden live** untuk sumber Silver/serving, ditulis ke `tests/golden/live/` dengan cap
    waktu dan tidak di-commit. Tes `panggung/` membandingkannya dengan Data API yang dipanggil
    pada menit yang sama.

**Lapis 2, paritas DOM** (plan 11–17). Playwright membaca angka yang tampil di
`dispar.rantai.dev` dan di portal, termasuk setelah interaksi (filter, tahun, toggle). Ini
yang menutup keadaan non-default.

Aturan:

- `platform-v2/` **tidak diubah**. Skrip golden hanya mengimpor dan merender.
- Skrip golden diperiksa tipenya dengan `scripts/tsconfig.portal-golden.json`, yang mewarisi
  `platform-v2/tsconfig.json` (aturan CLAUDE.md: tsc wajib lulus).

---

## 4. Backend Laravel 10 (repo portal, `backend/`)

### 4.1 Versi

- PHP 8.2 dan Laravel 10.x, sesuai aturan Disparekraf.
  - Dukungan keamanan Laravel 10 berakhir Feb 2025, dan PHP 8.2 berakhir Des 2026. Ini dicatat
    di ADR dan dokumen serah terima sebagai risiko yang ditetapkan klien, bukan pilihan kita.
- Driver Oracle `yajra/laravel-oci8` ^10, butuh ekstensi PECL `oci8` 3.x untuk PHP 8.2 dan
  Oracle Instant Client 19. Versi persisnya disematkan di Dockerfile.
- Autentikasi: `laravel/sanctum`.
- Tes: Pest 2 dengan plugin arch, berjalan di atas PHPUnit 10.
- Dokumentasi API: `dedoc/scramble` atau `darkaonline/l5-swagger`. **[K-4] scramble**, karena
  dokumen dihasilkan dari kode sehingga tidak bisa basi. Pilih versi yang masih mendukung
  Laravel 10, lalu sematkan. Swagger UI dibuka di `/docs/api`; ekspor statis lewat
  `php artisan scramble:export`.

### 4.2 Struktur berbasis fitur

```
backend/
├─ app/
│  ├─ Features/
│  │  └─ <Fitur>/                      Dataset, Dashboard, Indikator, Atlas, Gmti,
│  │     │                             Spasial, HotelScraped, Beranda, Sistem
│  │     ├─ Http/Controllers/          tipis: Request → Service → Resource
│  │     ├─ Http/Requests/             validasi input (FormRequest)
│  │     ├─ Http/Resources/            bentuk JSON keluar
│  │     ├─ Services/                  logika fitur (memilih sumber, menyusun respons)
│  │     ├─ Contracts/<Fitur>Source.php   antarmuka sumber data
│  │     ├─ Sources/DataApi<Fitur>Source.php  implementasi lewat Shared\DataApi
│  │     ├─ Data/                      DTO (readonly class)
│  │     ├─ routes.php                 rute fitur, dimuat provider
│  │     └─ <Fitur>ServiceProvider.php bind Contract → Source, muat routes
│  └─ Shared/
│     ├─ DataApi/        DataApiClient (Http facade, timeout, retry, X-Request-Id),
│     │                  DataApiException, SnapshotStore
│     ├─ Http/           ApiResponse (envelope), ExceptionRenderer, middleware
│     │                  RequestId, ForceJson, RejectPatch (GLOBAL di Kernel, bukan di
│     │                  grup rute; rute tak cocok sudah 405 sebelum middleware grup)
│     ├─ Tetap/          BacaTetap: baca kelas T dari SNAPSHOT, isi bila kosong (§4.6);
│     │                  dipakai semua Sources kelas T sejak plan 12
│     ├─ Auth/           ability "read" / "admin", ServiceAccount seeder
│     ├─ LogHistory/     middleware LogRequest, model LogHistory, LogContext
│     ├─ Jobs/           JobRunRecorder, model JobRun
│     └─ Support/        Routing helper Route::apiGet/apiPost (tanpa PATCH), yang mengisi
│                        atribut rute `modul`, `kelas` (T/P/S), dan `varian` (daftar parameter
│                        tetap untuk sinkron, misalnya 28 kode indikator)
├─ config/dataapi.php, config/loghistory.php
├─ database/migrations/  hanya tabel milik app (§6)
├─ routes/api.php        prefix /api/v1, middleware global, memuat routes tiap fitur
└─ tests/
   ├─ Arch/              aturan pemisahan (§4.3)
   ├─ Feature/<Fitur>/   skenario HTTP; Data API dipalsukan (Http::fake + fixture)
   ├─ Unit/<Fitur>/      service, DTO, mapper
   ├─ Contract/          fixture Data API divalidasi ke openapi Data API
   └─ Fixtures/data-api/ openapi.yaml (salinan) + contoh respons per endpoint
```

### 4.3 Aturan pemisahan (dijaga `tests/Arch`)

1. `App\Features\X` tidak boleh memakai `App\Features\Y`.
2. `App\Shared` tidak boleh memakai `App\Features`.
3. Controller hanya memakai Request, Service, dan Resource. Controller tidak memakai `Http`,
   `DB`, atau `DataApiClient`.
4. Hanya `Sources/*` yang memakai `DataApiClient`. Service bergantung pada `Contracts/*`.
5. Tidak ada `DB::` atau Eloquent di `Features/*` selain `Sistem`. Persistensi lewat `Shared`.
6. Tidak ada rute PATCH. Uji membaca `Route::getRoutes()` dan gagal bila ada `PATCH`, termasuk
   yang terbawa `Route::resource`, `apiResource`, dan `match`. Middleware `RejectPatch`
   mengembalikan 405 sebagai pengaman kedua.
7. Tidak ada `env()` di luar `config/`.

### 4.4 Envelope, error, autentikasi

- **Sukses:** `{ "success": true, "message": "OK", "data": …, "meta": { …meta Data API,
  "request_id", "sumber": "data_api"|"cache"|"snapshot", "stale": bool } }`.
- **JSON diteruskan tanpa diubah bentuknya.**
  - `json_decode(…, true)` mengubah `{}` menjadi `[]` dan merusak paritas.
  - Karena itu `DataApiClient` mengembalikan `data` sebagai **string JSON mentah**, dan envelope
    disusun dengan menyisipkan string itu.
  - Bila Service perlu membaca isinya, ia men-decode sebagai objek (`json_decode($s, false)`)
    dan meng-encode ulang dengan `JSON_PRESERVE_ZERO_FRACTION | JSON_UNESCAPED_UNICODE |
    JSON_UNESCAPED_SLASHES`.
  - `SNAPSHOT` dan cache menyimpan string mentah.
  - Tes kontrak memastikan setiap fixture keluar byte-identik (setelah kunci diurutkan) dengan
    yang masuk.
- **Gagal:** `{ "success": false, "message": "<pesan Indonesia>", "errors": { "code": "…" },
  "meta": { "request_id" } }`. Status HTTP diteruskan dari Data API. Data API mati → 503,
  kecuali snapshot tersedia (§4.6).
- **Autentikasi.** Semua rute `/api/v1/*` wajib token Sanctum.
  - Token **frontend** (ability `read`) dipegang server Nuxt, tidak pernah dikirim ke browser.
  - Token **admin** (ability `admin`) untuk log dan pemicu job.
  - Akun layanan dibuat oleh seeder `ServiceAccountSeeder`. Token dibuat dengan
    `php artisan portal:token {nama} {ability}` dan hanya dicetak sekali.
- Tidak ada login pengguna dan tidak ada UI admin, karena CMS Disparekraf terpusat di
  `/cms/internal`. **[K-5]**
- **Parameter filter.** Laravel menerima `f[]=` karena PHP menelan `f=` yang berulang.
  `Sources` mengirimkannya ke Data API sebagai `f=` berulang, dengan query string dibangun
  `GuzzleHttp\Psr7\Query::build($q, false)`. `Http::get($url, $array)` menghasilkan `f[0]=`
  yang salah.
- **Pembatasan laju.** `throttle:api` per klien + IP, 120/menit bawaan, nilainya di config.
- **IP asli.** Nuxt meneruskan `X-Forwarded-For`; Laravel memakai `TrustProxies` untuk alamat
  server Nuxt. Tanpa ini `LOG_HISTORY.IP` selalu berisi IP Nuxt.

### 4.5 Log history (wajib di tiap modul)

- Middleware `LogRequest` dipasang global di grup `/api/v1`. Satu baris `LOG_HISTORY` per
  request berisi:

  | Kolom | Isi |
  |---|---|
  | `ID` | |
  | `REQUEST_ID` | |
  | `MODUL` | nama fitur, dari atribut rute |
  | `AKSI` | nama rute |
  | `METODE` | |
  | `PATH` | |
  | `PARAM_HASH` | SHA-256 dari query yang dinormalkan |
  | `PARAM_RINGKAS` | JSON ≤ 2.000 karakter, tanpa token |
  | `KLIEN` | nama akun layanan |
  | `IP` | |
  | `USER_AGENT` | |
  | `STATUS_HTTP` | |
  | `DURASI_MS` | |
  | `JUMLAH_BARIS` | |
  | `SUMBER` | `data_api` / `cache` / `snapshot` |
  | `DIBUAT_PADA` | |

- Penulisan dilakukan sesudah respons terkirim (`terminate`), jadi kegagalan log tidak pernah
  menggagalkan request. Kegagalan itu dicatat ke log berkas.
- **Ekspor selalu dicatat** bersama filter yang dipakai.
- Job (cron/manual) dicatat di `JOB_RUNS`: `JOB`, `PEMICU` (cron/manual), `KLIEN`, `MULAI`,
  `SELESAI`, `STATUS`, `RINGKASAN` (CLOB JSON).
- Admin membaca log lewat `GET /api/v1/sistem/log?modul&dari&sampai&page` dan
  `GET /api/v1/sistem/job`.
- Retensi 180 hari, dibersihkan job `portal:bersihkan-log` (mingguan). **[K-6]**
- Karena knowledge base Disparekraf belum bisa dilihat, seluruh perilaku log ada di satu modul
  `Shared/LogHistory`. Menyesuaikan dengan standar mereka nanti = mengubah satu tempat.

### 4.6 Cache, snapshot, CRON

| Kelas endpoint | Contoh | Perilaku |
|---|---|---|
| **Tetap** (tanpa parameter bebas) | dashboard, indikator, atlas, gmti ringkasan, spasial, katalog, beranda | Dibaca dari `SNAPSHOT`, yang diisi job `portal:sinkron`. Bila snapshot belum ada → panggil Data API, simpan, lalu kirim. |
| **Berparameter** | baris dataset, facets, aggregate, gmti daftar berhalaman | Cache Laravel (store `database` di Oracle) dengan TTL 5–60 menit. Bila Data API gagal → 503. |
| **Aliran** | ekspor dataset | Diteruskan apa adanya (stream). Tidak di-cache, selalu dicatat. Ada klien HTTP terpisah: timeout 300 s, tanpa retry, `stream => true`, header `X-Accel-Buffering: no`, dan timeout nginx/php-fpm yang cukup (plan 19). Perbedaan perilaku dengan sekarang: ekspor di atas batas memberi **413**, sedangkan Next.js menelan error dan memberi 404. Ini dicatat di manual. |

- Job `portal:sinkron`: harian **[K-7] 11:00 WIB**. Refresh Dagster berjalan 02:00 UTC
  (09:00 WIB); jam sinkron disimpan di config.
- Job itu memanggil setiap endpoint "tetap" dan meng-upsert `SNAPSHOT` (`KUNCI`, `ISI` CLOB
  JSON, `DIAMBIL_PADA`, `HASH`). Kegagalan per kunci tidak menghapus snapshot lama, dan
  hasilnya dicatat di `JOB_RUNS`.
- Respons dari snapshot memberi `meta.sumber = "snapshot"`, dan `meta.stale = true` bila
  umurnya lebih dari 36 jam.
- Logika baca kelas T (`Shared/Tetap/BacaTetap`) dibuat di plan 10 dan dipakai fitur sejak
  plan 12. Plan 16 hanya menambah job sinkron dan rute sistem.
- Inilah pemenuhan butir brief "CRON Job untuk crawling data dari sendiri": aplikasi mengambil
  datanya sendiri secara terjadwal dari sumber kita, bukan dari SDI.
- Pemicu manual: `POST /api/v1/sistem/job/sinkron` (ability `admin`).

---

## 5. Frontend Nuxt (repo portal, `frontend/`)

### 5.1 Versi

- **[K-8]** Nuxt 3.x terbaru yang masih didukung saat plan 10 dimulai. Kalau Nuxt 3 sudah EOL
  (kemungkinan besar per Okt 2026), pakai Nuxt 4. Struktur layers di bawah berlaku untuk
  keduanya; executor memeriksa status rilis di nuxt.com dan mencatat pilihannya di PR.
  - Di Nuxt 4, alias `~` menunjuk `app/`. Path CSS dan aset layer memakai path relatif layer
    atau `~~/`, bukan `~/layers/…`.
- Mode SSR aktif.
- Pustaka, disematkan pada versi yang **terpasang di `platform-v2` sekarang**:
  - `tailwindcss` 3.4.19. Jangan Tailwind 4, karena perilaku utilitasnya berbeda.
  - `echarts` 5.6.0 + `vue-echarts`.
  - `leaflet` 1.9.4 + `leaflet.markercluster` 1.5.3.
  - `lucide-vue-next` untuk ikon yang di React memakai `lucide-react` (`/scraped-hotels`).
  - Font `@fontsource-variable/plus-jakarta-sans` + `@nuxtjs/fontaine`. `next/font` membuat
    fallback dengan `size-adjust`; tanpa fontaine, pergeseran tata letak saat font dimuat bisa
    merusak ambang paritas 2%.
- `xlsx`: `platform-v2` memakai 0.18.5 dari npm, yang punya CVE dikenal dan bisa ditandai audit
  keamanan pemerintah. Pakai SheetJS 0.20.x dari `cdn.sheetjs.com` (tarball tersemat), dan
  buktikan berkas keluaran identik untuk satu ekspor contoh. Bila tidak identik, pakai 0.18.5
  dan catat risikonya di ADR.
- Tes:
  - Vitest + `@nuxt/test-utils` untuk composable dan builder opsi chart.
  - Playwright untuk e2e dan paritas.

### 5.2 Struktur: Nuxt layers per fitur

```
frontend/
├─ nuxt.config.ts            extends: ['./layers/shared', './layers/dataset', …]
├─ server/routes/_api/[...].ts  proxy Nitro /_api/** → Laravel /api/v1/**. Proxy ini
│                            menyisipkan token frontend, HANYA meneruskan GET, menolak path
│                            sistem/* (404), dan meneruskan X-Forwarded-For + X-Request-Id
├─ server/middleware/redirect-lama.ts  redirect lama (§5.4), termasuk 404 untuk key tak dikenal
├─ error.vue                 halaman 404/500 meniru 404 bawaan Next.js (paritas)
├─ layers/
│  ├─ shared/
│  │  ├─ assets/css/globals.css      SALIN PERSIS app/globals.css (§5.4)
│  │  ├─ tailwind.config.ts          SALIN PERSIS tailwind.config.ts (+ content path Vue)
│  │  ├─ public/                     logo, favicon, webmanifest, geo/dki-jakarta.geojson,
│  │  │                              ikon marker Leaflet lokal
│  │  ├─ layouts/default.vue, layouts/dashboard.vue
│  │  ├─ components/
│  │  │  ├─ app/        AppNav, DashboardSubnav, LangToggle, AtlasToolbar, PageFooter
│  │  │  ├─ ui/         KpiStat, Kpi, KpiRow, ChartGrid, SectionHead, SourceNote,
│  │  │  │              ModeToggle, RankedList, Badge*, ExportButton, RawDataDisclosure,
│  │  │  │              SdiTable, PariwisataShell, PageSection, HeroDark
│  │  │  ├─ chart/      ChartCard (expand), BarBreakdown, VerticalBars, GroupedBars,
│  │  │  │              GroupedLines, LineTrend, ComboBarLine, Donut, Treemap, BarChart
│  │  │  └─ map/        PointMap.client, VenueMap.client, SpatialMap.client
│  │  ├─ composables/   useApi (SATU-SATUNYA klien HTTP), useLang, useSpreadsheetExport,
│  │  │                 useChartExpanded, useBasemap
│  │  └─ utils/         format.ts (idfmt, idNum, parseIdNum, fmtPeriode, BULAN),
│  │                    palettes.ts, chart-options/*.ts (builder opsi ECharts murni),
│  │                    i18n-dict.ts (143 kunci id/en)
│  ├─ beranda/      pages/index.vue
│  ├─ dataset/      pages/katalog, pages/sdi/index, pages/sdi/[slug]; components; composables
│  ├─ dashboard/    pages/dashboard/** …
│  ├─ indikator/    pages/gci/**, pages/gpci/**, pages/readiness …
│  ├─ atlas/        pages/gci/pariwisata/{restoran-gci,direktori-restoran,pertunjukan-budaya},
│  │                pages/gpci/{lapangan-golf,toko-suvenir,hotel} …
│  ├─ gmti/         pages/gmti …
│  ├─ spasial/      pages/spatial …
│  ├─ hotel-scraped/ pages/scraped-hotels …
│  └─ docs/         pages/docs (tampilan sama, isi dari OpenAPI Laravel)
└─ tests/
   ├─ unit/<fitur>/            composable & builder opsi
   ├─ e2e/<fitur>.spec.ts      skenario interaksi
   └─ parity/                  §7
```

Pembagian rute ke layer mengikuti fitur pemilik data, bukan prefiks URL. Contohnya,
`/gci/pariwisata/restoran-gci` milik layer `atlas`, sedangkan `/gci/pariwisata/wisatawan-internasional`
milik layer `indikator`. Tabel rute lengkap → pemilik ada di KONTRAK §1.

### 5.3 Aturan pemisahan (ESLint `import/no-restricted-paths` + uji Vitest)

1. Layer fitur tidak mengimpor layer fitur lain. Komponen yang dipakai dua fitur pindah ke
   `shared`.
2. `shared` tidak mengimpor layer fitur.
3. Halaman (`pages/`) tidak memanggil `$fetch` atau `useFetch`. Data selalu lewat composable
   fitur `use<Fitur>()`, yang memakai `useApi`.
4. Komponen chart menerima data siap pakai. Tidak ada agregasi di komponen. Pengecualian:
   filter, cari, dan urut di klien yang memang dilakukan halaman Next.js atas dataset kecil.
5. Builder opsi ECharts adalah fungsi murni di `utils/chart-options/`, dan diuji dengan snapshot
   Vitest.

### 5.4 Aturan paritas visual (wajib)

- `globals.css` disalin byte-per-byte. **Utilitas buatan tangan** (`text-ink`, `bg-primary`,
  dan sejenisnya) **tetap CSS biasa** dan tidak dipindah ke tema Tailwind. Akibatnya
  `hover:`/`group-hover:` atas utilitas itu tetap tidak berefek, sama seperti sekarang
  (inventaris A §1.3).
- String kelas Tailwind disalin dari JSX ke template Vue apa adanya (`className` → `class`).
  Jangan "merapikan" kelas.
- Opsi ECharts disalin 1:1 dari komponen React ke builder di `utils/chart-options/`. Gradien
  memakai bentuk objek `{type:'linear',…}`.
- Tinggi chart, teks kosong, teks memuat, dan teks error sama persis.
- Leaflet:
  - Peta dasar Esri yang sama (`lib/basemap.ts`). `PointMap` tetap memakai OSM seperti sekarang.
  - **Ikon marker di-bundle lokal**, bukan dari unpkg.
  - **[K-9]** Bila jaringan Kominfo memblokir `services.arcgisonline.com`, fallback ke OSM dengan
    mendeteksi galat tile. Ini dicatat sebagai perbedaan yang diizinkan.
- Komponen `ssr:false` di Next.js menjadi `.client.vue` atau `<ClientOnly>`. Fallback-nya memakai
  teks memuat yang sama (misalnya "Memuat data…", "Memuat peta Spatial…").
- Bahasa: Indonesia di semua halaman. Toggle ID/EN hanya di direktori restoran, satu-satunya yang
  tampil sekarang. Kunci `localStorage` tetap `dpj.lang`.
- Redirect lama dipertahankan di `server/middleware/redirect-lama.ts`, bukan `routeRules`,
  karena sebagian harus 404 untuk key tak dikenal. Pemiliknya plan 10, satu tempat untuk semua
  redirect:
  - `/atlas` → `/spatial`
  - `/atlas/:section` → href section; key tak dikenal → 404
  - `/atlas/{restaurants,souvenir,golf}/map` → `/spatial`; section lain → 404
  - `/gmti/map` → `/spatial`
  - `/katalog/hotel` → `/gpci/hotel`
  - `/readiness` → `/gci`
- Status redirect sama dengan Next.js `redirect()` di server component (307). Plan 10
  memverifikasi status sebenarnya dengan `curl -I` ke produksi dan menirunya.
- Nav: hapus item "AI". Selebihnya sama.

### 5.5 Quirk dan bug yang terlihat sekarang

Default **[K-10]**: **tiru persis**. Satu-satunya yang diperbaiki adalah **P1–P5**; **P6
tetap ditiru** dan hanya dicatat. Daftar lengkap quirk ada di inventaris B §7 (Q1–Q22), D §0.5,
dan E §4.4. Di seluruh dokumen batch ini, "pengecualian paritas" berarti P1–P5 ditambah item
Nav "AI".

| # | Sekarang | Di portal | Alasan |
|---|---|---|---|
| P1 | Golf menampilkan teks literal `home.vol2_kicker` | tampilkan `LAPANGAN GOLF` | jelas salah ketik kunci |
| P2 | Tombol "Verifikasi sumber" (direktori restoran) memanggil `/api/refresh`, yang tidak ada, dan selalu gagal | sembunyikan tombol dan tautan `/api/restaurants` | memanggil endpoint yang tidak ada |
| P3 | Isi `/docs` menjelaskan API lama (`source: db\|snapshot\|live`) | tampilan sama, isi = API Laravel baru | isi basi |
| P4 | Beranda memakai angka beku (182 / 19.428 / 28 / 2) | angka dari `/v1/beranda/ringkasan` | angka beku tidak benar lagi; selisihnya di-whitelist di uji paritas |
| P5 | `/scraped-hotels` kosong karena `serving.mart_hotel_scraped_booking` 0 baris | **hanya halaman `/scraped-hotels`**: Data API membaca `bronze_file.booking_hotel_2026_09_15`; statistik tanpa jendela 7 hari. `/spatial` **tetap** membaca mart seperti sekarang (0 titik hotel-poc), sehingga total 4.825 titik tidak berubah | halaman tidak berguna bila kosong |
| P6 | `/spatial` memuat titik di luar Indonesia (Bali, Thailand, Eropa) | **tiru** (tidak diperbaiki); dicatat untuk batch 3 | butuh keputusan data, bukan UI |

---

## 6. Oracle 19c (data milik app saja)

Tabel memakai nama huruf besar, ≤ 30 karakter supaya aman untuk tooling lama, dan **tanpa
tipe BOOLEAN** (pakai `NUMBER(1)`). JSON disimpan di `CLOB` dengan `CHECK (… IS JSON)`. Kunci
utama memakai `GENERATED BY DEFAULT AS IDENTITY`.

| Tabel | Isi |
|---|---|
| `USERS` | akun layanan (`frontend`, `admin`). Tanpa password login; nama, email, dibuat_pada |
| `PERSONAL_ACCESS_TOKENS` | Sanctum |
| `LOG_HISTORY` | §4.5. Indeks (`MODUL`, `DIBUAT_PADA`), (`REQUEST_ID`) |
| `JOB_RUNS` | §4.5 |
| `SNAPSHOT` | §4.6. PK `KUNCI` (VARCHAR2 200) |
| `CACHE`, `CACHE_LOCKS` | store cache Laravel |
| `MIGRATIONS` | Laravel |

- **Nama.** Migration memakai nama huruf kecil tanpa kutip, sehingga Oracle menyimpannya huruf
  besar. Jangan pernah memakai identifier berkutip.
- **Kunci.** Ikuti default yajra (sequence + trigger) untuk kolom `id()`. Jangan campur dengan
  `IDENTITY`. Catat di ADR.
- **Dump SQL** (syarat brief). `php artisan schema:dump` **tidak** mendukung Oracle. Plan 10
  membuat `scripts/oracle-dump.sh`, yang memakai `DBMS_METADATA.GET_DDL` untuk tabel, indeks,
  sequence, dan trigger milik skema app, lalu menulis `database/oracle/portal-ddl.sql`. Seed
  akun layanan ditulis sebagai `portal-seed.sql` tanpa token. CI memeriksa bahwa dump bisa
  diterapkan ke skema kosong.
- **Dev/CI:** `gvenzl/oracle-xe:18-slim`, versi gratis yang paling dekat dengan 19c, karena
  image 19c resmi butuh login Oracle. Satu job CI tambahan menjalankan migration di
  `gvenzl/oracle-xe:21-slim` agar kompatibilitas maju terlihat. Tidak ada fitur di atas 19c,
  dijaga oleh grep terhadap daftar terlarang: `BOOLEAN`, `JSON` sebagai tipe kolom, `IF [NOT]
  EXISTS`, `SQL_MACRO`.

---

## 7. Paritas: definisi "mirip/persis" yang bisa diuji

Satu suite Playwright `tests/parity/` (plan 17) membuka **setiap rute** di dua tempat, yaitu
`https://dispar.rantai.dev` dan portal (lokal atau staging), pada waktu yang sama:

1. **Visual.** Tangkapan layar halaman penuh pada lebar 1440×900 dan 390×844, setelah font dan
   chart selesai dirender (tunggu event `finished` ECharts dan tile Leaflet `load`). Area
   dinamis (tile peta, kursor) di-mask.
   - Ambang beda piksel ≤ **2%** per halaman.
   - Halaman dengan peta penuh (`/spatial`) diukur pada panel UI saja. Iframe Google Maps di-mask.
   - Pengecualian yang diizinkan hanya P1–P5 dan item Nav "AI". Masing-masing punya mask atau
     catatan tertulis di suite.
   - Dijalankan **sesudah `portal:sinkron` hari itu** (setelah 11:00 WIB). Antara 09:00 dan
     11:00 WIB produksi sudah memakai data baru sementara snapshot portal belum, sehingga
     selisih di jendela itu bukan kegagalan.
   - Paritas dijalankan **lokal**, tidak di CI, karena butuh produksi dan Data API sungguhan.
     CI menjalankan e2e melawan server fixture (plan 10).
2. **Angka.** Ekstrak semua teks angka dari DOM (KPI, label tabel, judul) dan bandingkan
   himpunannya. Harus identik, kecuali yang di-whitelist P4.
3. **Interaksi.** Untuk tiap filter, toggle, tab, cari, ekspor, dan expand chart yang ada di
   Next.js, ada skenario e2e yang sama di portal. Hasilnya dibandingkan dengan cara yang sama.

Laporan paritas (HTML Playwright + ringkasan Markdown) adalah lampiran wajib PR plan 17 dan
masuk ke dokumen serah terima.

---

## 8. Dokumen yang wajib diserahkan (plan 18)

Disimpan di `docs/` repo portal sebagai Markdown + Mermaid, lalu diekspor ke PDF/DOCX:

| Dokumen | Isi | Sumber |
|---|---|---|
| Data diagram | ERD Oracle (§6); diagram alir data lakehouse → Data API → Laravel → Nuxt; kamus data per endpoint | migration + OpenAPI |
| Flowchart | satu per fitur (alur request, cache/snapshot, error); satu untuk `portal:sinkron`; satu untuk autentikasi | kode |
| Unit testing | daftar skenario per fitur (ID, deskripsi, file tes, status), laporan JUnit + cakupan dari CI | Pest + Vitest + Playwright |
| Manual book | panduan pengguna per halaman dengan tangkapan layar Playwright, panduan admin (token, log, job), panduan operasi (deploy, env, cron, pemulihan) | tangkapan otomatis |
| Dokumentasi API | Swagger UI Laravel (`/docs/api`) + `openapi.json` yang dibekukan per rilis + halaman `/docs` di Nuxt | scramble |
| Data API (pelengkap) | `openapi.yaml` Data API, daftar skenario tesnya, panduan operasi (token, rotasi, flush, batas baris). Disertakan karena portal bergantung padanya | repo lakehouse |

ADR repo portal juga mencatat **tafsiran kita** atas dua butir brief yang belum bisa
dikonfirmasi ke klien, yaitu "microservice" dan "log history per modul", supaya mudah disesuaikan
bila knowledge base mereka berbeda.

---

## 9. Repo portal dan alur kerja

- Nama **[K-11]** `dispar-portal`, monorepo `backend/` + `frontend/` + `docs/` + `deploy/`.
- Repo GitHub private dibuat pemilik sebelum plan 10; executor tidak membuat repo publik.
- Kemudian dipindah ke GitLab Disparekraf (plan 19). Riwayat commit ikut, lewat
  `git push --mirror`.
- CI ditulis sebagai `.gitlab-ci.yml` (target akhir) **dan** `.github/workflows/ci.yml`
  (selama di GitHub), dengan job yang sama:
  - `backend`: pint, Pest dengan Oracle XE service
  - `frontend`: eslint, vue-tsc, Vitest
  - `e2e`: Playwright melawan Data API palsu
- Pesan commit dan dokumen dalam Bahasa Indonesia, bentuk `type(scope): …`, mengikuti repo ini.
- `deploy/` berisi Dockerfile `backend` (php-fpm + nginx + Instant Client), Dockerfile
  `frontend` (Node 20, `.output`), `compose.yaml` contoh, dan `.env.example` dengan placeholder
  saja. Cara deploy di server Kominfo belum diketahui; paket ini netral (container atau bare
  metal).
- **Tidak ada secret di repo mana pun.** Token Data API ada di env server Kominfo dan di Env
  stack 6; nilainya hanya diserahkan langsung ke pemilik.
