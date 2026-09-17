# Workspace Data Disparekraf DKI Jakarta

Repo ini adalah **ruang kerja bersama manusia + Claude** untuk tiga pekerjaan:

1. **Mengendalikan data** — tarik, bersihkan, dan sajikan data pariwisata DKI di lakehouse.
2. **Mengembangkan app `dispar-v2`** — dashboard Next.js yang dibaca Dinas.
3. **Men-deploy ke Portainer** — lewat MCP, tanpa SSH.

Kalau kamu Claude yang baru masuk ke repo ini: baca berkas ini sampai habis
sebelum menyentuh apa pun. Untuk onboarding manusia, lihat `docs/HANDOVER.md`.

> **Repo ini PUBLIC di GitHub.** Jangan pernah menulis password, API key, token,
> atau connection string berisi sandi ke berkas yang akan di-commit. Nilai asli
> hanya ada di **Portainer stack Env**; di repo cukup placeholder. Pola
> `*.local.md`, `.env`, dan `.env*.local` sudah di-gitignore.

---

## Peta repo

| Path | Isi | Status |
|---|---|---|
| `platform-v2/` | **App yang LIVE.** Next.js 15, baca ClickHouse. Ini yang dikerjakan sehari-hari. | aktif |
| `lakehouse/` | Mesin data: compose, ingest (Python/dlt), SQL Silver/Gold, Dagster. | aktif |
| `platform/` | App v1, baca Postgres. Masih hidup sebagai cadangan, **tidak dipakai publik**. | beku |
| `app/`, `lib/`, `components/` | App Atlas GCI (Next.js) di root repo — peta & dataset GCI/GPCI. | aktif |
| `scripts/` | Skrip pengambilan/pengayaan data satu kali (geocoding, GCI, halal, scraper). | ad-hoc |
| `data/`, `*.tsv` | Dataset mentah & hasil olahan yang jadi sumber TSV deliverable. | data |
| `buku/` | App terpisah untuk naskah buku statistika. Punya toolchain sendiri. | terpisah |
| `console/` | Submodule `RantAI-Lakehouse` — konsol operator (repo lain). | submodule |
| `docs/`, `dokumen/`, `mom/`, `report/` | Spesifikasi, notulen, laporan, KAK. | dokumen |

**`platform/` vs `platform-v2/`** — v2 adalah duplikat persis v1 (halaman dan
tema identik); yang ditukar **hanya lapisan data**: Postgres/drizzle → ClickHouse
lewat `lib/ch/store.ts`. Logika bisnis (`readiness.ts`, `indicator-data.ts`,
`IndicatorShell`) sengaja dibiarkan sama. **Kerjakan v2, bukan v1.** Kalau ada
perbaikan yang relevan untuk keduanya, tanya dulu sebelum menyentuh v1.

---

## Infrastruktur (terverifikasi 2026-09-17)

Semua berjalan di satu server Docker: **`192.168.18.187`**, dikelola Portainer
CE 2.39.4 di `https://192.168.18.187:9443`, **environment ID `3`**.
**Tidak ada akses SSH** — pubkey ditolak. Administrasi hanya lewat Portainer API/MCP.

```
Internet → Cloudflare Tunnel (dispar-cloudflared, host network)
         → localhost:13031
         → container dispar-v2 (Next.js standalone, PORT=3032)
         → lake-clickhouse:8123  (user dispar_app, read-only)
         → silver.* / serving.mart_*  ← Iceberg @ RustFS ← SDI + berkas
```

**Publik: <https://dispar.rantai.dev>**

| Stack Portainer | Id | Sumber | Isi |
|---|---|---|---|
| `dispar-platform` | **19** | **Web editor** (bukan git) | `dispar-app` (v1, siaga, tanpa port), `dispar-db` (Postgres :5433), `dispar-cloudflared` |
| `dispar-lakehouse` | **6** | git → `lakehouse/compose.yaml` | `lake-rustfs` :19000/19001, `lake-catalog` :18181, `lake-clickhouse` :18123/19440, `lake-meta` :15433, **`dispar-v2` :13031+:13032** |

Auto-update **mati** — push saja tidak mengubah apa pun sampai kamu redeploy.

