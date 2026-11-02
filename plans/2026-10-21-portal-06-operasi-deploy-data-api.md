# Plan 06 — OPERASI: image Dagster baru + deploy Data API + hostname publik

**Ini operasi produksi, bukan PR biasa.** Plan ini hanya dimulai setelah pemilik menulis
"lanjut deploy". Ikuti `docs/DEPLOY-RUNBOOK.md` dan CLAUDE.md "Deploy app v2". Ketiga jebakan
redeploy stack 6 berlaku.

Butuh: 01–05 selesai dan sudah ada di `main`.

## Langkah aktual (persiapan 3 Nov 2026)

Teks asli di bawah ditulis 21 Okt. Sejak itu cara deploy berubah: stack 6 bukan git stack lagi
(`StackGitRedeploy` gagal, `StackUpdate` pernah menjatuhkan ClickHouse), `dispar-v2` dan
`lake-dagster` kini container **mandiri** yang di-deploy dengan swap container, dan push ke
remote `lama` tidak diperlukan. Bila bertentangan dengan teks asli, **bagian ini yang berlaku**.

### Inventaris (hanya baca, 3 Nov 2026)

| Hal | Nilai |
|---|---|
| Server / environment | 192.168.18.148, Portainer endpoint `3` (`local`) |
| Stack | `dispar-lakehouse` Id 6 (bukan git), `dispar-platform` Id 19 (memuat `dispar-cloudflared`) |
| `dispar-v2` | mandiri, image `dispar-v2:43dec61`, network `dispar-lakehouse_lakenet`, membawa `CH_USER`/`CH_PASSWORD` (`dispar_app`) |
| `lake-dagster` | mandiri, image `dispar-lake-dagster:43dec61`, volume `dispar-lakehouse_lake_dagster:/opt/dagster`, port 13030, belum punya `DATA_API_FLUSH_TOKEN` |
| Port 13040 | bebas |
| Tunnel | `dispar-cloudflared` network host, **token** (dikelola dari dashboard Cloudflare, tanpa berkas config lokal) → hostname ditambah pemilik di dashboard |
| Daftar indikator di lake | `bronze_file.gci_gpci_indicators` 28 baris = `data/gci-gpci-indicators.json` termasuk `officialNo` (diingest lewat registri sumber 27 Okt). **Bagian A langkah 4–5 asli sudah terpenuhi**; yang tersisa hanya hook flush |

### Yang sudah disiapkan (branch `feat/plan-06-persiapan`, PR ke `main`)

- Aset Dagster `flush_data_api` di akhir `refresh_lakehouse` (`DATA_API_FLUSH_TOKEN`, tidak pernah
  menggagalkan job).
- `lakehouse/data-api` disamakan dengan ujung PR portal (#38/#40/#47: alamat titik spasial, konteks
  indikator, katalog sekunder 51 entri), supaya deploy tidak menunggu review PR portal.
- `scripts/deploy-data-api.sh` dan `scripts/deploy-dagster.sh`: pola `deploy-v2.sh` (build di laptop,
  `images/load`, swap container, rollback otomatis). `--cek` = build + smoke test + cek server
  hanya baca, **tidak mengubah server**. Keduanya lulus `--cek` pada 3 Nov.
- Container Data API: `dispar-data-api`, port `13040:8080`, network `lakenet` alias
  `dispar-data-api`, `mem 512m`, `unless-stopped`, healthcheck `python -c`, `DATA_API_ENV=produksi`,
  `CH_URL`/`CH_USER`/`CH_PASSWORD` disalin dari `dispar-v2` di server (akun read-only
  `dispar_app`, tidak pernah tercetak). Tanpa layanan baru di `lakehouse/compose.yaml` (stack 6 tidak
  di-redeploy sama sekali).

### Eksekusi (setelah "lanjut deploy" dan PR persiapan di-merge ke `main`)

Jalankan dari checkout `main` terbaru, berurutan, **tidak bersamaan dengan `refresh_lakehouse`**
(skrip Dagster menolak bila ada run aktif) atau deploy `dispar-v2`.

1. **Token** (di laptop operator, di luar repo):
   ```bash
   umask 077; mkdir -p ~/.dispar-rahasia
   for n in kominfo dagster; do head -c 32 /dev/urandom | base64 | tr -d '/+=\n' > ~/.dispar-rahasia/data-api-$n; done
   hash_token() { printf %s "$(cat ~/.dispar-rahasia/data-api-$1)" | sha256sum | cut -c1-64; }
   export DATA_API_TOKENS="kominfo:$(hash_token kominfo),dagster:$(hash_token dagster)"
   ```
   Token `kominfo` (mentah) diserahkan langsung ke pemilik untuk Laravel (`DATA_API_TOKEN`); tidak
   ditulis ke berkas repo, PR, atau laporan.
