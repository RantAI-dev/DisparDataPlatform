# Handoff: Batch portal — Data API + portal Nuxt/Laravel untuk server Disparekraf

Dokumen operasional untuk executor dan reviewer. Diperbarui setiap kali satu PR di-merge.
Baca dulu `plans/2026-10-21-portal-SPEC.md` (desain dan keputusan) dan
`plans/2026-10-21-portal-KONTRAK.md` (rute dan endpoint). Inventaris bukti ada di
`plans/2026-10-21-portal-inventaris/`.

## Dua repo

| Kode plan | Repo | Isi |
|---|---|---|
| 01–06 | **repo ini** (`Dinas-Pariwisata` / `DisparDataPlatform`) | Data API `lakehouse/data-api/`, skrip golden, deploy di stack 6 |
| 10–19 | **repo baru** `dispar-portal` (GitHub private, nanti GitLab) | Laravel `backend/`, Nuxt `frontend/`, `docs/`, `deploy/` |

## Urutan dan ketergantungan

```
[01 kontrak OpenAPI + golden] ──┬──> [02 data-api: kerangka + dataset + beranda] ──┬──> [03 dashboard] ──┐
                                │                                                  ├──> [04 indikator] ──┼──> [06 OPERASI deploy data-api]
                                │                                                  └──> [05 atlas+gmti+  ─┘     (BUTUH "lanjut deploy")
                                │                                                         spasial+hotel]
                                │
                                └──> [10 portal: kerangka] ──> [11 dataset+beranda+docs] ──┬──> [12 dashboard]  (butuh 03)
                                       (BUTUH repo dari pemilik)                           ├──> [13 indikator]  (butuh 04)
                                                                                           ├──> [14 atlas]      (butuh 05)
                                                                                           └──> [15 gmti+spasial+hotel] (butuh 05)
                                                                                                  │
                                         [16 sistem: sinkron, snapshot, log admin] <─── 12–15 ────┘
                                                  │
                                                  ├──> [17 paritas penuh] ──> [18 dokumen serah terima]
                                                  └──> [19 paket deploy + pindah GitLab]
```

Aturan urutan:

- Jalankan per baris tabel status. Sebuah plan baru boleh dimulai bila semua isi kolom `Butuh`
  berstatus `selesai`.
- Plan 02–05 hanya membaca ClickHouse .148. Plan 11–17 berjalan melawan Data API **lokal**
  (`uv run` di laptop yang ada di LAN .148), jadi tidak menunggu 06.
- 03/04/05 boleh paralel; mereka hanya menyentuh `features/<fitur>/`. 12–15 juga boleh paralel.
  - Tambahan ke `shared/` dikerjakan sebagai commit kecil terpisah di awal PR, lalu di-rebase
    oleh PR lain.
  - Bentrok di `shared/` diselesaikan oleh PR yang merge belakangan.
- **STOP mutlak setelah 05.** Plan 06 menyentuh server produksi dan butuh pemilik menulis
  "lanjut deploy". Plan 06 punya dua bagian: A untuk image Dagster dan B untuk container Data API.
- Plan 10–19 **tidak** menunggu "lanjut deploy". Semuanya lokal, dan boleh berjalan sementara
  06 menunggu.
- **STOP sebelum 10** bila repo `dispar-portal` belum dibuat pemilik. Executor tidak membuat
  repo sendiri.

## Fakta terverifikasi planner (21 Okt 2026)

Sumber: inventaris F (query nyata ke .148, 08:16 WIB) dan pembacaan kode.

**Server dan akses**

- ClickHouse 26.7.3.19 di **192.168.18.148:18123**. CLAUDE.md dan `docs/` masih menulis
  `.187`; jangan perbaiki di batch ini.
- Kredensial akun `dispar` ada di `platform-v2/.env.local` (`CH_USER`, `CH_PASSWORD`); timpa
  host ke `.148`.
- Produksi app memakai `dispar_app` (profil `app_readonly`):
  - read-only, `max_execution_time` 30 s, `max_result_rows` 100.000 (melempar error),
    `use_query_cache=1` (query `system.*` gagal);
  - sandinya **tidak** ada di `.env.local`. Sandi itu ada di Env stack lakehouse
    (`CH_APP_PASSWORD`). Plan 02 membacanya lewat Portainer (hanya baca) dan menyimpannya hanya
    di env shell.
  - **Uji panggung memakai `dispar_app`**, karena profil itu menolak setting sesi dan `system.*`
    (SPEC §3.3).
- Portainer di .148: Id environment dan stack belum diverifikasi untuk host ini; CLAUDE.md
  masih menulis `.187` / env `3`. Plan 02 dan 06 mencarinya dengan `EndpointList` dan
  `StackList`.
- Produksi `dispar.rantai.dev` berjalan di commit `origin/main` **`6b858eb`**. Itu baseline
  paritas.
