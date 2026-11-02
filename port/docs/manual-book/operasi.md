# Panduan operasi

Untuk tim yang menjalankan portal di server. Paket deploy (compose, nginx, php-fpm, langkah pindah
GitLab) ada di [`deploy/README.md`](../../deploy/README.md); halaman ini membahas konfigurasi dan
pemulihan.

## Env

Nilai sungguhan hanya di server, tidak pernah di repo. Contoh lengkap: `backend/.env.example`.

### Laravel (`backend/.env`)

| Env | Isi | Bawaan |
|---|---|---|
| `APP_KEY`, `APP_URL`, `APP_ENV=production`, `APP_DEBUG=false` | standar Laravel | — |
| `DB_CONNECTION=oracle`, `DB_HOST`, `DB_PORT`, `DB_SERVICE_NAME`, `DB_USERNAME`, `DB_PASSWORD` | Oracle 19c skema app | — |
| `DATA_API_URL`, `DATA_API_TOKEN` | alamat dan token layanan Data API | — |
| `DATA_API_TIMEOUT`, `DATA_API_RETRY`, `DATA_API_RETRY_JEDA_MS` | klien biasa: detik per percobaan, ulang untuk 5xx/gagal koneksi | 10, 2, 200 |
| `DATA_API_TIMEOUT_LAMBAT` | atlas, gmti/spasial/hotel-scraped, indikator (satu percobaan) | 60 |
| `DATA_API_TIMEOUT_STREAM` | ekspor | 300 |
| `DATA_API_TIMEOUT_KESEHATAN` | cek kesehatan | 3 |
| `PORTAL_PROXY_TEPERCAYA` | alamat server Nuxt, dipisah koma (IP asli di log) | `127.0.0.1` |
| `PORTAL_BATAS_PER_MENIT` | batas laju per klien + IP | 120 |
| `PORTAL_SNAPSHOT_BASI_JAM` | snapshot lebih tua dari ini → `meta.stale = true` | 36 |
| `PORTAL_CACHE_MENIT` | TTL cache kelas P | 15 |
| `PORTAL_JAM_SINKRON` | jam sinkron harian, WIB (`HH:MM`) | `11:00` |
| `PORTAL_VERSI` | versi yang dilaporkan `sistem/kesehatan` | `dev` |
| `LOG_HISTORY_AKTIF`, `LOG_HISTORY_RETENSI_HARI` | log history | `true`, 180 |

### Nuxt

| Env | Isi |
|---|---|
| `NUXT_LARAVEL_URL` | alamat Laravel dari sisi server Nuxt |
| `NUXT_FRONTEND_TOKEN` | token akun `frontend` ability `read`; hanya di server |

## Cron / scheduler

Satu entri cron menjalankan scheduler Laravel setiap menit:

```cron
* * * * * cd /path/ke/backend && php artisan schedule:run >> /dev/null 2>&1
```

| Job | Jadwal (WIB) | Isi |
|---|---|---|
| `portal:sinkron` | harian `PORTAL_JAM_SINKRON` (11:00) | perbarui snapshot kelas T. Refresh Dagster di lakehouse selesai sekitar 09:00 WIB |
| `portal:bersihkan-log` | Minggu 01:00 | hapus `LOG_HISTORY` dan `JOB_RUNS` > 180 hari |

Keduanya `withoutOverlapping`, dan sinkron manual berbagi kunci yang sama. Pastikan job berjalan
dengan membaca `GET /api/v1/sistem/job` ([admin.md](admin.md#4-riwayat-job)).

## Bila Data API mati

Portal dirancang tetap tampil sebagian:

| Kelas endpoint | Contoh | Perilaku saat Data API mati |
|---|---|---|
| T (tetap) | beranda, katalog, dashboard utama, indikator, atlas, gmti ringkasan, spasial | dilayani dari **snapshot** terakhir. Setelah 36 jam `meta.stale = true` |
| P (berparameter) | baris dataset, filter dashboard, daftar tempat GMTI | dilayani dari cache selama TTL (15 menit), lalu **503** `UPSTREAM_UNAVAILABLE` |
| S (aliran) | ekspor CSV/XLSX | langsung **503** |

Langkah:

1. Periksa `GET /api/v1/sistem/kesehatan`. `komponen.data_api = "gagal"` (`status = "terganggu"`) = Data API tidak terjangkau dari
   server Laravel.
2. Bila Data API menjawab tetapi portal mendapat **502** `UPSTREAM_AUTH`, token layanan di
   `DATA_API_TOKEN` salah atau sudah dirotasi di sisi Data API. Lihat rotasi di bawah.
3. Hubungi pengelola lakehouse/Data API (lihat [../data-api/README.md](../data-api/README.md#siapa-yang-dihubungi)).
4. Jangan menjalankan `portal:sinkron` selama Data API mati: sinkron tidak menghapus snapshot,
   tetapi hanya akan mencatat status `gagal`.
5. Setelah Data API pulih, picu sinkron ([admin.md](admin.md#5-memicu-sinkron-snapshot)) dan
   periksa statusnya `sukses`.

Halaman yang belum pernah punya snapshot (mis. setelah database baru) akan 503 sampai Data API
pulih. Jalankan sinkron sekali setelah deploy pertama.

## Rotasi token

**Token portal (Sanctum).**

1. Buat token baru: `php artisan portal:token frontend read` (atau `admin admin`).
2. Pasang di pemakainya (`NUXT_FRONTEND_TOKEN` lalu restart Nuxt; atau simpan untuk operator).
3. Cabut token lama di Oracle. Nama token berbentuk `<ability>-<YYYYMMDD-HHMMSS>`:

   ```sql
   select id, name, last_used_at from personal_access_tokens
    where tokenable_id = (select id from users where name = 'frontend');
   delete from personal_access_tokens where id = :id_token_lama;
   ```

4. Periksa log: tidak ada lagi 401 dari klien `frontend`.

**Token layanan Data API (`DATA_API_TOKEN`).** Pengelola Data API menambahkan hash token baru di
`DATA_API_TOKENS` sisi Data API (bisa beberapa token sekaligus), portal mengganti `DATA_API_TOKEN`,
lalu pengelola menghapus hash lama. Selama transisi kedua token berlaku, jadi tidak ada jeda.
Setelah mengubah `.env`: `php artisan config:cache`.

## Ekspor: 413 bukan 404

Ekspor dataset di atas batas baris Data API (bawaan 100.000) dijawab **413** `TOO_LARGE` dalam
envelope JSON. Portal Next.js lama menelan error yang sama dan memberi **404**. Perbedaan ini
disengaja (SPEC §4.6): pengguna mendapat pesan yang benar ("terlalu besar, persempit filter").
Uji paritas dan pemantauan yang membandingkan dua portal harus memperlakukannya sebagai beda yang
diketahui.

Ekspor besar butuh timeout panjang di setiap lapis: Data API 300 s, proxy Nuxt 330 s, dan nginx /
php-fpm di atasnya (diatur di paket deploy), dengan buffering nginx dimatikan
(`X-Accel-Buffering: no`).

## Pemeriksaan rutin

| Apa | Cara |
|---|---|
| Portal hidup | `GET /api/v1/sistem/kesehatan` |
| Sinkron harian berhasil | `GET /api/v1/sistem/job` → `portal:sinkron` hari ini `sukses` |
| Error meningkat | `GET /api/v1/sistem/log?dari=…` lalu hitung `status_http` ≥ 500 |
| Ukuran tabel log | retensi 180 hari dijaga `portal:bersihkan-log` |