> **Dua hal ganjil yang harus diingat (keadaan 17 Sep 2026):**
>
> 1. **Stack 6 masih menarik dari repo LAMA** `RantAI-dev/jakarta-restaurant-data`
>    branch `main`, bukan dari `DisparDataPlatform`. **URL repo sebuah stack
>    Portainer tidak bisa diubah** — payload `PUT /api/stacks/{id}/git` tidak punya
>    field `RepositoryURL`. Satu-satunya cara memindahkan = hapus & buat ulang stack.
>    Sampai itu dilakukan, setiap perubahan yang harus tayang **wajib didorong juga
>    ke repo lama**: `git push lama main`.
> 2. **Stack `dispar-platform` bukan git stack lagi.** Ia dibuat ulang lewat Web
>    editor (Id berubah 1 → 19), jadi compose-nya hidup di dalam Portainer dan
>    `dispar-app` memakai image `dispar-platform-dispar-app:latest` yang sudah ada,
>    bukan di-build dari `platform/compose.yaml`. Isinya jarang berubah, jadi ini
>    dibiarkan — tapi jangan heran kalau mengubah `platform/compose.yaml` di repo
>    tidak berpengaruh apa-apa.

**Di luar stack:** `lake-dagster` (:13030) jalan sebagai container **standalone**,
bukan bagian stack mana pun. Redeploy stack 6 **tidak** menyentuhnya — dan kalau
container itu dihapus, ia **tidak** akan dibuat ulang oleh compose. Hati-hati.

Container milik proyek lain di host yang sama — **jangan diganggu**:
`wa-assistant-*`, `open-webui`, `rantai-*`, `gh-runner`, `buku-*`.

---

## Alur data (Bronze → Silver → Gold)

| Lapis | Lokasi | Bentuk |
|---|---|---|
| **Bronze** | `lake.\`bronze_sdi.*\``, `bronze_file.*`, `bronze_sec.*` (Iceberg) | semua kolom `String`, apa adanya + kolom audit `_ingested_at`/`_source_url`/`_batch_id`/`_row_hash`/`_tenant` |
| **Silver** | `silver.*` (view ClickHouse) | bertipe. Auto-infer ambang 95% + kurasi tangan + dimensi bersama (`dim_negara`, `dim_bulan`) |
| **Gold** | `serving.mart_*` (MergeTree) | teragregasi, inilah yang dibaca dashboard |

Aturan yang tidak boleh dilanggar:

- **App TIDAK PERNAH fetch SDI langsung.** Semua penarikan SDI hanya lewat
  pipeline Dagster, terjadwal harian 02:00. Fallback live sudah sengaja dihapus
  dari `app/api/sdi/*`. Kalau dataset belum ada di lake → **404**, bukan fetch.
- **Baris dibaca dari Silver, bukan Bronze** (angka sudah jadi angka, tanggal jadi
  `Date`, klasifikasi BPS sudah dibersihkan). Kolom audit disembunyikan di UI.
- **Ingest Bronze WAJIB in-network.** Lakekeeper mengiklankan URL internal
  `lake-catalog:8181`, jadi pyiceberg dari luar host pasti gagal. Jalankan
  container one-shot di network `dispar-lakehouse_lakenet`. Sebaliknya, SQL +
  Silver + Gold **bisa** dikerjakan dari laptop lewat ClickHouse HTTP `:18123`.

---

## Cara kerja — tugas yang sering muncul

### Query data (paling sering)

```bash
export CH_URL=http://192.168.18.187:18123 CH_USER=dispar
export CH_PASSWORD=...   # dari Portainer stack 6 Env

curl -s "$CH_URL/?user=$CH_USER&password=$CH_PASSWORD" \
  --data-binary "SELECT * FROM serving.mart_wisman LIMIT 5 FORMAT JSONEachRow"
```

**Pilih akun yang benar:** `dispar` untuk kerja data, DDL, dan `system.*`.
`dispar_app` (read-only, dipakai app) akan gagal membaca `system.*`
(`QUERY_CACHE_USED_WITH_SYSTEM_TABLE`) dan menolak setiap perubahan setting sesi
(`READONLY`). Jangan pernah set `clickhouse_settings` dari klien app.

### Kembangkan app v2 secara lokal

```bash
cd platform-v2
cp .env.example .env.local   # isi CH_* ke 187, dan LLM_* kalau menyentuh /ai
npm install
npm run dev                  # http://localhost:3032
npx tsc --noEmit             # WAJIB lulus sebelum commit
```

Dev lokal menembak ClickHouse 187 yang sama dengan produksi — **read-only, aman**,
tapi ingat kamu sedang melihat data sungguhan.

### Deploy app v2 ke Portainer

Langkah lengkap ada di **`docs/DEPLOY-RUNBOOK.md`** (jebakan, verifikasi,
rollback), atau pakai `/deploy-v2`. Tiga jebakan yang sudah pernah menjatuhkan produksi:

