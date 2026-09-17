# Runbook Deploy — app dispar-v2 ke produksi

Panduan lengkap untuk men-deploy perubahan `platform-v2/` ke
<https://dispar.rantai.dev>. Ditulis supaya bisa dijalankan **sendirian**, tanpa
bertanya ke siapa pun.

Baca sekali sampai habis sebelum deploy pertamamu. Setelah paham, `/deploy-v2`
di Claude Code menjalankan langkah yang sama.

> **Produksi ini dipakai Dinas.** Deploy di jam kerja boleh, tapi ada jeda
> ±1–3 menit saat container dibangun ulang. Kalau perubahanmu tidak mendesak,
> deploy di luar jam sibuk.

---

## 0. Sekali saja — siapkan akses

| Butuh | Cara |
|---|---|
| Akun Portainer | minta ke Evan |
| **API key sendiri** | Portainer → ikon user → *My account* → **Access tokens** → *Add access token*. **Jangan pakai token orang lain** — kalau dicabut, punyamu ikut mati. |
| Jaringan | server ada di LAN `192.168.18.0/24`; dari luar kantor perlu VPN |
| Sandi stack | `docs/HANDOVER-CREDENTIALS.local.md` (tidak ada di repo — minta ke Evan lewat password manager) |

```bash
export PORTAINER_URL=https://192.168.18.187:9443
export PORTAINER_API_KEY=ptr_...        # punyamu sendiri
export PORTAINER_TLS_VERIFY=false       # sertifikat self-signed
```

> **Status 17 Sep 2026: API key yang lama sudah tidak sah** (`401 Invalid JWT`).
> Server Portainer sendiri sehat. Buat token baru sebelum mencoba deploy.

**Uji semuanya sekaligus** — ini pemeriksaan yang harus dilewati sebelum deploy:

```bash
bash scripts/preflight-portainer.sh
```

Ia memeriksa berurutan (env → jaringan → auth → environment → stack) dan berhenti
di kegagalan pertama sambil memberi tahu cara memperbaikinya. Keluar `0` = aman
deploy. Kalau Claude-mu bilang "tidak bisa deploy", **jalankan ini dulu** sebelum
menebak-nebak.

### Kalau MCP portainer tidak jalan

Dua penyebab, dan keduanya memunculkan `401 Invalid JWT token` yang sama —
preflight di atas membedakannya untukmu:

| Penyebab | Gejala | Perbaikan |
|---|---|---|
| **Env belum di-set** (paling sering) | `PORTAINER_API_KEY` kosong. `.mcp.json` memakai `${PORTAINER_API_KEY}`; kalau kosong, MCP jalan tanpa kredensial. | export ketiga env di atas, lalu **jalankan ulang Claude Code** |
| **Token dicabut/kedaluwarsa** | env terisi tapi server menolak | buat token baru di Portainer → My account → Access tokens, export ulang, jalankan ulang Claude Code |

> **MCP membaca env hanya saat start.** Meng-export env di terminal lain, atau
> setelah Claude Code jalan, tidak berpengaruh. Set dulu → baru buka Claude Code.
> Taruh di `~/.bashrc`/`~/.zshrc` supaya tidak terulang.

Bedakan dari pesan Portainer sendiri:
`"A valid authorization token is missing"` = tidak ada kredensial terkirim;
`"Invalid JWT token"` = terkirim tapi ditolak.

---

## 1. Yang perlu kamu tahu sebelum menyentuh apa pun

### App-nya ada di stack lakehouse, bukan stack platform

```
Internet → Cloudflare Tunnel (dispar-cloudflared, stack dispar-platform)
         → localhost:13031
         → container dispar-v2      ← INI yang kamu deploy
         → lake-clickhouse:8123
```

| Stack | Id | Sumber | Isi |
|---|---|---|---|
| `dispar-lakehouse` | **6** | git, `lakehouse/compose.yaml` | ClickHouse, RustFS, Lakekeeper, **`dispar-v2`** |
| `dispar-platform` | **19** | Web editor (bukan git) | Postgres cadangan, tunnel Cloudflare |

Service `dispar-v2` didefinisikan di **`lakehouse/compose.yaml`**, bukan di
`platform/compose.yaml`. Alasannya: app harus satu network dengan ClickHouse.

