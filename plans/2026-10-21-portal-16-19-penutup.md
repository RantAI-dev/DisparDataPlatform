# Plan 16–19 — Portal: sistem, paritas penuh, dokumen, paket deploy

---

## Plan 16 — Sistem: sinkron, snapshot, log admin, bersihkan-log (needs 12–15)

Branch `feat/sistem`. Commit `feat(sistem): job sinkron, snapshot cadangan, dan api log`.

**Hasil:**

- Command `portal:sinkron`:
  - Daftar kuncinya diambil **otomatis** dari rute ber-`kelas` T dan atribut `varian` masing-
    masing, misalnya 28 kode indikator dan tahun event yang tertulis di config. Daftar ini
    **tidak** diturunkan dari respons endpoint P.
  - Endpoint kelas P tidak pernah masuk `SNAPSHOT`.
  - Untuk setiap kunci: panggil Data API, lalu upsert `SNAPSHOT` bila `HASH` berubah.
    Kegagalan per kunci dicatat, dan snapshot lama tidak dihapus.
  - Ringkasan di `JOB_RUNS`: jumlah ok, berubah, dan gagal.
- `app/Console/Kernel.php`:
  - `portal:sinkron` setiap hari pukul `config('portal.sinkron_jam', '11:00')` zona
    Asia/Jakarta, `withoutOverlapping`;
  - `portal:bersihkan-log` mingguan (retensi 180 hari).
- Rute `sistem/*` sesuai KONTRAK §2.7 (ability admin).
- Perilaku baca kelas T sudah dibuat di plan 10 (`BacaTetap`) dan dipakai sejak plan 12.
  Plan ini hanya mengisinya secara terjadwal.

**Skenario uji:**

- sinkron semua sukses;
- sebagian gagal (snapshot lama tetap);
- hash sama → tidak menulis;
- `withoutOverlapping`;
- stale flag;
- snapshot hilang dan Data API mati → 503;
- bersihkan-log menghapus tepat yang lebih tua dari 180 hari;
- endpoint log: filter modul dan tanggal, paging;
- ability read ditolak di rute admin;
- pemicu manual tercatat dengan `PEMICU=manual`.

**Kriteria:** dengan Data API lokal dimatikan, perilaku setiap halaman sesuai tabel di
`docs/skenario/sistem.md`. Tabel itu ditulis di plan ini, dengan satu baris per rute:

- "utuh" untuk rute yang semua endpointnya T;
- "sebagian" untuk rute yang punya bagian P, dengan daftar bagian yang menampilkan teks error
  yang sama dengan Next.js saat datanya gagal;
- "tidak tersedia" untuk rute yang sepenuhnya P.

Playwright membuktikan setiap baris tabel.

---

## Plan 17 — Paritas penuh (needs 16)

Branch `test/paritas-penuh`. Commit `test(paritas): suite paritas seluruh rute`.

- Gabungkan `tests/parity/*.spec.ts` menjadi satu suite `npm run paritas`.
- Suite menjalankan **semua 26 rute + 6 redirect** pada 1440×900 dan 390×844, ditambah tiap
  skenario interaksi.
- Laporan:
  - `docs/paritas/laporan-<tanggal>.md`: tabel rute → beda piksel %, angka sama/beda, interaksi
    lulus/gagal, pengecualian yang dipakai;
  - HTML Playwright sebagai artefak CI.
- Daftar instance rute dinamis yang diuji:
  - **28** kode indikator (semua);
  - 3 slug `/sdi/[slug]` dari plan 11;
  - semua tahun event yang tersedia.
- Mask: iframe Google Maps, tile peta, dan cap waktu "data per …".
- Dijalankan setelah `portal:sinkron` hari itu (SPEC §7), lokal.
- Hapus halaman `/_kerangka`.
- Bandingkan juga **performa**: LCP dan total transfer per rute (Lighthouse CI atau Playwright
  tracing), dicatat saja, bukan gate. Portal tidak boleh jauh lebih lambat dari produksi; lebih
  dari 2× → laporkan.