- Refresh lake: Dagster `refresh_lakehouse` setiap 02:00 UTC (09:00 WIB) dan `ops_daily`
  04:00 UTC (`definitions.py:198-207`).

**Data yang tersedia** (jumlah baris pada saat query):

- `serving.mart_wisman` 940. `serving.mart_hotel_scraped_booking` **0**, jadi `/scraped-hotels`
  di produksi kosong. `serving.mart_pdrb_ekraf` dan `serving.mart_gci` **tidak ada**.
- Semua ekspor statis batch 1 ada di `lake.bronze_file.*`:
  - restoran_kurasi 181, restoran_osm 534
  - gci_venue_kurasi 65, gci_venue_osm 2573, gci_venue_rating 1785, gci_venue_alamat 2573,
    gci_venue_harga 1147, gci_resto_hotel **107** (plan b1 menyebut ±108)
  - event_pertunjukan 308, golf 14, souvenir 67
  - hotel_registri 120, hotel_tpk 145, hotel_los 310
  - gmti_tempat 1105, gmti_kecamatan 44, gmti_tipologi 11, gmti_capaian 15, gmti_ibadah 8331
  - seni_venue 138, artis_tampil_jakarta 3
  - pdrb_ekraf_makro 9, pdrb_ekraf_subsektor 112
  - gci_gpci_benchmark 28, target_wisman 6, target_kontribusi_ekraf_rpjmd 5,
    gci_kearney_resmi 8
  - booking_hotel_2026_09_15 72
- Katalog: `lake.bronze_meta.dataset_catalog` 184 ∪ `bronze_meta_sec.dataset_catalog` 37.
  Silver punya view untuk 219 dari 221 slug.
- Nama bentrok: `bronze_file.wellness_jakarta` dan `bronze_file.water_attractions_jakarta`
  berisi **kamus data**. View `silver.*` dengan nama yang sama membaca `bronze_sec`.
- `konform.f_*` ada dan cocok 100% ke dimensi, **tetapi tidak dipakai di batch ini**
  (SPEC K-1).

**App Next.js** (bukti di inventaris A–E):

- 26 halaman nyata dan 6 redirect di luar AI (KONTRAK §1).
- Enam subhalaman atlas dan GMTI sepenuhnya bundel TS statis. Dashboard dan indikator membaca
  Silver lalu mengagregasi di JS. Pemilihan dataset indikator memakai pencocokan judul saat
  runtime.
- Defect yang terlihat sekarang:
  - B Q1–Q22, C D1–D10, D §0.5 → **ditiru** (SPEC K-10, KONTRAK K-12);
  - P1–P5 di SPEC §5.5 → **diperbaiki**; P6 → ditiru dan dicatat.
- Daftar indikator: `data/gci-gpci-indicators.json` (root, sumber Bronze) **berbeda** dari
  `platform-v2/data/gci-gpci-indicators.json` (`cmp`: byte 1686). Plan 01 menyalin versi app
  ke root; plan 06 bagian A meng-ingest-nya.
- Versi terpasang di `platform-v2`: echarts 5.6.0, tailwindcss 3.4.19, xlsx 0.18.5.

**Repo:**

- Tidak ada CI di repo ini. Gate Python lakehouse: `cd lakehouse/ingest && uv run --extra dev pytest -q`.
- `plans/` di-exclude lokal (`.git/info/exclude`). Berkas plan tidak ikut commit, kecuali
  handoff ini bila pemilik memintanya.
- `tsx` tersedia di `platform-v2/node_modules/.bin/tsx`. Skrip yang mengimpor `@/lib/*`
  dijalankan dari `platform-v2/` (pola `scripts/ekspor_data_statis.ts`).

## Keputusan planner (pemilik boleh membatalkan)

Daftar lengkap bertanda [K-n] ada di SPEC dan KONTRAK. Ringkasnya:

| K | Keputusan |
|---|---|
| K-1 | Data API v1 meniru query Next.js persis dari tabel yang sama. Konform/Gold menunggu batch 3. |
| K-2 | Hostname publik Data API: `data-api.rantai.dev` lewat tunnel Cloudflare yang sudah ada. |
| K-3 | Data API memakai Python FastAPI di `lakehouse/data-api/`. |
| K-4 | Dokumentasi API Laravel dibuat dengan scramble. |
| K-5 | Tanpa login pengguna dan tanpa UI admin; akun layanan dengan token Sanctum. |
| K-6 | Retensi log 180 hari. |
| K-7 | `portal:sinkron` berjalan 11:00 WIB. |
| K-8 | Nuxt 3.x terbaru yang masih didukung, atau Nuxt 4 bila Nuxt 3 sudah EOL. |
| K-9 | Peta dasar Esri dengan fallback OSM bila diblokir. |
| K-10 | Tiru quirk. P1–P5 diperbaiki, P6 ditiru. |
| K-11 | Nama repo `dispar-portal`. |
| K-12 | Port algoritma pemilihan dataset indikator apa adanya, defect ikut. |