### JEBAKAN TERBESAR — dorong ke DUA repo

Stack 6 masih menarik dari repo **lama**. URL repo sebuah stack Portainer tidak
bisa diubah (payload `PUT /api/stacks/{id}/git` tidak punya field
`RepositoryURL`), jadi selama stack itu belum dibuat ulang:

```bash
git push origin main    # DisparDataPlatform — sumber kebenaran
git push lama main      # jakarta-restaurant-data — YANG DITARIK STACK 6
```

**Lupa perintah kedua = redeploy membangun ulang kode lama dan melapor sukses.**
Tidak ada peringatan, tidak ada error. Kamu akan mengira deploy-mu gagal padahal
kodenya memang tidak pernah sampai.

Kalau remote `lama` belum ada di klonmu:

```bash
git remote add lama https://github.com/RantAI-dev/jakarta-restaurant-data.git
```

---

## 2. Sebelum deploy — periksa kodemu

```bash
cd platform-v2
npx tsc --noEmit          # WAJIB lulus
npm run dev               # http://localhost:3032 — buka halaman yang kamu ubah
```

Butuh `.env.local` berisi `CH_*` (salin dari `.env.example`, nilai dari
credentials file). Tanpa itu dev gagal konek — halaman kosong di dev **bukan**
hal normal.

Lalu commit dan dorong ke dua repo (lihat di atas).

---

## 3. Deploy

### Cara termudah: Portainer UI

1. **Stacks → `dispar-lakehouse` → Editor**
2. Centang **Re-pull image and redeploy** ← kalau tidak, image lama dipakai ulang
3. **Update the stack**

UI mengirim Env yang tersimpan secara otomatis, jadi jebakan Env di bawah tidak
berlaku untuk jalur ini. Ini jalur yang disarankan.

### Cara API

```bash
# 1. AMBIL Env apa adanya — WAJIB, lihat jebakan #1
curl -sk -H "X-API-Key: $PORTAINER_API_KEY" \
  "$PORTAINER_URL/api/stacks/6" | jq '.Env' > /tmp/stack6-env.json

# 2. Redeploy, kirim Env LENGKAP + paksa build ulang image
curl -sk -X PUT -H "X-API-Key: $PORTAINER_API_KEY" -H "Content-Type: application/json" \
  "$PORTAINER_URL/api/stacks/6/git/redeploy?endpointId=3" \
  -d "$(jq -n --slurpfile env /tmp/stack6-env.json \
        '{Env:$env[0], RepositoryReferenceName:"refs/heads/main", RepullImageAndRedeploy:true, Prune:false}')"
```

Kalau image `dispar-v2:latest` tetap tidak dibangun ulang, hapus paksa lalu ulangi:

```bash
curl -sk -X DELETE -H "X-API-Key: $PORTAINER_API_KEY" \
  "$PORTAINER_URL/api/endpoints/3/docker/containers/dispar-v2?force=true"
curl -sk -X DELETE -H "X-API-Key: $PORTAINER_API_KEY" \
  "$PORTAINER_URL/api/endpoints/3/docker/images/dispar-v2:latest?force=true"
```

---

## 4. Tiga jebakan yang pernah menjatuhkan produksi

1. **Redeploy lewat API WAJIB mengirim `Env` lengkap.** Kalau tidak, compose
   jatuh ke nilai default (`lakemeta`/`disparch`/`disparapp`), Lakekeeper gagal
   auth ke volume Postgres lama, dan **ClickHouse + katalog ikut mati** — bukan
   cuma app-nya. Selalu `GET /api/stacks/6` dulu.
2. **Image tidak dibangun ulang kalau image lama masih ada.** Tanpa
   `RepullImageAndRedeploy` (atau hapus image dulu), deploy jadi **no-op yang
   terlihat sukses**.
3. **`PORT: 3032` wajib ada di environment compose `dispar-v2`.** Dockerfile
   menetapkan `PORT=3000`; kalau tidak diselaraskan, container berstatus
   "running" tapi tidak ada yang mendengar.

Tambahan: port **13031** hanya bisa dipegang satu container. `dispar-v2`
memegangnya; `dispar-app` (v1) harus tetap tanpa published port.