**Kriteria:** semua rute lulus ambang SPEC §7. Rute yang gagal ambang hanya boleh lewat dengan
persetujuan tertulis pemilik di PR.

---

## Plan 18 — Dokumen serah terima (needs 17)

Branch `docs/serah-terima`. Commit `docs: data diagram, flowchart, unit test, manual book, api`.

Isi sesuai SPEC §8. Semua di `docs/`, sebagai Markdown + Mermaid, diekspor ke PDF lewat
`scripts/ekspor-dokumen.sh` (pandoc + mermaid-cli). Ekspor DOCX juga disediakan untuk manual
book.

1. `docs/data-diagram.md`:
   - ERD Oracle, yang dihasilkan dari migration dengan skrip, bukan digambar tangan;
   - diagram alir data;
   - kamus data per endpoint (field, tipe, arti, sumber tabel lake).
2. `docs/flowchart/*.md`: satu per fitur (8), sinkron, autentikasi, dan log history.
3. `docs/unit-testing.md`:
   - gabungan semua `docs/skenario/*.md` (ID, deskripsi, berkas tes, status dari laporan JUnit
     terakhir), plus cakupan backend dan frontend;
   - dihasilkan oleh skrip dari laporan CI, tidak ditulis tangan.
4. `docs/manual-book/`:
   - panduan pengguna per halaman, dengan tangkapan layar dari Playwright
     (`npm run tangkapan`);
   - panduan admin: membuat token, membaca log, memicu sinkron;
   - panduan operasi: env, cron, pemulihan bila Data API mati, rotasi token.
5. `docs/api/`: `openapi.json` yang dibekukan dari scramble, plus penjelasan aturan API
   (autentikasi, envelope, kode error, tanpa PATCH, log).
6. `docs/data-api/`: salinan `openapi.yaml` Data API pada SHA yang dideploy, daftar skenario
   tesnya, dan panduan operasi (token, rotasi token, flush cache, batas 100.000 baris, siapa
   yang dihubungi bila Data API mati).

**Kriteria:**

- Semua dokumen dibangun ulang dengan satu perintah, dan isinya cocok dengan kode (skrip gagal
  bila ada rute tanpa flowchart, atau skenario tanpa tes).
- Bahasa Indonesia.

---

## Plan 19 — Paket deploy + panduan pindah GitLab (needs 16)

Branch `feat/paket-deploy`. Commit `feat(deploy): paket container dan panduan migrasi gitlab`.

- `deploy/backend.Dockerfile`: php 8.2-fpm + nginx + Oracle Instant Client 19 + ext oci8;
  `php artisan config:cache route:cache`; healthcheck `/api/v1/sistem/kesehatan`.
- Konfigurasi nginx dan php-fpm dengan timeout ekspor 300 s dan `fastcgi_buffering off` untuk
  rute ekspor.
- `deploy/frontend.Dockerfile`: node 20, `nuxt build`, `node .output/server/index.mjs`.
- `deploy/scheduler`: container yang sama dengan backend dengan perintah `schedule:work`,
  atau entri crontab untuk bare metal. Keduanya didokumentasikan.
- `deploy/compose.yaml` contoh (tanpa Oracle; Oracle milik server mereka) dan `.env.example`
  backend dan frontend dengan placeholder.
- `deploy/README.md`:
  - prasyarat (Oracle user/skema, egress ke `data-api.rantai.dev`, dan bila memungkinkan ke
    `services.arcgisonline.com`);
  - urutan pertama kali: migrate, seed akun layanan, buat token, isi env, jalankan, cek
    kesehatan;
  - dump SQL Oracle (`database/oracle/*.sql`).
- `docs/pindah-gitlab.md`: `git push --mirror`, variabel CI di GitLab, runner yang dibutuhkan
  (Docker + service Oracle XE), dan hal yang berubah di `.gitlab-ci.yml`.

**Kriteria:**

- Kedua image ter-build di CI.
- `docker compose -f deploy/compose.yaml up` melawan Oracle XE lokal dan Data API lokal
  berjalan sampai halaman `/` dan `/dashboard/wisman` tampil.
