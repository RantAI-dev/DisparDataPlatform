# Handover — Platform Data Disparekraf DKI Jakarta

Untuk engineer yang baru bergabung. Target: dalam ~1 jam kamu bisa menjalankan
app-nya, meng-query datanya, dan men-deploy perubahan.

Baca juga [`../CLAUDE.md`](../CLAUDE.md) — itu peta kerja untuk kamu *dan* untuk
Claude. Kalau kamu memakai Claude Code, berkas itu terbaca otomatis.

---

## 1. Apa yang sebenarnya kita bangun

Disparekraf DKI butuh satu tempat di mana seluruh data pariwisata Jakarta bisa
dipercaya dan dibandingkan — untuk laporan Dinas, dan untuk indikator daya saing
kota (GCI/GPCI). Datanya tersebar: Satu Data Jakarta (SDI), berkas Excel dari
bidang, hasil pendataan lapangan, sumber publik.

Jawabannya sebuah **lakehouse** kecil di satu server, plus dashboard di atasnya:

```
SDI + berkas Excel + pendataan
        ↓  Dagster, harian 02:00
   Bronze   Iceberg @ RustFS — apa adanya, semua kolom String, ada jejak audit
        ↓
   Silver   view ClickHouse bertipe — angka jadi angka, tanggal jadi Date,
            klasifikasi BPS dibersihkan
        ↓
   Gold     serving.mart_* — agregat siap pakai
        ↓
   app dispar-v2 (Next.js)  →  https://dispar.rantai.dev
```

Dua batasan yang menjelaskan hampir semua keputusan teknis di repo ini:

1. **Semua komponen harus Apache 2.0/MIT.** Modelnya SaaS multi-tenant + produk
   on-prem berlisensi. Karena itu Airbyte ditolak (ELv2), MinIO ditolak (AGPL,
   community edition mati Feb 2026), dbt Core dilewati demi SQLMesh.
2. **Harus bisa pindah ke Oracle** kalau Dinas memintanya. Karena itu data
   disimpan sebagai **Iceberg di object storage**, bukan di dalam engine —
   engine bisa diganti tanpa memigrasikan data.

Alasan lengkap: `docs/superpowers/specs/2026-08-12-lakehouse-design.md`.

---

## 2. Akses yang perlu kamu minta

| Akses | Cara dapat |
|---|---|
| **Repo GitHub** | minta Evan tambahkan kamu ke `RantAI-dev` |
| **Portainer** | `https://192.168.18.187:9443` — minta akun, lalu **buat access token sendiri** (My account → Access tokens). Jangan pakai ulang token orang lain. |
| **Jaringan** | server ada di LAN `192.168.18.0/24`. Dari luar kantor perlu VPN. |
| **Kredensial stack** | password manager dari Evan. Sumber kebenarannya **Portainer stack Env**, bukan catatan. |

**Tidak ada SSH ke server** — pubkey ditolak. Semua administrasi lewat Portainer
API/UI. Ini bukan kekurangan yang perlu "diperbaiki" diam-diam; kalau mau
mengubahnya, bicarakan dulu.

---

## 3. Setup hari pertama

```bash
git clone https://github.com/RantAI-dev/DisparDataPlatform.git
cd DisparDataPlatform
# Semua kerja ada di `main`. Lihat §7 soal repo lama yang masih melayani deploy.

# app yang LIVE
cd platform-v2
npm install
cp .env.example .env.local               # isi CH_* (nilai dari Evan/Portainer)
npm run dev                              # http://localhost:3032 (bukan 3031)
```

Kalau beranda tampil dengan data, koneksi ke lakehouse sudah benar.

Uji ClickHouse langsung:

```bash
curl -s "http://192.168.18.187:18123/?user=dispar&password=<CH_PASSWORD>" \
  --data-binary "SELECT count() FROM serving.mart_wisman"
```

### Supaya Claude Code bisa menyentuh server

```bash
export PORTAINER_URL=https://192.168.18.187:9443
export PORTAINER_API_KEY=ptr_...        # token milikmu sendiri
export PORTAINER_TLS_VERIFY=false       # sertifikat self-signed
```