2. **Data API:** `scripts/deploy-data-api.sh --cek`, lalu `scripts/deploy-data-api.sh`. Hasil: container
   `dispar-data-api` healthy (dicek dari server).
3. **Dagster:** `scripts/deploy-dagster.sh --cek`, lalu
   `DATA_API_FLUSH_TOKEN="$(cat ~/.dispar-rahasia/data-api-dagster)" scripts/deploy-dagster.sh`.
   Lama → `lake-dagster-rollback-<sha>`; jadwal dan riwayat tetap (volume yang sama).
4. **Refresh:** picu `refresh_lakehouse` sekali (GraphQL `launchPipelineExecution` ke `:13030`,
   `repositoryLocationName: "dispar_orchestrate.definitions"`, `repositoryName: "__repository__"`,
   hanya fragmen `LaunchRunSuccess`/`PythonError`) dan tunggu sukses (±50–100 menit). Log aset
   `flush_data_api` harus "sukses: HTTP 200".
5. **Hostname (pemilik):** tambah public hostname `data-api.rantai.dev` → `http://localhost:13040` di
   tunnel `dispar-cloudflared` (dashboard Cloudflare). Lalu cek WAF/Bot Fight Mode dengan `curl`
   ber-User-Agent non-browser dari luar LAN → 200/401 JSON, bukan halaman tantangan.
6. **Verifikasi** seperti bagian "Verifikasi" di bawah; ganti butir "Image Id dan StartedAt" dengan
   container yang memang tidak boleh tersentuh: `lake-clickhouse`, `lake-catalog`, `lake-rustfs`,
   `lake-meta`, `dispar-v2`, `dispar-cloudflared`.

### Rollback (aktual)

- Data API: `dispar-data-api` tidak dipakai komponen lain; hentikan/hapus, atau rename
  `dispar-data-api-rollback-<sha>` kembali (dilakukan otomatis bila verifikasi gagal).
- Dagster: rename `lake-dagster-rollback-<sha>` kembali (otomatis bila `/server_info` gagal);
  tanpa token flush, aset `flush_data_api` hanya mencatat "dilewati".
- Hostname: dihapus pemilik di dashboard Cloudflare.

## Pengenal server (cari dulu, hanya baca)

- Server sekarang 192.168.18.148. CLAUDE.md masih menulis `.187` / environment `3`.
- Lewat MCP Portainer:
  - `EndpointList` untuk environment ID di .148;
  - `StackList` untuk Id stack `dispar-lakehouse` (dulu 6) dan stack yang memuat
    `dispar-cloudflared` (dulu 19);
  - `StackInspect` untuk `GitConfig`, termasuk repo, branch, dan commit yang terakhir dideploy.
- Tulis keempatnya di laporan sebelum menyentuh apa pun.

## Bagian A — image Dagster (daftar indikator + hook flush)

`lake-dagster` berjalan dari image `shirologic/dispar-lake-dagster:${DAGSTER_TAG}` (profil
compose `orchestrate`, dibangun `lakehouse/scripts/build-dagster-image.sh`). Redeploy stack 6
**tidak** menyentuhnya.

1. **PR persiapan** (branch `feat/dagster-flush-data-api`):
   - Aset atau langkah akhir di `lakehouse/orchestrate/` memanggil
     `POST http://dispar-data-api:8080/v1/admin/cache/flush`, dengan token dari env
     `DATA_API_FLUSH_TOKEN`.
   - Kegagalan panggilan dicatat ke log, tidak menggagalkan job. Env kosong → langkah dilewati.
   - Tes Python Dagster lulus.
2. Bangun image dengan tag baru lewat `build-dagster-image.sh`, lalu dorong ke registry.
   Prosedurnya ada di `lakehouse/README.md`; bila tidak tertulis, STOP dan tanya.
3. Ganti `DAGSTER_TAG` dan buat ulang container `lake-dagster` dengan cara yang tertulis di
   runbook atau README. Ingat container ini **standalone** (CLAUDE.md): bila prosedur
   pembuatan ulangnya tidak jelas, STOP.
4. Picu `refresh_lakehouse` sekali (Dagster UI / GraphQL `launchRun`) dan tunggu sukses.
5. Verifikasi: `bronze_file.gci_gpci_indicators` sama dengan
   `platform-v2/data/gci-gpci-indicators.json`, per field, termasuk `officialNo`.

## Bagian B — container Data API