1. **Redeploy stack WAJIB mengirim `Env` lengkap.** Ambil dulu
   `GET /api/stacks/6` → `.Env`, kirim ulang utuh. Kalau tidak, compose jatuh ke
   nilai default, Lakekeeper gagal auth ke volume Postgres lama, dan
   **ClickHouse + katalog mati**.
2. **Image v2 hanya di-build ulang kalau image lama dihapus.** Hapus container
   lalu `DELETE /images/dispar-v2:latest`, baru redeploy.
3. **`PORT: 3032` wajib ada di environment compose.** Dockerfile menetapkan
   `PORT=3000`, sedangkan pemetaan port memakai 3032 — kalau tidak diselaraskan,
   container berstatus "running" tapi tidak ada yang mendengar.

Dan: port **13031** hanya bisa dipegang satu container. `dispar-v2` memegangnya
sekarang; `dispar-app` (v1) harus tetap berhenti, kalau tidak bentrok port.

### Refresh data

Jadwal harian sudah jalan sendiri (Dagster 02:00). Untuk memaksa:
`/refresh-data`, atau trigger job `refresh_lakehouse` di Dagster UI :13030.

---

## Aturan untuk Claude di repo ini

**Verifikasi, jangan mengarang.** Angka apa pun yang masuk ke laporan, notulen,
atau paparan harus berasal dari sistem yang benar-benar jalan — query ClickHouse,
bukan ingatan atau perkiraan. Kalau belum diverifikasi, bilang belum.

**Produksi itu hidup.** `dispar.rantai.dev` dipakai Dinas. Sebelum tindakan yang
mengubah keadaan server (redeploy, hapus image, ubah Env, restart), **konfirmasi
dulu** kecuali diminta eksplisit. Membaca (list stack, inspect container, query
SELECT) bebas dilakukan.

**Jangan sentuh container proyek lain** di host 187. Lihat daftar di atas.

**Bahasa:** dokumen, komentar kode, dan pesan commit dalam **Bahasa Indonesia**
— ikuti gaya yang sudah ada. Istilah teknis (commit, deploy, query, stack)
biarkan apa adanya.

**Sebelum commit:** `npx tsc --noEmit` di paket yang disentuh harus lulus.
Jangan klaim "sudah jalan" tanpa menjalankannya.

**Secret:** kalau butuh nilai asli, ambil dari Portainer stack Env saat itu juga
— jangan menyalinnya ke berkas repo, jangan menampilkannya di dokumen yang akan
di-commit.

---

## Skill — tiga pekerjaan utama

Tiga jenis pekerjaan paling sering di repo ini punya skill sendiri di
`.claude/skills/`. **Panggil skill-nya sebelum mulai**, jangan mengarang prosedur:

| Skill | Dipakai saat |
|---|---|
| `crawling-data` | mengambil data dari luar lakehouse — crawl, scrape, geocode, enrich, Places/OSM/Booking |
| `laporan-bulanan-tenaga-ahli` | menyusun laporan bulanan 7 tenaga ahli (docx→pdf) |
| `menambah-halaman-dispar-v2` | menambah/mengubah halaman atau route API di `platform-v2/` |

## MCP yang dipakai

`.mcp.json` di root mendaftarkan server **`portainer`**. Ia butuh dua env di
mesinmu sebelum Claude Code dijalankan:

```bash
export PORTAINER_URL=https://192.168.18.187:9443
export PORTAINER_API_KEY=ptr_...   # buat sendiri, satu key per orang
export PORTAINER_TLS_VERIFY=false  # sertifikat self-signed
```

Tool yang paling sering: `StackList`, `StackInspect`, `StackGitRedeploy`,
`docker_proxy` (proxy mentah ke Docker API — `path` tidak boleh mengandung `?`,
pakai `query_params`).

---

## Bacaan lanjutan

| Berkas | Isi |
|---|---|
| `docs/HANDOVER.md` | Onboarding engineer baru: akses, setup hari-1, runbook deploy & data |
| `lakehouse/README.md` | Arsitektur lakehouse, cara jalan dari nol, ops (backup/quality/maintenance) |
| `docs/superpowers/specs/2026-08-12-lakehouse-design.md` | Keputusan desain + alasan penolakan Airbyte/MinIO/DuckDB |
| `platform-v2/README.md` | Halaman, struktur, env app v2 |
| `dokumen/arsitektur.md` | Arsitektur tingkat tinggi untuk pembaca non-teknis |
| `https://dispar.rantai.dev/docs` | Referensi REST API yang live |
