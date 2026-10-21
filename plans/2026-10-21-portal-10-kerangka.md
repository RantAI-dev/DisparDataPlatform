# Plan 10 — Portal: kerangka monorepo, shared backend/frontend, Oracle, CI (needs 01)

Repo: `dispar-portal` (baru; dibuat pemilik). Branch `feat/kerangka`.
Commit: `feat: kerangka portal laravel nuxt oracle`.

**STOP sebelum mulai** bila repo belum ada atau executor tidak punya akses push.
Plan 10–19 **tidak** butuh "lanjut deploy". Semuanya berjalan lokal.

## Hasil akhir

- Monorepo yang bisa dijalankan lokal dengan satu perintah.
- Memuat semua bagian `Shared` / `layers/shared` dari SPEC §4–§6.
- Belum memuat fitur, kecuali `Sistem/kesehatan`, yang membuktikan rantai penuh
  Nuxt → proxy Nitro → Laravel → Data API (lokal atau fixture) dan Oracle.

## Struktur yang dibuat

```
dispar-portal/
├─ README.md            Bahasa Indonesia: arsitektur singkat, cara jalan, aturan pemisahan
├─ CONTRIBUTING.md      alur PR, gaya commit type(scope), gate lokal
├─ compose.dev.yaml     oracle (gvenzl/oracle-xe:18-slim), backend (php-fpm+nginx),
│                       frontend (node 20), fixture-server (lihat "Server fixture")
├─ backend/             Laravel 10 (SPEC §4.2)
├─ frontend/            Nuxt (SPEC §5.2)
├─ fixtures/data-api/   rekaman respons Data API (path+query → status, header, body)
├─ tools/fixture-server/  server kecil pemutar rekaman, plus perekamnya
├─ docs/
│  ├─ api/data-api.openapi.yaml       salinan dari repo lakehouse plan 01 (+ SHA sumber)
│  ├─ api/laravel-openapi.draft.yaml  salinan draf plan 01
│  └─ adr/0001-arsitektur.md          keputusan K-1..K-12 + alasan + risiko versi (SPEC §4.1)
│                                     + tafsiran "microservice" dan "log per modul" (SPEC §8)
├─ deploy/              kosong + README (diisi plan 19)
├─ scripts/oracle-dump.sh
├─ .github/workflows/ci.yml
└─ .gitlab-ci.yml       job identik (SPEC §9)
```

## Server fixture (pengganti mock statis)

Mock statis dari OpenAPI (Prism) tidak bisa melayani skenario filter atau paging. Karena itu:

- `tools/fixture-server/rekam` memanggil Data API **lokal** (plan 02–05, dijalankan dengan
  `uv run`) untuk daftar URL yang diturunkan dari skenario e2e, lalu menyimpan responsnya ke
  `fixtures/data-api/`.
- `tools/fixture-server/putar` melayani rekaman itu. Kunci rekaman adalah path dan query yang
  dinormalkan. URL tak terekam → 599 + pesan jelas.
- CI dan e2e memakai `putar`. Paritas (plan 17) memakai Data API sungguhan, **lokal saja**.

## Backend: isi kerangka

1. Laravel 10 (`composer create-project laravel/laravel:^10`), PHP 8.2. Tambahkan:
   - `yajra/laravel-oci8:^10`, `laravel/sanctum`;
   - `dedoc/scramble` (versi yang mendukung L10, disematkan);
   - `pestphp/pest:^2` + `pest-plugin-laravel` + `pest-plugin-arch`, `laravel/pint`.
2. **Oracle.**
   - Koneksi `oracle` jadi default. Migration sesuai SPEC §6: nama huruf kecil tanpa kutip,
     sequence + trigger default yajra, JSON di CLOB + `IS JSON`, tanpa BOOLEAN.
   - Migration bawaan yang tidak dipakai dihapus.
   - `scripts/oracle-dump.sh` (DBMS_METADATA) → `database/oracle/portal-ddl.sql` + `portal-seed.sql`.
   - CI menerapkan dump ke skema kosong.
   - Grep fitur terlarang (SPEC §6) dijalankan di CI.
