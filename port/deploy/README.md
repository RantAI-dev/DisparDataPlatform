# deploy/ — paket deploy portal

Paket untuk server Kominfo (SPEC §9). Cara deploy di sana belum diketahui, jadi paket ini netral:
**container** (`compose.yaml`) atau **bare metal**. Untuk pengembangan lokal pakai
`../compose.dev.yaml`, bukan isi folder ini.

| Berkas | Isi |
|---|---|
| `backend.Dockerfile` | Laravel di php-fpm 8.2 + nginx dalam satu container, Oracle Instant Client 19 (basic) + oci8, port 8080, non-root |
| `backend/` | konfigurasi nginx, php-fpm, php.ini, dan entrypoint image backend |
| `frontend.Dockerfile` | Nuxt hasil `nuxt build`, Node 20, `node .output/server/index.mjs`, port 3000, non-root |
| `compose.yaml` | contoh: `backend`, `scheduler`, `frontend`. **Tanpa Oracle** (milik server klien) |
| `backend.env.example`, `frontend.env.example` | env berisi placeholder saja; salinan terisi tidak pernah di-commit |

```
Browser → (reverse proxy/LB klien) → frontend :3000 → backend :8080 → Data API (data-api.rantai.dev)
                                                                     └→ Oracle 19c (server klien)
```

## Prasyarat

- **Oracle 19c**: satu user/skema khusus portal, dengan
  `grant create session, create table, create sequence, create trigger to <user>;` dan kuota di
  tablespace-nya (`alter user <user> quota unlimited on <tablespace>;`). Tabel milik app saja
  (SPEC §6): log, snapshot, token, cache.
- **Egress server** ke `https://data-api.rantai.dev` (port 443). Token layanan Data API
  diserahkan langsung oleh pemilik, tidak pernah lewat repo.
- **Egress browser pengunjung** ke `services.arcgisonline.com` untuk peta dasar. Bila diblokir,
  peta otomatis memakai tile OpenStreetMap (K-9, `useBasemap.ts`).
- Container: Docker Engine + Compose v2. Bare metal: lihat bagian di bawah.
- Image dibangun dari folder `port/` (konteks build), bukan dari `deploy/`.

## Pertama kali (container)

Perintah dijalankan dari `port/deploy`. Semua `docker compose run` memakai image backend; boot
Laravel membuka koneksi Oracle (store cache), jadi **isi `DB_*` dulu** dan pastikan Oracle
terjangkau sebelum langkah 3.

1. Isi env:
   ```bash
   cp backend.env.example backend.env
   cp frontend.env.example frontend.env
   chmod 600 backend.env frontend.env
   ```
   Isi semua nilai `<...>` di `backend.env` kecuali `APP_KEY`.
2. Bangun image: `docker compose build`.
3. Kunci aplikasi: `docker compose run --rm backend php artisan key:generate --show`, salin
   keluarannya (`base64:...`) ke `APP_KEY` di `backend.env`.
4. Skema: `docker compose run --rm backend php artisan migrate --force`
   (atau dump SQL, lihat di bawah).
5. Akun layanan:
   `docker compose run --rm backend php artisan db:seed --force --class='App\Shared\Auth\ServiceAccountSeeder'`
6. Token (masing-masing dicetak **sekali**; baris pertama keluaran adalah tokennya):
   ```bash
   docker compose run --rm backend php artisan portal:token frontend read   # → NUXT_FRONTEND_TOKEN di frontend.env
   docker compose run --rm backend php artisan portal:token admin admin     # → simpan untuk operator (rute sistem/*)
   ```
7. Jalankan: `docker compose up -d`. `frontend` dan `scheduler` menunggu `backend` sehat.
8. Cek kesehatan:
   ```bash
   curl -fsS http://127.0.0.1:8000/api/v1/sistem/kesehatan
   ```
   `data.status` harus `ok`, dengan `komponen.oracle` dan `komponen.data_api` `ok`. HTTP selalu
   200; `terganggu` berarti salah satu komponen gagal (healthcheck container tetap lulus supaya
   gangguan Data API tidak membuat backend di-restart).
9. Buka frontend (`http://127.0.0.1:3000`, atau lewat reverse proxy) dan periksa `/` dan
   `/dashboard/wisman`.

Port host bawaan hanya `127.0.0.1` (`BACKEND_PORT` 8000, `FRONTEND_PORT` 3000). Ubah lewat env
compose (`BACKEND_BIND`, `FRONTEND_BIND`, `BACKEND_PORT`, `FRONTEND_PORT`) atau taruh reverse proxy
di depan. Lokasi berkas env bisa dipindah lewat `PORTAL_BACKEND_ENV`/`PORTAL_FRONTEND_ENV`, dan
nama image lewat `PORTAL_BACKEND_IMAGE`/`PORTAL_FRONTEND_IMAGE`.