`.mcp.json` di root sudah mendaftarkan server MCP `portainer`; Claude Code akan
menanyakan persetujuan saat pertama kali dipakai. Sesudah itu:

| Perintah | Gunanya |
|---|---|
| `/status-infra` | cek kesehatan semua komponen (read-only, aman dicoba kapan saja) |
| `/deploy-v2` | deploy app v2 ke produksi |
| `/refresh-data` | segarkan data lakehouse |

Mulailah dengan `/status-infra` — tidak mengubah apa pun, dan langsung memberi
gambaran utuh.

---

## 4. Peta server

Satu host: **`192.168.18.187`** (Ubuntu 26.04, 12 CPU / 33 GB, Docker 29.6.1),
Portainer CE 2.39.4, **environment ID `3`**.

| Stack | Id | Isi | Port host |
|---|---|---|---|
| `dispar-platform` | 1 | `dispar-app` (v1, siaga), `dispar-db` Postgres, `dispar-cloudflared` | 5433 |
| `dispar-lakehouse` | 6 | `lake-rustfs`, `lake-catalog`, `lake-clickhouse`, `lake-meta`, **`dispar-v2`** | 19000/19001, 18181, **18123**/19440, 15433, **13031**/13032 |

Di luar stack: **`lake-dagster`** (:13030) container standalone. Redeploy stack
tidak menyentuhnya — dan kalau terhapus, compose **tidak** membuatnya ulang.

Alamat yang sering dipakai:

- <https://dispar.rantai.dev> — produksi (lewat Cloudflare Tunnel → `localhost:13031`)
- <http://192.168.18.187:13032> — app v2 langsung dari LAN
- <http://192.168.18.187:13030> — Dagster (pipeline, jadwal, lineage)
- `http://192.168.18.187:18123` — ClickHouse HTTP

**Jangan sentuh** container proyek lain di host ini: `wa-assistant-*`,
`open-webui`, `rantai-*`, `gh-runner`, `buku-*`.

---

## 5. Runbook

### Mengubah app v2

1. Kerjakan di `platform-v2/` (**bukan** `platform/` — itu v1 yang beku).
2. `npx tsc --noEmit` harus lulus.
3. Commit, push ke `main` — **lalu baca §7**: stack masih menarik dari repo lama,
   jadi perubahan belum akan tayang sampai §7 diselesaikan atau didorong juga ke
   sana.
4. `/deploy-v2`, atau ikuti `platform-v2/DEPLOY.md`.

**Push saja tidak men-deploy apa pun** — auto-update stack sengaja dimatikan.

### Tiga jebakan deploy yang pernah menjatuhkan produksi

1. **Redeploy stack wajib mengirim `Env` lengkap.** Ambil `GET /api/stacks/6` →
   `.Env` dulu, kirim ulang utuh. Tanpa itu compose jatuh ke nilai default,
   Lakekeeper gagal auth ke volume Postgres lama, dan **ClickHouse + katalog ikut
   mati** — bukan hanya app-nya.
2. **Image tidak dibangun ulang kalau image lama masih ada.** Hapus container →
   `DELETE /images/dispar-v2:latest` → redeploy. Kalau dilewati, deploy jadi
   no-op yang terlihat sukses.
3. **`PORT: 3032` wajib ada di environment compose.** Dockerfile menetapkan
   `PORT=3000`; tanpa penyelarasan, container "running" tapi tak ada yang
   mendengar.

Dan: port **13031** hanya bisa dipegang satu container. `dispar-v2` memegangnya;
`dispar-app` (v1) harus tetap berhenti.

### Menambah atau menyegarkan data

Jadwal harian sudah berjalan. Untuk manual: `/refresh-data`.

Yang perlu diingat: **ingest Bronze wajib in-network.** Lakekeeper mengiklankan
URL internal `lake-catalog:8181`, jadi pyiceberg dari luar host pasti gagal —
jalankan container one-shot di network `dispar-lakehouse_lakenet`. Sebaliknya
Silver + Gold **bisa** dikerjakan dari laptop lewat ClickHouse HTTP `:18123`.

### Menjawab pertanyaan data

