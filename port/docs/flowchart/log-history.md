# Flowchart log history

SPEC §4.5. Seluruh perilaku log ada di `App\Shared\LogHistory`; job dicatat `App\Shared\Jobs\JobRunRecorder`.

## Satu baris per request

`LogRequest` dipasang global (bukan hanya grup `/api/v1`), jadi request ke alamat yang tidak ada
(404) dan metode yang ditolak (405) ikut tercatat. Penulisan terjadi di `terminate`, sesudah respons
terkirim: kegagalan menulis log tidak pernah menggagalkan request. Rute di
`loghistory.rute_dikecualikan` tidak dicatat; isinya `sistem.kesehatan`, karena dipanggil healthcheck
container tiap 30 detik dan hanya akan memenuhi tabel tanpa nilai audit.

```mermaid
flowchart TD
    R["request /api/*"] --> RID["RequestId: pakai X-Request-Id masuk atau buat baru"]
    RID --> M["LogRequest.handle: catat waktu mulai"]
    M --> H["rute fitur / error renderer"]
    H --> K["LogContext: sumber (data_api/cache/snapshot),<br/>jumlah baris"]
    K --> RES["respons terkirim ke klien"]
    RES --> T{"LOG_HISTORY_AKTIF dan path api/*?"}
    T -- tidak --> X["selesai"]
    T -- ya --> X2{"nama rute di<br/>loghistory.rute_dikecualikan?<br/>(sistem.kesehatan)"}
    X2 -- ya --> X
    X2 -- tidak --> B["susun baris: MODUL (atribut rute), AKSI (nama rute),<br/>METODE, PATH, PARAM_HASH (SHA-256 query dinormalkan),<br/>PARAM_RINGKAS ≤ 2.000 byte tanpa token/password,<br/>KLIEN, IP (TrustProxies), USER_AGENT, STATUS_HTTP,<br/>DURASI_MS, JUMLAH_BARIS, SUMBER, DIBUAT_PADA"]
    B --> W{"insert LOG_HISTORY berhasil?"}
    W -- ya --> X
    W -- tidak --> F["Log::warning ke log berkas<br/>(request tetap sukses)"]
```

Ekspor dataset selalu tercatat bersama filternya (query) dan jumlah baris dari header `X-Row-Count`.

## Membaca log (admin)

```mermaid
flowchart LR
    OP["GET sistem.log?modul&dari&sampai&page<br/>token admin"] --> V{"dari/sampai = YYYY-MM-DD (WIB),<br/>sampai ≥ dari?"}
    V -- tidak --> E422["422 INVALID_PARAM"]
    V -- ya --> Q["LOG_HISTORY terbaru dulu, 50 per halaman"]
    OP2["GET sistem.job?page"] --> Q2["JOB_RUNS terbaru dulu, 50 per halaman"]
```

## Retensi

```mermaid
flowchart LR
    C["cron mingguan: Minggu 01:00 WIB"] --> J["portal:bersihkan-log"]
    J --> JR["JOB_RUNS: job portal:bersihkan-log"]
    JR --> D["hapus LOG_HISTORY.DIBUAT_PADA dan JOB_RUNS.MULAI<br/>lebih tua dari LOG_HISTORY_RETENSI_HARI (bawaan 180)"]
```
