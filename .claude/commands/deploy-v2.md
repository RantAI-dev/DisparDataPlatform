---
description: Deploy app dispar-v2 ke server Portainer 187 (build ulang image + redeploy stack 6)
---

Deploy `platform-v2/` ke produksi. Gunakan agen `deploy-portainer`.

Jalankan berurutan, **berhenti dan lapor kalau ada langkah yang gagal**:

1. **Pastikan kode sudah aman**
   - `cd platform-v2 && npx tsc --noEmit` harus lulus.
   - Semua perubahan sudah di-commit dan **di-push ke branch
     `deploy/portainer-selfhost`** — stack menarik dari git, bukan dari mesin lokal.

2. **Rekam keadaan sekarang** (untuk rollback)
   - `StackInspect` stack **6** → simpan `.Env` **lengkap** dan catat
     `GitConfig.ConfigHash` yang sedang jalan.

3. **Paksa rebuild image**
   - Hapus container `dispar-v2`, lalu `DELETE /images/dispar-v2:latest` lewat
     `docker_proxy`. Tanpa ini image lama dipakai ulang dan deploy jadi no-op.

4. **Redeploy stack 6**
   - `StackGitRedeploy` id `6`, endpoint `3`, **sertakan `Env` lengkap** dari
     langkah 2. Kalau `Env` tidak dikirim, ClickHouse + katalog akan mati.
   - Pastikan `PORT: 3032` ada di environment service `dispar-v2`.

5. **Verifikasi sungguhan**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://192.168.18.187:13032/
   curl -s -o /dev/null -w "%{http_code}\n" https://dispar.rantai.dev/
   ```
   Keduanya harus `200`. Status container "running" saja **tidak cukup**.

6. **Lapor** — commit apa yang ter-deploy, dan hasil kedua curl di atas.

Kalau produksi rusak: redeploy ulang dari commit sebelumnya (langkah 2 mencatat
`ConfigHash`-nya), lalu laporkan apa yang terjadi.