`/status-infra` untuk kesehatan sistem; untuk isi data, minta Claude memakai agen
`data-lakehouse`. Mulai dari `silver.*` dan `serving.mart_*`, jangan dari Bronze.
Gunakan user ClickHouse `dispar` (bukan `dispar_app` — read-only dan tidak bisa
membaca `system.*`).

---

## 6. Yang masih menjadi utang (jujur)

| Hal | Keadaan |
|---|---|
| **Backup offsite** | backup inkremental jalan, tapi masih ke bucket di **host yang sama**. Kalau disk mati, data ikut. Isi `BACKUP_S3_*` ke storage lain. |
| **`/ai` di produksi** | kode sudah ada, tapi `LLM_KEY` belum di-set di stack 6 → fitur belum aktif di server. |
| **Key dipakai bersama** | API key Portainer dan key MiniMax dipakai lintas orang/proyek. Pisahkan. |
| **Ingest inkremental** | masih full-overwrite. Aman di volume sekarang (~260k baris), tidak akan awet. |
| **TLS antar komponen** | belum. Semua trafik internal `lakenet` polos. |
| **CI/CD** | belum ada. Deploy masih manual lewat Portainer. |
| **RBAC & schema-drift contract** | belum. |
| **Dagster di luar stack** | `lake-dagster` standalone, tidak ter-manage compose. Rapuh — sebaiknya dimasukkan ke stack. |
| **`platform/` (v1)** | masih hidup sebagai cadangan. Suatu saat perlu diputuskan: pensiunkan atau rawat. |

Riwayat insiden yang layak diingat: **12 Agustus 2026** disk lokal btrfs ENOSPC
(metadata 93%) sempat mematikan container lakehouse. Data selamat. Perbaikan:
bersihkan cache uv/bun/npm + `btrfs balance`.

---

## 7. Pindah repo — SETENGAH JALAN, baca ini

Kode sudah pindah ke **`RantAI-dev/DisparDataPlatform`** (branch `main`, riwayat
penuh). **Tetapi kedua Portainer stack MASIH menarik dari repo lama**
`RantAI-dev/jakarta-restaurant-data`, branch `deploy/portainer-selfhost`.

> **Akibatnya, sampai `GitConfig` stack diperbarui: push ke repo baru TIDAK akan
> pernah ter-deploy.** Redeploy akan diam-diam membangun ulang kode lama dan
> terlihat sukses. Ini jebakan paling berbahaya di repo ini saat ini.

Selama masa peralihan ada dua pilihan, pilih satu dan konsisten:

- **(A) Selesaikan pindahnya** — perbarui `GitConfig` stack **1**
  (`dispar-platform`) dan **6** (`dispar-lakehouse`): ganti `URL` ke repo baru dan
  `ReferenceName` ke `refs/heads/main`. Lewat Portainer UI (Stack → Git settings)
  atau `PUT /api/stacks/{id}/git`. Sesudahnya jalankan `/status-infra` dan
  pastikan <https://dispar.rantai.dev> masih `200`.
- **(B) Belum siap pindah** — tiap kali ada perubahan yang harus tayang, dorong
  juga ke repo lama:
  ```bash
  git push lama main:deploy/portainer-selfhost
  ```
  (remote `lama` = `jakarta-restaurant-data`, sudah terpasang di klon Evan.)

Repo baru dibuat **public**. Konsekuensinya sama dengan repo lama: disiplin
"jangan pernah commit rahasia" tetap berlaku sepenuhnya. Kalau nanti dijadikan
private, stack juga butuh kredensial git (`GitConfig.Authentication`, sekarang
`null`) — dan sebagai gantinya seluruh kelas risiko itu hilang.

---

## 8. Kebiasaan kerja

- **Bahasa Indonesia** untuk dokumen, komentar, dan pesan commit.
- **Angka harus dari sistem yang jalan.** Apa pun yang masuk laporan atau paparan
  ke Dinas harus berasal dari query yang benar-benar dijalankan — bukan ingatan,
  bukan perkiraan.
- **Repo ini publik** (untuk sekarang). Jangan pernah commit password, API key,
  token, atau connection string berisi sandi.
- **Produksi dipakai Dinas.** Baca sepuasnya; konfirmasi sebelum mengubah.
- **"Container running" bukan bukti aplikasi hidup.** Curl dulu, baru bilang
  sukses.
