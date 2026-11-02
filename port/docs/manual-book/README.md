# Manual book portal

| Bagian | Untuk |
|---|---|
| [pengguna.md](pengguna.md) | pengunjung portal: isi dan cara memakai 26 halaman |
| [admin.md](admin.md) | pengelola: token, log, riwayat job, sinkron, cache |
| [operasi.md](operasi.md) | tim server: env, cron, pemulihan bila Data API mati, rotasi token, ekspor 413 |

Tangkapan layar di `gambar/` dibuat ulang dengan Nuxt yang sedang jalan:

```bash
cd frontend
PORTAL_URL=http://127.0.0.1:3000 npm run tangkapan                    # desktop 1440 × 900
TANGKAPAN_MOBILE=1 PORTAL_URL=http://127.0.0.1:3000 npm run tangkapan # + gambar/mobile/
```

Versi PDF dan DOCX dibangun `scripts/ekspor-dokumen.sh` ke `docs/_build/`.
