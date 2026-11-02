# Flowchart sinkron dan rute sistem

Fitur Laravel `Features/Sistem` (plan 16), SPEC §4.6. Tidak ada rute halaman: rute `sistem/*` ditolak
proxy Nuxt (404) dan hanya dipanggil operator dengan token `admin`, kecuali kesehatan yang publik.

| Rute API (nama) | Laravel | Ability | Isi |
|---|---|---|---|
| `sistem.kesehatan` | `GET /api/v1/sistem/kesehatan` | — | Oracle (`select 1 from dual`) + Data API `/v1/health` (3 s, tanpa ulang) + versi |
| `sistem.log` | `GET /api/v1/sistem/log?modul&dari&sampai&page` | admin | lihat [log-history.md](log-history.md) |
| `sistem.job` | `GET /api/v1/sistem/job?page` | admin | riwayat `JOB_RUNS`, 50 per halaman |
| `sistem.job.sinkron` | `POST /api/v1/sistem/job/sinkron` | admin | picu `portal:sinkron` manual |
| `sistem.cache.kosongkan` | `POST /api/v1/sistem/cache/kosongkan` | admin | hapus cache kelas P (SNAPSHOT tidak disentuh) |

## Job `portal:sinkron`

Jadwal: harian `PORTAL_JAM_SINKRON` (bawaan 11:00 WIB), setelah refresh Dagster 09:00 WIB
(`app/Console/Kernel.php`, `withoutOverlapping`). Target diturunkan dari rute: setiap rute GET
ber-`kelas` T × atribut `varian`-nya (tanpa varian = satu panggilan). Tiap target dijalankan lewat
controller rute itu sendiri dengan `ModeSinkron` aktif, jadi kunci snapshot sama persis dengan
request biasa.

```mermaid
flowchart TD
    CR["cron: schedule:run / schedule:work<br/>dailyAt jam_sinkron WIB"] --> CMD["php artisan portal:sinkron"]
    CLI["operator di server:<br/>portal:sinkron --manual"] --> CMD
    API["POST sistem.job.sinkron<br/>(token admin)"] --> LK2{"kunci eksklusif<br/>Cache::lock portal:sinkron"}
    LK2 -- dipegang --> E409["409 JOB_BERJALAN"]
    LK2 -- didapat --> PR["mulai proses CLI terlepas (nohup):<br/>portal:sinkron --manual --klien=… --pemilik=…"]
    PR -- "gagal dimulai" --> E500["kunci dilepas<br/>500 INTERNAL"]
    PR -- "dimulai" --> A202["202 {job, pemicu: manual}"]
    PR -.->|"proses terpisah dari php-fpm"| CMDM["portal:sinkron --pemilik=…"]
    CMDM --> WARIS["Cache::restoreLock: mewarisi kunci<br/>yang diambil rute"] --> RUN
    CMD --> LK{"kunci eksklusif"}
    LK -- dipegang --> SKIP["'Sinkron lain masih berjalan; dilewati.'"]
    LK -- didapat --> RUN["JOB_RUNS: status = jalan"]
    RUN --> LOOP["untuk setiap target (rute T × varian)"]
    LOOP --> CALL["jalankan controller dengan ModeSinkron:<br/>Data API SELALU dipanggil"]
    CALL -- "sukses tanpa peringatan" --> H{"HASH isi berubah?"}
    H -- ya --> UP["upsert SNAPSHOT (ISI, HASH, DIAMBIL_PADA)"]
    H -- tidak --> SAMA["ISI tidak ditulis;<br/>DIAMBIL_PADA diperbarui (tidak basi)"]
    CALL -- "gagal, atau 200 + meta.peringatan (Q21)" --> G["dihitung gagal: catat {rute, varian, error};<br/>snapshot lama TETAP"]
    UP & SAMA & G --> NEXT{"target lain?"}
    NEXT -- ya --> LOOP
    NEXT -- tidak --> ST{"jumlah gagal"}
    ST -- "0" --> S1["status sukses"]
    ST -- "sebagian" --> S2["status sebagian"]
    ST -- "semua" --> S3["status gagal"]
    S1 & S2 & S3 --> FIN["JOB_RUNS: SELESAI, STATUS,<br/>RINGKASAN {ok, berubah, gagal, rincian_gagal}<br/>lepas kunci"]
```

Sinkron manual lewat API tidak dijalankan di worker php-fpm (yang bisa dibunuh
`request_terminate_timeout`), melainkan sebagai proses CLI terpisah. Rute mengambil kunci lebih dulu
lalu mewariskannya (`--pemilik`), sehingga pemicu kedua langsung dijawab 409 walau proses pertama
belum sempat mulai. Bila proses tidak bisa dimulai, kunci dilepas dan rute menjawab 500.

## Kosongkan cache

```mermaid
flowchart LR
    OP["POST sistem.cache.kosongkan<br/>(token admin)"] --> DEL["hapus baris CACHE berawalan dataapi:"]
    DEL --> R["200 {dihapus: n}"]
    DEL -.->|"tidak menyentuh"| SN["SNAPSHOT"]
```

Untuk memperbarui snapshot kelas T setelah data lake berubah di luar jadwal, picu sinkron; cache
kelas P cukup dikosongkan (atau ditunggu habis TTL-nya, bawaan 15 menit).