## Yang boleh diubah di server sebelum plan 06

**Tidak ada.** Plan 01–05 dan 10–19 hanya boleh:

- menjalankan `SELECT`, `SHOW`, dan `DESCRIBE` ke ClickHouse .148 lewat akun `dispar` dan
  `dispar_app`;
- **membaca** Portainer (`EndpointList`, `StackList`, `StackInspect`, `docker_proxy` GET).

Tidak ada DDL, tidak ada ingest, tidak ada trigger job, tidak ada perubahan Portainer.

Portal di plan 10–19 berjalan sepenuhnya di mesin executor (Docker lokal: Oracle XE, php, node).

## Status (executor memperbarui tabel ini)

"PR green" = gate lokal plan itu lulus + reviewer APPROVE. "main green" = gate lokal lulus lagi
di `main` setelah merge.

| Plan | Repo | Judul | Butuh | Status | PR | Merge SHA |
|---|---|---|---|---|---|---|
| 01 | ini | Kontrak OpenAPI Data API + draf Laravel + skrip golden | — | selesai* | RantAI-dev/DisparDataPlatform#22 | `1c5ce31` |
| 02 | ini | Data API: kerangka, fitur dataset, katalog, beranda | 01 | selesai* | RantAI-dev/DisparDataPlatform#23 | `1c5ce31` |
| 03 | ini | Data API: dashboard | 02 | selesai* | RantAI-dev/DisparDataPlatform#24 | `1c5ce31` |
| 04 | ini | Data API: indikator + pariwisata | 02 | selesai* | RantAI-dev/DisparDataPlatform#25 | `1c5ce31` |
| 05 | ini | Data API: atlas, gmti, spasial, hotel-scraped | 02 | selesai* | RantAI-dev/DisparDataPlatform#26 | `1c5ce31` |
| 06 | ini | OPERASI: A image Dagster (indikator + flush), B container Data API, hostname | 01–05 + "lanjut deploy" | menunggu "lanjut deploy" | | |
| 10 | portal | Kerangka monorepo, shared backend/frontend, Oracle, CI | 01 + repo ada | menunggu keputusan repo | | |
| 11 | portal | Fitur dataset + beranda + docs (pola acuan) | 10, 02 | belum | | |
| 12 | portal | Fitur dashboard | 11, 03 | belum | | |
| 13 | portal | Fitur indikator | 11, 04 | belum | | |
| 14 | portal | Fitur atlas (6 subhalaman) | 11, 05 | belum | | |
| 15 | portal | Fitur gmti, spasial, hotel-scraped | 11, 05 | belum | | |
| 16 | portal | Sistem: sinkron, snapshot, log admin, bersihkan-log | 12–15 | belum | | |
| 17 | portal | Paritas penuh vs dispar.rantai.dev | 16 | belum | | |
| 18 | portal | Dokumen serah terima | 17 | belum | | |
| 19 | portal | Paket deploy + panduan pindah GitLab | 16 | belum | | |

\* 01–05 (diperbarui 28 Okt 2026):

- Kelimanya masuk `main` sekaligus lewat merge commit `1c5ce31` (26 Okt). Sebelumnya stack
  di-rebase ke `main` `61c2afd` dan diselaraskan dengan perubahan web saat itu (kolom tampil,
  katalog sekunder 45 entri, endpoint destinasi).
- Merge **tanpa reviewer APPROVE** atas arahan pemilik, jadi syarat "PR green" di atas belum
  terpenuhi secara formal. Gate lokal lulus di ujung stack: ruff, pytest 401, golden statis 39,
  panggung 469.
- Perubahan Data API sesudahnya: RantAI-dev/DisparDataPlatform#32 (`/v1/katalog` field dan filter
  `sumber`, filter `tag`) dan RantAI-dev/DisparDataPlatform#33 (urutan kolom tabel numerik).
- Kode portal plan 10–19: repo `dispar-portal` belum dibuat. Keputusan 21 Okt menaruhnya sementara
  di folder `port/` repo ini; perlu dikonfirmasi ulang sebelum plan 10 dimulai.

## Di luar batch ini (sudah diketahui, sengaja ditunda)

- Memperbaiki defect data indikator (C D1–D10) dan titik di luar DKI pada `/spatial`. Ini butuh
  keputusan pemilik dan menjadi pekerjaan batch 3.
- Memindah sumber Data API ke `konform.f_*` atau mart Gold (batch 3).
- Membangun ulang `serving.mart_hotel_scraped_booking`. Data API membaca Bronze langsung (P5).
- Memperbaiki alamat server `.187` di CLAUDE.md dan docs.
- Deploy portal ke server Kominfo. Itu dikerjakan tim Disparekraf memakai paket plan 19.
