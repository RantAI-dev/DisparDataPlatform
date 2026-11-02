# Berkontribusi ke portal

## Alur

1. Satu branch per plan atau perbaikan, dari `main`.
2. Jalankan gate lokal (di bawah) sampai hijau.
3. Buka PR. CI menjalankan job yang sama; PR baru digabung setelah hijau dan direview.

Pesan commit dan dokumen dalam Bahasa Indonesia, bentuk `type(scope): ringkasan`
(Conventional Commits), mis. `feat(dataset): rute baris dataset`.

## Gate lokal

```bash
# backend (Oracle harus jalan; tes memakai Oracle, bukan sqlite)
docker compose -f compose.dev.yaml up -d oracle fixture-server
docker compose -f compose.dev.yaml run --rm backend sh -c \
  'composer install && vendor/bin/pint --test && vendor/bin/pest'

# perkakas fixture
node --test tools/fixture-server/*.test.mjs

# dump Oracle bisa diterapkan + fitur Oracle terlarang (SPEC §6)
scripts/oracle-dump.sh --cek && scripts/cek-oracle-terlarang.sh

# frontend
cd frontend && npm ci && npm run lint && npx nuxt typecheck && npx vitest run

# e2e (Laravel + fixture-server; skrip yang sama dengan CI)
bash scripts/ci/e2e.sh
# atau melawan compose.dev.yaml yang sudah jalan (backend diarahkan ke fixture-server)
cd frontend && E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test

# paritas dengan dispar.rantai.dev (lokal saja; portal memakai Data API lokal berdata hidup)
cd frontend && PORTAL_URL=http://127.0.0.1:3000 npx playwright test -c playwright.parity.config.ts

# dokumen API: setelah mengubah rute/docblock/aturan validasi
docker compose -f compose.dev.yaml exec backend php artisan scramble:export --path=storage/api.json
mv backend/storage/api.json docs/api/laravel-openapi.json && cd frontend && npm run docs:api
```

Fitur baru mengikuti `docs/pola-fitur.md` (urutan kerja, pola backend/frontend, cara memalsukan
Data API, skenario, paritas, dan checklist reviewer).

Vitest punya tiga project: `unit` (fungsi murni), `nuxt` (composable di runtime Nuxt), dan
`nitro` (membangun Nuxt lalu menguji server sungguhan: proxy `/_api`, redirect lama, halaman
error). `npm run lint` menjaga pemisahan layer (SPEC §5.3). Playwright (`tests/e2e`) membuka
galeri `/_kerangka`, redirect lama, dan halaman 404; isi `NUXT_LARAVEL_URL`,
`NUXT_FRONTEND_TOKEN`, dan `E2E_LARAVEL_URL` untuk ikut menguji kesehatan backend.

## CI

`.github/workflows/ci.yml` (selama di GitHub) dan `.gitlab-ci.yml` (GitLab Disparekraf) menjalankan
job yang sama; perintahnya ada di `scripts/ci/*.sh` supaya keduanya tidak menyimpang:

| Job | Isi |
|---|---|
| `backend` | pint + Pest di image `backend/Dockerfile`, Oracle XE 18 sebagai service; dump bisa diterapkan; grep fitur terlarang |
| `migrasi-xe21` | `migrate:fresh --seed`, rollback, migrate di Oracle XE 21 |
| `frontend` | eslint, typecheck, Vitest, tes perkakas fixture |
| `e2e` | Nuxt build + Playwright |

Di GitLab, image PHP dibangun sekali per commit (`image-php`) ke registry proyek; cek dump memakai
image Oracle yang sama sebagai klien sqlplus.

## Aturan yang dijaga tes

- **Frontend** (SPEC §5.3, `eslint.config.mjs` + `tests/unit/arsitektur.spec.ts`): layer fitur tidak
  mengimpor layer fitur lain; `shared` tidak mengimpor fitur; `pages/` tidak memanggil
  `$fetch`/`useFetch`. Layer fitur baru wajib ditambahkan ke `LAYER_FITUR`.

- **Backend** (SPEC §4.3, `backend/tests/Arch`): fitur tidak memakai fitur lain; `Shared` tidak
  memakai fitur; controller hanya memakai Request, Service, Resource; hanya `Sources/` yang memakai
  `DataApiClient`; tidak ada DB/Eloquent di fitur selain `Sistem`; tidak ada rute PATCH; `env()`
  hanya di `config/`.
- **Data API**: `data` diteruskan mentah. Fixture baru direkam dari Data API lokal dengan
  `tools/fixture-server/rekam.mjs`, bukan ditulis tangan.
- **Tanpa secret di repo.** Token dan sandi produksi hanya ada di env server.
