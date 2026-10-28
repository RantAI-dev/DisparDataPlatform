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

# frontend
cd frontend && npm ci && npm run lint && npx nuxt typecheck && npx vitest run
```

Vitest punya tiga project: `unit` (fungsi murni), `nuxt` (composable di runtime Nuxt), dan
`nitro` (membangun Nuxt lalu menguji server sungguhan: proxy `/_api`, redirect lama, halaman
error). `npm run lint` menjaga pemisahan layer (SPEC §5.3); Playwright ditambahkan bersama CI.

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
