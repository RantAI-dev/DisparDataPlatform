# Deploy — app dispar-v2 (Portainer self-host)

App ini **tidak** di-deploy ke Vercel. Ia berjalan sebagai container di server
Docker `192.168.18.187`, dikelola Portainer.

> Berkas `vercel.json` yang masih ada di direktori ini adalah sisa warisan dari
> v1 dan tidak dipakai.

## Tempatnya di server

Service `dispar-v2` didefinisikan di **`../lakehouse/compose.yaml`**, bagian dari
Portainer stack **`dispar-lakehouse` (Id 6)** — bukan stack `dispar-platform`.
Alasannya: app harus berada di network `lakenet` supaya bisa menjangkau
`lake-clickhouse`.

```
Internet → Cloudflare Tunnel (dispar-cloudflared) → localhost:13031
         → dispar-v2 (Next standalone, PORT=3032) → lake-clickhouse:8123
```

| Hal | Nilai |
|---|---|
| Stack | `dispar-lakehouse`, Id **6**, endpoint **3** |
| Compose | `lakehouse/compose.yaml`, service `dispar-v2` |
| Branch git | **`main`** |
| Repo yang ditarik stack | **repo LAMA** `RantAI-dev/jakarta-restaurant-data` (URL stack tak bisa diubah) |
| Image | `dispar-v2:latest` (di-build di server dari `../platform-v2`) |
| Port | `13031` (dilihat publik lewat tunnel) dan `13032` (akses langsung LAN) |
| Auto-update | **mati** — push saja tidak men-deploy apa pun |

## Langkah deploy

Cara termudah: jalankan **`/deploy-v2`** dari Claude Code. Manualnya:

1. `npx tsc --noEmit` lulus; commit; **push ke `main` DAN ke repo lama** (`git push origin main && git push lama main`)
   (stack menarik dari git, bukan dari mesin lokal).
2. Simpan `Env` stack 6 apa adanya: `GET /api/stacks/6` → `.Env`.
3. Paksa rebuild: hapus container `dispar-v2`, lalu
   `DELETE /images/dispar-v2:latest`.
4. Redeploy: `PUT /api/stacks/6/git/redeploy?endpointId=3`, **sertakan `Env`
   lengkap** dari langkah 2.
5. Verifikasi — keduanya harus `200`:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://192.168.18.187:13032/
   curl -s -o /dev/null -w "%{http_code}\n" https://dispar.rantai.dev/
   ```

## Tiga jebakan yang pernah menjatuhkan produksi

1. **`Env` wajib dikirim ulang utuh saat redeploy.** Kalau tidak, compose jatuh
   ke nilai default, Lakekeeper gagal auth ke volume Postgres lama, dan
   **ClickHouse + katalog ikut mati** — bukan cuma app-nya.
2. **Image tidak dibangun ulang kalau image lama masih ada.** Wajib hapus dulu,
   kalau tidak deploy jadi no-op yang terlihat sukses.
3. **`PORT: 3032` wajib ada di environment compose.** Dockerfile menetapkan
   `PORT=3000`; tanpa penyelarasan, container "running" tapi tak ada yang
   mendengar.

Tambahan: port **13031** hanya bisa dipegang satu container. `dispar-v2`
memegangnya sekarang — `dispar-app` (v1) harus tetap dalam keadaan berhenti.

## Environment yang dibaca app

| Env | Nilai di container | Keterangan |
|---|---|---|
| `CH_URL` | `http://lake-clickhouse:8123` | ClickHouse di network `lakenet` |
| `CH_USER` | `dispar_app` | read-only |
| `CH_PASSWORD` | dari stack Env `CH_APP_PASSWORD` | |
| `PORT` | `3032` | wajib — lihat jebakan #3 |
| `LLM_URL` / `LLM_MODEL` / `LLM_KEY` | belum di-set | `/ai` belum aktif di produksi sampai diisi |
