# Panduan admin

Portal tidak punya halaman admin (CMS Disparekraf terpusat di tempat lain, SPEC K-5). Pekerjaan admin
dilakukan dengan **perintah artisan** di server Laravel dan **API sistem** dengan token `admin`.
Rute `sistem/*` tidak bisa dibuka lewat browser portal (proxy Nuxt menolaknya dengan 404); panggil
langsung ke Laravel dari jaringan server.

Contoh di bawah memakai `LARAVEL=https://<alamat-laravel>` dan token di variabel `TOKEN_ADMIN`.
Jangan menulis token ke berkas yang di-commit, chat, atau tiket.

## 1. Membuat token

Akun layanan `frontend` dan `admin` dibuat seeder (`php artisan db:seed`). Token dibuat per akun:

```bash
php artisan portal:token frontend read     # untuk server Nuxt (NUXT_FRONTEND_TOKEN)
php artisan portal:token admin admin       # untuk operator
```

- Token dicetak **sekali**. Yang disimpan di Oracle hanya hash-nya; token yang hilang tidak bisa
  ditampilkan ulang, buat yang baru.
- Ability `read` hanya bisa membaca rute fitur. Ability `admin` dibutuhkan rute `sistem/*`
  (kecuali `sistem/kesehatan`). Token yang salah ability dijawab 403.
- Rotasi dan pencabutan token: lihat [operasi.md](operasi.md#rotasi-token).

## 2. Memeriksa kesehatan

Tanpa token:

```bash
curl -s "$LARAVEL/api/v1/sistem/kesehatan"
```

Jawaban selalu HTTP 200: `status` (`ok` | `terganggu`), `versi`, dan `komponen.oracle` / `komponen.data_api` (`ok` | `gagal`).

## 3. Membaca log history

Setiap request ke `/api/v1/*` tercatat di tabel `LOG_HISTORY` (modul, aksi, path, parameter
ringkas, klien, IP, status, durasi, jumlah baris, sumber data). Retensi 180 hari.

```bash
curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
  "$LARAVEL/api/v1/sistem/log?modul=dataset&dari=2026-11-01&sampai=2026-11-02&page=1"
```

| Parameter | Isi |
|---|---|
| `modul` | nama modul: `dataset`, `dashboard`, `indikator`, `atlas`, `gmti`, `spasial`, `hotel-scraped`, `beranda`, `sistem` |
| `dari`, `sampai` | tanggal WIB `YYYY-MM-DD`, inklusif; `sampai` ≥ `dari` |
| `page` | mulai 1; 50 baris per halaman, terbaru lebih dulu |

Untuk menelusuri satu keluhan, minta `request_id` dari pengguna (ada di `meta.request_id` setiap
respons dan header `X-Request-Id`), lalu cari di log.

## 4. Riwayat job

```bash
curl -s -H "Authorization: Bearer $TOKEN_ADMIN" "$LARAVEL/api/v1/sistem/job?page=1"
```

Setiap job tercatat di `JOB_RUNS`: `JOB` (`portal:sinkron`, `portal:bersihkan-log`), `PEMICU`
(`cron`/`manual`), `KLIEN`, `MULAI`, `SELESAI`, `STATUS`, `RINGKASAN`.

| Status | Arti |
|---|---|
| `jalan` | sedang berjalan (atau proses mati di tengah jalan bila tidak pernah selesai) |
| `sukses` | semua target sinkron berhasil |
| `sebagian` | sebagian target gagal; snapshot target itu tetap versi lama. Lihat `RINGKASAN.rincian_gagal` |
| `gagal` | semua target gagal (biasanya Data API mati) |

## 5. Memicu sinkron snapshot

Sinkron berjalan otomatis setiap hari (bawaan 11:00 WIB). Picu manual bila data lake baru
diperbarui di luar jadwal:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN_ADMIN" "$LARAVEL/api/v1/sistem/job/sinkron"
```

- **202**: sinkron dimulai dan berjalan setelah respons terkirim. Pantau hasilnya di
  `sistem/job`.
- **409** `JOB_BERJALAN`: sinkron lain masih berjalan (cron atau manual). Tunggu selesai.

Dari server juga bisa: `php artisan portal:sinkron --manual` (hasil langsung tercetak).

## 6. Mengosongkan cache

Endpoint berparameter di-cache 15 menit. Untuk membuang semuanya sekarang:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN_ADMIN" "$LARAVEL/api/v1/sistem/cache/kosongkan"
```

Jawaban `{"dihapus": n}`. Snapshot **tidak** ikut terhapus; untuk memperbaruinya, picu sinkron.

Cache Data API sendiri (in-process, di sisi lakehouse) dikosongkan terpisah; lihat
[../data-api/README.md](../data-api/README.md).