Setelah mengubah `backend.env`, jalankan `docker compose up -d` (container dibuat ulang). Config
dan route cache dibuat ulang otomatis tiap container start, karena nilai env baru ada saat itu.

### Rilis berikutnya

```bash
docker compose build
docker compose run --rm backend php artisan migrate --force
docker compose up -d
```

## Dump SQL Oracle (alternatif migrate)

Bila DBA tidak mengizinkan app membuat tabel sendiri, terapkan dump yang dibuat
`scripts/oracle-dump.sh` (CI memeriksa dump bisa diterapkan ke skema kosong):

```bash
sqlplus <user>/<sandi>@//<host>:1521/<service> @backend/database/oracle/portal-ddl.sql
sqlplus <user>/<sandi>@//<host>:1521/<service> @backend/database/oracle/portal-seed.sql
```

`portal-seed.sql` sudah membuat akun layanan, jadi langkah 4 dan 5 dilewati; lanjut ke langkah 6.
Catatan: tabel `MIGRATIONS` hasil dump kosong, jadi **jangan** menjalankan `php artisan migrate` di
skema itu (Laravel akan mencoba membuat ulang semua tabel). Pilih satu jalur dan pakai terus:
migrate, atau dump baru dari rilis berikutnya.

## Scheduler

Jadwal ada di `backend/app/Console/Kernel.php` (plan 16): `portal:sinkron` harian pukul
`PORTAL_JAM_SINKRON` (bawaan 11:00 WIB) dengan `withoutOverlapping`, dan `portal:bersihkan-log`
mingguan (retensi 180 hari). Jalankan **salah satu** saja:

- **Container**: service `scheduler` di `compose.yaml` (image backend, perintah
  `php artisan schedule:work`).
- **Bare metal**: crontab user yang menjalankan PHP:
  ```
  * * * * * cd /srv/portal/backend && php artisan schedule:run >> /dev/null 2>&1
  ```

Kunci `withoutOverlapping` disimpan di cache Oracle (`CACHE_DRIVER=database`). Pemicu manual
tetap ada: `POST /api/v1/sistem/job/sinkron` dengan token admin.

## Bare metal (singkat)

- **Backend**: PHP 8.2 (fpm) dengan ekstensi oci8 3.3.0, zip, intl, bcmath, opcache, pcntl;
  Oracle Instant Client 19 (basic); nginx; Composer 2. Versi dan checksum yang dipakai ada di
  `backend.Dockerfile`.
  ```bash
  cd /srv/portal/backend
  composer install --no-dev --optimize-autoloader
  cp ../deploy/backend.env.example .env      # isi; LOG_CHANNEL boleh `daily`
  php artisan config:cache && php artisan route:cache   # ulangi setiap .env berubah
  ```
  Lalu langkah 3–6 di atas tanpa awalan `docker compose run --rm backend`. `storage/` dan
  `bootstrap/cache` harus bisa ditulis user php-fpm. Konfigurasi nginx dan php-fpm di `backend/`
  bisa dipakai dengan menyesuaikan `root`, `listen`, dan `fastcgi_pass`; pertahankan lokasi ekspor
  (timeout 300 s, `fastcgi_buffering off`), `request_terminate_timeout`, dan `output_buffering = Off`.
- **Frontend**: Node 20.
  ```bash
  cd /srv/portal/frontend
  npm ci && npx nuxt build
  NUXT_LARAVEL_URL=http://127.0.0.1:8080 NUXT_FRONTEND_TOKEN=... NUXT_PUBLIC_API_BASE_URL=... \
    HOST=127.0.0.1 PORT=3000 node .output/server/index.mjs     # jalankan lewat systemd
  ```

## Timeout ekspor

Ekspor dataset adalah kelas aliran (SPEC §4.6): Data API boleh 300 s (`DATA_API_TIMEOUT_STREAM`).
Rantainya: nginx `fastcgi_read_timeout 300s` + `fastcgi_buffering off` di
`^/api/v1/dataset/<slug>/ekspor`, php-fpm `request_terminate_timeout 320s`, proxy Nuxt 330 s.
Rute lain dibatasi 90 s (Data API paling lama 60 s). Reverse proxy klien di depan Nuxt juga harus
mengizinkan ±330 s dan tidak menahan body untuk `/_api/dataset/*/ekspor`.

## IP asli pengunjung (`PORTAL_PROXY_TEPERCAYA`)

`PORTAL_PROXY_TEPERCAYA` harus memuat alamat server Nuxt **dan** semua reverse proxy/LB di depannya
(IP atau CIDR, dipisah koma), supaya LOG_HISTORY mencatat IP pengunjung, bukan IP LB (ADR 0001).
Dengan `compose.yaml`, Nuxt memanggil backend dari network compose; isi subnet network itu
(`docker network inspect dispar-portal-prod_default --format '{{(index .IPAM.Config 0).Subnet}}'`)
ditambah alamat reverse proxy/LB klien.
