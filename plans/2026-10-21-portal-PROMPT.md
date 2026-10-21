Jalankan batch "portal: Data API + portal Nuxt/Laravel untuk server Disparekraf" sesuai WORKFLOW.md.

Baca penuh dulu, berurutan:
1. plans/2026-10-21-portal-00-handoff.md (urutan, fakta terverifikasi, keputusan K-1..K-12, tabel status)
2. plans/2026-10-21-portal-SPEC.md (arsitektur, struktur per fitur, aturan pemisahan, paritas)
3. plans/2026-10-21-portal-KONTRAK.md (rute → fitur → endpoint → sumber)
Inventaris bukti ada di plans/2026-10-21-portal-inventaris/ (A–F). Rujuk bagiannya, jangan menebak perilaku halaman.

Urutan plan:
1. plans/2026-10-21-portal-01-kontrak.md
2. plans/2026-10-21-portal-02-data-api-kerangka.md (needs 01)
3. plans/2026-10-21-portal-03-data-api-dashboard.md (needs 02)
4. plans/2026-10-21-portal-04-data-api-indikator.md (needs 02)
5. plans/2026-10-21-portal-05-data-api-atlas-gmti-spasial.md (needs 02)
6. plans/2026-10-21-portal-06-operasi-deploy-data-api.md: OPERASI produksi, butuh "lanjut deploy"
7. plans/2026-10-21-portal-10-kerangka.md (needs 01 + repo dispar-portal dari pemilik)
8. plans/2026-10-21-portal-11-fitur-dataset.md (needs 10, 02)
9. plans/2026-10-21-portal-12-15-fitur.md: plan 12 (needs 11, 03), 13 (needs 11, 04), 14 dan 15 (needs 11, 05)
10. plans/2026-10-21-portal-16-19-penutup.md: 16 (needs 12–15), 17 (needs 16), 18 (needs 17), 19 (needs 16)

Catatan khusus batch ini:
- Pemilik meminta halaman portal SEMIRIP MUNGKIN, idealnya PERSIS, dengan dispar.rantai.dev (commit 6b858eb). Uji paritas SPEC §7 adalah gate, bukan hiasan. Quirk dan defect ditiru. Hanya P1–P5 di SPEC §5.5 yang diperbaiki; P6 ditiru.
- Setelah plan 05 selesai, BERHENTI dan kirim laporan. Plan 06 (bagian A image Dagster, bagian B container Data API) baru dimulai setelah pemilik menulis "lanjut deploy". Plan 10–19 tidak menunggu ini.
- Sebelum plan 10: berhenti bila repo dispar-portal belum ada. Jangan membuat repo sendiri, jangan membuat repo publik.
- Server Dispar ada di 192.168.18.148. CLAUDE.md dan docs/ masih menulis .187; jangan perbaiki.
- Sebelum plan 06, server hanya boleh dibaca: SELECT/SHOW/DESCRIBE dengan akun dispar dan dispar_app, ditambah GET Portainer untuk membaca Env stack (sandi dispar_app) dan Id. Tidak ada DDL, ingest, trigger job, atau perubahan Portainer.
- Uji panggung Data API memakai akun dispar_app sungguhan, bukan dispar. Profil app_readonly menolak setting sesi dan system.* (SPEC §3.3).
- platform-v2/ TIDAK BOLEH diubah di batch ini. Skrip golden hanya mengimpor modulnya. Cek `git diff --stat -- platform-v2` kosong di setiap PR repo ini.
- Angka di PR harus hasil perintah atau query, bukan perkiraan. Uji "panggung" dijalankan sungguhan terhadap .148 dan keluarannya ditempel.
- Repo ini tidak punya CI. "PR green" = gate lokal plan itu lulus + reviewer APPROVE. Repo portal punya CI (GitHub Actions); di sana "PR green" = CI hijau + reviewer APPROVE.
- Jalur berisiko tinggi (review penuh): lakehouse/compose.yaml, lakehouse/orchestrate/ (plan 06), lakehouse/data-api/data_api/shared/auth.py (terbuka ke internet), backend/app/Shared/ (auth, log, DataApiClient), frontend/server/ (proxy token).
- Dokumentasi otomatis FastAPI (/docs, /openapi.json) wajib mati di produksi. Data API wajib menolak start tanpa token.
- Pesan commit dan PR dalam Bahasa Indonesia, judul type(scope).
- Kedua repo PUBLIK atau akan diserahkan ke pihak lain. Kredensial ClickHouse dibaca dari platform-v2/.env.local saat dipakai; token Data API dan token Sanctum tidak pernah masuk berkas, commit, log PR, atau laporan.
- Setelah merge ke origin, jangan push ke remote `lama`, KECUALI di plan 06 sebagai bagian operasi yang sudah disetujui.

STOP umum: sebelum mulai, `git status` tidak boleh menunjukkan berkas tracked yang termodifikasi (berkas di plans/ dan /tmp boleh).
