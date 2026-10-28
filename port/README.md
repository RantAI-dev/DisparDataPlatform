# Portal Disparekraf (Nuxt + Laravel) — kerangka

Kode portal baru untuk server Kominfo, dari batch `plans/2026-10-21-portal-*` (plan 10–19).
Repo tujuan `dispar-portal` belum dibuat, jadi untuk sementara kode tinggal di folder `port/`
repo ini. Isinya dirancang berdiri sendiri supaya bisa dipindah utuh.

```
Browser → Nuxt (frontend/) → Laravel 10 (backend/) → Data API (lakehouse/data-api/) → ClickHouse
                                     └→ Oracle (tabel milik app: log, snapshot, token)
```

Rancangan lengkap: `plans/2026-10-21-portal-SPEC.md` dan `plans/2026-10-21-portal-10-kerangka.md`.

## Menjalankan lokal

Kebutuhan: Docker dan Node 20+. PHP dan Composer tidak perlu dipasang di laptop; semua lewat
image `backend/Dockerfile` (PHP 8.2 + Oracle Instant Client 19 + oci8).

```bash
cd port
docker compose -f compose.dev.yaml up -d oracle          # Oracle XE 18, ±1 menit sampai healthy
docker compose -f compose.dev.yaml run --rm backend php artisan migrate:fresh --seed --force
docker compose -f compose.dev.yaml run --rm backend php artisan portal:token frontend read   # token dicetak sekali
cd frontend && npm ci && npm run dev                     # http://localhost:3000
```

Gate backend (Oracle harus jalan; tes memakai Oracle, bukan sqlite):

```bash
docker compose -f compose.dev.yaml run --rm backend sh -c 'vendor/bin/pint --test && vendor/bin/pest'
scripts/oracle-dump.sh          # tulis backend/database/oracle/portal-{ddl,seed}.sql
scripts/oracle-dump.sh --cek    # terapkan dump ke skema kosong
```

## Data API palsu (fixture)

Dev dan CI tidak memanggil Data API sungguhan. `fixture-server` di `compose.dev.yaml` memutar
rekaman `fixtures/data-api/` (body mentah per URL); URL yang belum direkam dijawab **599**.

```bash
# rekam ulang dari Data API lokal (lakehouse/data-api, `uv run data-api` di port 18080)
DATA_API_URL=http://localhost:18080 DATA_API_TOKEN=… node tools/fixture-server/rekam.mjs
```

Daftar URL ada di `tools/fixture-server/daftar-url.txt`. Kontrak Data API disalin ke
`docs/api/` lewat `scripts/salin-openapi.sh`; keputusan dan risiko ada di
`docs/adr/0001-arsitektur.md`.

## Aturan backend (dijaga tes)

- Kode fitur di `backend/app/Features/<Fitur>/`, bagian bersama di `backend/app/Shared/`.
  Aturan pemisahan SPEC §4.3 diuji `tests/Arch`, termasuk fitur palsu `Contoh`
  (`tests/Fixtures/Arch`) yang harus selalu ditolak.
- Rute ditulis dengan `Route::portal()` + `Route::apiGet()`/`apiPost()`; tidak ada PATCH.
- Data API hanya dipanggil dari `Sources/` lewat `App\Shared\DataApi\DataApiClient`, dan isi `data`
  diteruskan sebagai JSON mentah.

Sandi di `compose.dev.yaml` hanya untuk Oracle XE lokal. Nilai produksi tidak pernah ditulis
di repo ini (repo publik).

## Versi yang disematkan

| Bagian | Versi | Catatan |
|---|---|---|
| PHP | 8.2 | ketentuan klien (SPEC §4.1) |
| Laravel | 10.x | ketentuan klien; dukungan keamanan sudah berakhir, risiko dicatat di ADR |
| Oracle Instant Client | 19.33 | `backend/Dockerfile` |
| PECL oci8 | 3.3.0 | rilis khusus PHP 8.2 |
| yajra/laravel-oci8 | ^10 | |
| Nuxt | 4.6.3 | Nuxt 3 EOL 31 Juli 2026 (SPEC K-8) |
| Tailwind CSS | 3.4.19 | sama dengan platform-v2; bukan Tailwind 4 |