1. **PR persiapan** (branch `feat/data-api-deploy`, commit
   `feat(lakehouse): layanan dispar-data-api di compose`). Service baru `dispar-data-api` di
   `lakehouse/compose.yaml`:
   - build `lakehouse/data-api`, `container_name: dispar-data-api`;
   - port `13040:8080`, network `lakenet`;
   - environment:
     - `CH_URL: http://lake-clickhouse:8123`
     - `CH_USER: dispar_app`
     - `CH_PASSWORD: ${CH_APP_PASSWORD:-disparapp}` (variabel yang sama dengan `dispar-v2`,
       `compose.yaml:214`)
     - `DATA_API_TOKENS: ${DATA_API_TOKENS}` (app menolak start bila kosong, SPEC §3.3)
   - `mem_limit: 512m`, `restart: unless-stopped`, `depends_on` ClickHouse healthy;
   - healthcheck memakai `python -c` (image slim tidak punya curl).

   Uji: `docker compose -f lakehouse/compose.yaml config` valid.
2. **Sebelum menyentuh server:**
   - Port 13040 di host belum dipakai (cek daftar container lewat `docker_proxy`, hanya baca).
   - Ambil `GET /api/stacks/{id}` → `.Env`, simpan di `/tmp/stack6-env.json` dengan `chmod 600`,
     lalu hapus di akhir operasi.
   - Buat token acak `kominfo` (untuk Laravel) dan `dagster`. Hash sha256 masuk Env; nilai
     mentahnya hanya diserahkan langsung ke pemilik.
3. **Deploy:**
   - Dorong ke `origin` dan ke remote `lama`. Stack masih menarik dari repo lama.
   - Sebelumnya: `git diff <commit-terdeploy>..HEAD -- lakehouse/` di `lama` hanya boleh berisi
     perubahan batch ini. Bila ada perubahan lain: STOP.
   - Redeploy stack dengan `Env` lengkap + `DATA_API_TOKENS`. **Jangan** menghapus image
     `dispar-v2`.
   - Isi `DATA_API_FLUSH_TOKEN` di env `lake-dagster` sesuai prosedur bagian A langkah 3.
4. **Hostname** (hanya pemilik yang mengubah):
   - `dispar-cloudflared` berada di stack Web-editor yang mungkin juga melayani hostname proyek
     lain. Executor **hanya membaca** konfigurasinya.
   - Pemilik menambah public hostname **[K-2] `data-api.rantai.dev`** → `http://localhost:13040`.
   - Setelah itu periksa bahwa Cloudflare WAF / Bot Fight Mode tidak menantang panggilan
     server-ke-server: `curl` dari luar LAN dengan User-Agent non-browser → 200 / 401 JSON,
     bukan halaman tantangan.

## Verifikasi

- `curl https://data-api.rantai.dev/v1/health` → 200.
- Tanpa token → 401 JSON. `/docs` dan `/openapi.json` → 404.
- Dengan token `kominfo`: `/v1/katalog`, `/v1/dashboard/ringkasan`,
  `/v1/indikator?framework=GCI`, `/v1/atlas/golf`, `/v1/spasial` → 200, dan isinya sama dengan
  panggung lokal.
- `https://dispar.rantai.dev` tetap 200, dan `/dashboard/wisman` menampilkan angka yang sama
  dengan sebelum deploy.
- Image Id **dan** `StartedAt` untuk `lake-clickhouse`, `lake-catalog`, `lake-rustfs`,
  `lake-meta`, dan `dispar-v2` sama dengan sebelum deploy.
- Run `refresh_lakehouse` berikutnya mencatat panggilan flush yang sukses.

## STOP (berhenti, laporkan, jangan improvisasi)

- `.Env` stack kosong atau jumlah kuncinya lebih sedikit dari yang terlihat di Portainer UI.
- Ada perubahan tak terkait di `lakehouse/` antara commit terdeploy dan HEAD.
- Ada container lain yang image Id atau `StartedAt`-nya berubah.
- `dispar.rantai.dev` bukan 200 setelah redeploy. **Rollback segera**, lalu laporkan.
- Tunnel memakai berkas config lokal yang harus diedit executor.
- Prosedur build, push, atau buat-ulang `lake-dagster` tidak tertulis.

## Rollback

- Stack git Portainer tidak bisa redeploy "commit lama". Rollback = `git revert` commit
  batch ini, dorong ke `lama main`, lalu redeploy dengan `Env` yang disimpan.
- Hapus hostname di Cloudflare (pemilik).
- Kembalikan `DAGSTER_TAG` lama.
- Container `dispar-data-api` tidak dipakai komponen lain, jadi menghapusnya aman.

## Laporan

Tulis ke handoff:

- Id environment dan stack, SHA, Id container;
- hasil setiap `curl` (status dan ukuran);
- tag Dagster lama dan baru;
- waktu deploy.

Token **tidak** ditulis. `/tmp/stack6-env.json` sudah dihapus.
