# Pindah ke GitLab Disparekraf

Target akhir repo portal adalah GitLab Disparekraf dengan riwayat commit ikut (SPEC §9). Dokumen ini
menjelaskan cara memindahkannya, variabel dan runner yang dibutuhkan CI, serta apa yang dicek di
`.gitlab-ci.yml`.

## Keadaan sekarang

Repo `dispar-portal` belum dibuat. Kode portal tinggal di folder `port/` repo DisparDataPlatform
(publik, GitHub), bercampur dengan lakehouse, app v2, data, dan dokumen lain. SPEC menulis
`git push --mirror`, yang mengandaikan repo portal sudah berdiri sendiri. Karena belum, ada dua
jalan.

## Opsi A — `git push --mirror` repo DisparDataPlatform utuh

```bash
git clone --mirror https://github.com/<org>/DisparDataPlatform.git
cd DisparDataPlatform.git
git push --mirror git@<gitlab-disparekraf>:<grup>/dispar-portal.git
```

Semua riwayat dan semua ref ikut persis. Kekurangannya:

- yang ikut **seluruh** repo: lakehouse, platform-v2, data, notulen, laporan. Itu bukan milik
  portal dan tidak perlu ada di server Kominfo;
- kode portal tetap di subfolder `port/`, padahal GitLab membaca `.gitlab-ci.yml` di akar repo.
  Path konfigurasi CI harus diubah ke `port/.gitlab-ci.yml` (Settings → CI/CD → General
  pipelines), dan setiap job harus `cd port` dulu serta path artifacts diberi awalan `port/`,
  karena semuanya relatif dari akar portal.

## Opsi B — `git subtree split --prefix=port` lalu mirror (disarankan)

`subtree split` membuat riwayat baru yang berisi hanya commit yang menyentuh `port/`, dengan isi
`port/` sebagai akar repo. Hasilnya repo portal yang berdiri sendiri; setelah itu `push --mirror`
dipakai seperti di SPEC.

```bash
# di clone baru, bukan di working copy harian
git clone https://github.com/<org>/DisparDataPlatform.git pindah && cd pindah
git subtree split --prefix=port -b portal          # hash commit berubah

git init -b main ../dispar-portal && cd ../dispar-portal
git pull ../pindah portal
git log --oneline | head                           # riwayat commit portal
ls                                                 # backend/ frontend/ deploy/ docs/ .gitlab-ci.yml …

git remote add gitlab git@<gitlab-disparekraf>:<grup>/dispar-portal.git
git push --mirror gitlab
```

Catatan:

- Hash commit berbeda dari repo asal (riwayat ditulis ulang). Pesan commit, penulis, dan tanggal
  tetap.
- Yang tidak ikut: semua yang di luar `port/`, termasuk `plans/2026-10-21-portal-*` (SPEC dan
  plan). Bila tim GitLab perlu, salin ke `docs/` sebagai commit terpisah setelah pindah.
- `git filter-repo --subdirectory-filter port` memberi hasil yang sama, tetapi perlu dipasang
  terpisah; `subtree` sudah ada di git.
- Bila repo `dispar-portal` di GitHub dibuat lebih dulu (SPEC §9), isi repo itu dengan langkah di
  atas, lalu pindah ke GitLab cukup dengan Opsi A dari repo `dispar-portal` (bukan DisparDataPlatform).

**Rekomendasi: Opsi B.** Repo GitLab hanya berisi portal, `.gitlab-ci.yml` langsung terbaca di
akar, dan tidak ada path yang perlu diubah.

Setelah pindah, perbarui paragraf pembuka `README.md` (kode tidak lagi di `port/`) dan putuskan
apakah `.github/workflows/ci.yml` dipertahankan; GitLab mengabaikannya.

## Variabel CI di GitLab

Pipeline sekarang **tidak membutuhkan secret**:

- `CI_REGISTRY`, `CI_REGISTRY_USER`, `CI_REGISTRY_PASSWORD`, `CI_REGISTRY_IMAGE` disediakan GitLab
  (job `image-php` mendorong image CI ke registry proyek). Container Registry proyek harus aktif.
- `ORACLE_PASSWORD: portal_ci` di `.gitlab-ci.yml` hanya untuk Oracle XE sekali pakai di CI, bukan
  sandi server.
- Data API tidak dipanggil di CI (fixture), jadi token Data API **tidak** dimasukkan ke GitLab.

Bila kelak image deploy di-push ke registry lain, tambahkan di Settings → CI/CD → Variables, dengan
**Masked** dan **Protected** dicentang (nilai diisi pemilik, tidak ditulis di repo):

| Variabel | Isi |
|---|---|
| `DEPLOY_REGISTRY` | alamat registry tujuan |
| `DEPLOY_REGISTRY_USER` | user registry |
| `DEPLOY_REGISTRY_PASSWORD` | sandi/token registry |

## Runner

- **Executor Docker**, `privileged = true` (job `image-php` dan `paket` memakai `docker:27-dind`),
  dan `volumes = ["/certs/client", "/cache"]` supaya TLS dind (`DOCKER_TLS_CERTDIR: /certs`) jalan.
- **Service Oracle XE**: `gvenzl/oracle-xe:18-slim` (job `backend`, `dump-oracle`, `e2e`) dan
  `gvenzl/oracle-xe:21-slim` (`migrasi-xe21`). Masing-masing butuh ±2 GB RAM dan beberapa menit
  sampai siap; image ±2 GB.
- **Memori**: job terberat `e2e` (Oracle + PHP + Node + Chromium) ±4–6 GB. Sarankan runner ≥ 8 GB
  RAM dengan `concurrent = 1` (atau ≥ 16 GB untuk 2), disk ≥ 40 GB untuk image dan cache.
- **Egress runner**: Docker Hub (`docker`, `node`, `php`, `gvenzl/oracle-xe`), packagist dan
  getcomposer.org, registry npm, nodejs.org (`pasang-node.sh`), CDN Playwright (Chromium), dan
  download.oracle.com (Instant Client). Bila Docker Hub diblokir, ganti nama image ke mirror atau
  Dependency Proxy GitLab.

## `.gitlab-ci.yml` setelah pindah

Dengan Opsi B, isi berkas tidak perlu diubah: path `backend`, `deploy/…`, dan `scripts/ci/…` sudah
relatif dari akar portal. Yang dicek:

1. Pipeline editor GitLab (Build → Pipeline editor → Validate) lulus, atau lokal
   `gitlab-ci-local --list` menampilkan job `image-php`, `paket`, `backend`, `dump-oracle`,
   `migrasi-xe21`, `frontend`, `e2e`.
2. `image-php` berhasil push ke registry proyek; job `backend`, `migrasi-xe21`, dan `e2e` menarik
   `$PHP_CI_IMAGE` dari sana.
3. `paket` membangun kedua image deploy tanpa push.
4. Service Oracle siap sebelum batas waktu `scripts/ci/tunggu-oracle.sh` (±10 menit); bila runner
   lambat, naikkan di skrip itu, bukan di job.
5. Laporan JUnit (Pest, Vitest, Playwright) muncul di tab Tests merge request.

Dengan Opsi A, lakukan perubahan path yang disebut di Opsi A (konfigurasi CI, `cd port`, artifacts).