3. **`app/Shared/`** sesuai SPEC §4.2:
   - `DataApiClient`:
     - mengembalikan body **string JSON mentah** (SPEC §4.4);
     - timeout 10 s, retry 2× hanya untuk 5xx/timeout;
     - query dibangun dengan `Query::build($q, false)`;
     - meneruskan `X-Request-Id`;
     - memetakan error ke `DataApiException(code, status)`.
   - `DataApiStream`: klien ekspor terpisah (timeout 300 s, tanpa retry, stream).
   - `ApiResponse`: envelope dengan menyisipkan string JSON.
   - `ExceptionRenderer`: envelope SPEC §4.4; validasi → 422 `errors.fields`.
   - Middleware:
     - **RejectPatch global** di `Kernel::$middleware`;
     - RequestId, ForceJson;
     - LogRequest (tulis di `terminate`);
     - `throttle:api`;
     - `TrustProxies`, dengan alamat Nuxt dari config.
   - `SnapshotStore` dan `Tetap/BacaTetap`. Logika baca kelas T lengkap, termasuk `meta.sumber`
     dan `stale` (SPEC §4.6).
   - `JobRunRecorder`.
   - `Support/Routing`: makro `Route::apiGet/apiPost` dengan atribut `modul`, `kelas`, dan
     `varian`.
4. **Auth.**
   - Sanctum dengan ability `read` dan `admin`.
   - `ServiceAccountSeeder`.
   - `portal:token {akun} {ability}` mencetak token sekali dan tidak pernah mencatatnya.
5. Fitur contoh `app/Features/Sistem`: `GET /api/v1/sistem/kesehatan` (publik), yang
   mengecek Oracle, Data API `/v1/health`, dan versi app.
6. Scramble di `/docs/api` dan `/docs/api.json`.

## Frontend: isi kerangka

1. Nuxt (SPEC K-8; catat versi dan alasannya di PR), TypeScript strict.
   - Pustaka disematkan sesuai SPEC §5.1: Tailwind 3.4.19, echarts 5.6.0, leaflet 1.9.4,
     markercluster 1.5.3, lucide-vue-next, fontsource + `@nuxtjs/fontaine`.
   - `xlsx`: SheetJS 0.20.x bila keluarannya identik; bila tidak, 0.18.5 + catatan ADR.
2. `layers/shared` **lengkap**, sesuai tabel "Shared building blocks" di inventaris A (akhir
   berkas):
   - `globals.css` byte-per-byte dari `platform-v2/app/globals.css` @ `6b858eb`;
   - tailwind config, aset `public/` (termasuk ikon marker Leaflet lokal);
   - AppNav (tanpa item AI), DashboardSubnav, layout default dan dashboard;
   - semua komponen chart + ChartCard expand, KpiStat/Kpi/KpiRow/ChartGrid, SectionHead,
     SourceNote, ModeToggle, RankedList, ExportButton + useSpreadsheetExport, SdiTable,
     RawDataDisclosure, PariwisataShell/PageSection, HeroDark;
   - PointMap/VenueMap/SpatialMap `.client.vue` + useBasemap (fallback OSM, K-9);
   - LangToggle/useLang + kamus 143 kunci;
   - `utils/format.ts`, `utils/palettes.ts`, `utils/chart-options/*`.
3. Proxy `server/routes/_api/[...].ts`:
   - meneruskan **GET saja** ke Laravel `/api/v1/**`;
   - menyisipkan token frontend dari `runtimeConfig` (server-only);
   - menolak `sistem/*` (404);
   - meneruskan `X-Forwarded-For` dan `X-Request-Id`.
4. `useApi()`: SSR memanggil Laravel langsung; browser memanggil `/_api/**`. Envelope dibuka
   dan error dilempar sebagai `ApiError(code, message, status)`.
5. `server/middleware/redirect-lama.ts`:
   - **semua** redirect lama (SPEC §5.4), termasuk 404 untuk key tak dikenal;
   - status disamakan dengan hasil `curl -I` ke produksi (tulis hasilnya di PR).