---

## 5. Verifikasi — "running" BUKAN bukti

```bash
curl -s -o /dev/null -w "publik    : %{http_code}\n" https://dispar.rantai.dev/
curl -s -o /dev/null -w "LAN 13032 : %{http_code}\n" http://192.168.18.187:13032/
```

Keduanya harus `200`. Lalu **buka halaman yang kamu ubah** dan pastikan
perubahanmu benar-benar terlihat.

Cek cepat apakah kode yang tayang benar-benar versi barumu — bandingkan menu
situs dengan `components/Nav.tsx`:

```bash
curl -s https://dispar.rantai.dev/ | grep -oE 'href="/[a-z0-9-]*"[^>]*>[^<]{1,24}'
```

Kalau menunya tertinggal dari repo, kodemu tidak sampai — hampir pasti lupa
`git push lama main`.

Pastikan juga lakehouse tidak ikut terganggu:

```bash
curl -s -o /dev/null -w "clickhouse: %{http_code}\n" http://192.168.18.187:18123/ping
curl -s -o /dev/null -w "dagster   : %{http_code}\n" http://192.168.18.187:13030/
```

---

## 6. Kalau rusak

| Gejala | Kemungkinan | Tindakan |
|---|---|---|
| Perubahan tidak muncul, semua `200` | lupa `git push lama main`, atau image tidak dibangun ulang | dorong ke repo lama, deploy ulang dengan `RepullImageAndRedeploy` |
| Container "running" tapi tak menjawab | `PORT` tidak 3032 | perbaiki environment compose, redeploy |
| ClickHouse/katalog mati sesudah deploy | `Env` tidak terkirim | redeploy lagi dengan Env lengkap dari `GET /api/stacks/6` |
| Situs publik mati, app LAN hidup | tunnel | periksa container `dispar-cloudflared` (stack 19) |
| Port 13031 bentrok | `dispar-app` v1 mem-publish port | hentikan `dispar-app` |

**Rollback:** deploy ulang dari commit sebelumnya —
`git revert <commit> && git push origin main && git push lama main`, lalu
redeploy. Tidak ada tombol rollback di Portainer untuk stack git.

---

## 7. Batas yang sudah diketahui — jangan buang waktu

- **URL repo stack tidak bisa diubah.** Dikirim pun diabaikan diam-diam
  (`ReferenceName` berubah, URL tidak). Satu-satunya cara pindah = hapus & buat
  ulang stack.
- **Menghapus stack TIDAK menghapus named volume** selama `removeVolumes` bukan
  `true` (sudah diuji langsung). Membuat ulang dengan **nama stack sama persis**
  menyambungkan volume kembali.
- **Operasi stack sering balas timeout padahal berhasil di server.** Jangan
  mengulang perintahnya — periksa keadaan dulu (daftar stack + container), baru
  putuskan.
- **`lake-dagster` (:13030) jalan di luar stack.** Redeploy stack 6 tidak
  menyentuhnya, dan compose tidak akan membuatnya ulang kalau terhapus. Ia juga
  tidak punya volume — riwayat run ada di dalam container, jadi **jangan dibuat
  ulang**; kalau network-nya berubah cukup:
  `docker network connect dispar-lakehouse_lakenet lake-dagster`.
- **JANGAN menghapus stack** kecuali kamu yakin bisa membuatnya kembali. Pernah
  terjadi: stack dihapus, gagal dibuat ulang, situs publik mati.

---

## 8. Utang yang belum ditutup (per 17 Sep 2026)

- **Situs live tertinggal dari repo.** Container `dispar-v2` dibangun dari commit
  `660d773`; menu `/ai` dan `/scraped-hotels` sudah ada di repo tapi **404** di
  produksi. Deploy pertamamu akan memunculkannya.
- **`LLM_KEY` belum di-set di stack 6** → halaman `/ai` akan tampil tapi setiap
  pertanyaan error. Isi env itu dulu kalau tidak mau menu mati terlihat pengguna.
- **Belum ada CI/CD.** Semua deploy manual lewat runbook ini.
- **Auto-update stack mati** — memang disengaja. Push tidak pernah men-deploy
  sendiri.