6. `error.vue` meniru halaman 404 bawaan Next.js produksi. Ambil tangkapan layar
   `https://dispar.rantai.dev/tidak-ada` sebagai acuan.
7. `nuxt.config.ts`: `app.head` (judul, meta, favicon, manifest dari A §1.1). Path CSS
   mengikuti catatan Nuxt 4 di SPEC §5.1.
8. Halaman sementara `/_kerangka` (dihapus di plan 17): galeri semua komponen shared dengan
   data contoh dari golden plan 01.

## Aturan pemisahan yang dipasang di plan ini (gagal = CI merah)

- Backend `tests/Arch/*`: SPEC §4.3 butir 1–7, dengan mutation check (fitur palsu
  `Features/Contoh` di fixture tes dibuktikan ditolak).
- Frontend:
  - ESLint `import/no-restricted-paths` per layer (SPEC §5.3);
  - `tests/unit/arsitektur.spec.ts` memindai `layers/*/pages/**` untuk `$fetch`/`useFetch`.

## Test

**Backend (Pest),** dengan Data API dipalsukan memakai `Http::fake` + `fixtures/data-api`:

- envelope sukses dan gagal;
- **fixture keluar byte-identik** (setelah kunci diurutkan), termasuk `{}` kosong, map berkunci
  `"0"`, dan float `1.0`;
- request id dibuat bila tidak ada dan diteruskan bila ada;
- PATCH → 405 (global), ditambah tes daftar rute;
- tanpa token → 401, ability salah → 403, throttle → 429;
- `LOG_HISTORY` satu baris per request, dengan IP asli dari `X-Forwarded-For` tepercaya;
- kegagalan tulis log tidak menggagalkan respons;
- `DataApiClient`: retry hanya untuk 5xx, timeout menjadi 503;
- `f[]` dikirim sebagai `f=` berulang;
- `BacaTetap`: snapshot ada, snapshot basi (`stale`), snapshot kosong + Data API ok, snapshot
  kosong + Data API mati → 503;
- `JobRunRecorder`;
- migration naik-turun di XE 18, dan dump bisa diterapkan.

**Proxy Nuxt (Vitest/Nitro):**

- POST → 405;
- `sistem/kesehatan` → 404;
- token tidak pernah muncul di respons ke browser.

**Frontend (Vitest):**

- `format.ts`;
- snapshot setiap builder opsi chart. Snapshot pertama dibandingkan sekali dengan opsi yang
  direkam skrip golden plan 01 untuk komponen yang sama. Bukti cocoknya ditempel di PR.

**Playwright:** `/_kerangka`, satu redirect lama, dan `error.vue` dirender tanpa error konsol.

## Gate lokal

```bash
docker compose -f compose.dev.yaml up -d oracle fixture-server
cd backend && composer install && vendor/bin/pint --test && php artisan migrate:fresh --seed && vendor/bin/pest
cd frontend && npm ci && npm run lint && npx vue-tsc --noEmit && npx vitest run && npx playwright test tests/e2e/kerangka.spec.ts
```

CI GitHub harus hijau dengan job yang sama, ditambah job migration di XE 21.
`.gitlab-ci.yml` divalidasi dengan `gitlab-ci-local --list`, atau cara lain yang ditulis di PR.

## Kriteria selesai

1. `docker compose -f compose.dev.yaml up`, lalu `http://localhost:3000/_kerangka` menampilkan
   semua komponen.
   - Tangkapan layarnya ditempel di PR, berdampingan dengan komponen yang sama di
     `dispar.rantai.dev`.
2. `GET /api/v1/sistem/kesehatan` → Oracle dan Data API `ok`.

## STOP

- `yajra/laravel-oci8` tidak bisa terpasang dengan Laravel 10 + PHP 8.2.
- Nuxt yang dipilih tidak bisa memakai Tailwind 3.4.

## Bukan cakupan

Halaman fitur (11–15), job sinkron (16).
