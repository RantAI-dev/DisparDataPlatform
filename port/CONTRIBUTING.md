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
  'composer install && vendor/bin/pint --test && php artisan migrate:fresh --seed --force && vendor/bin/pest'

# perkakas fixture
node --test tools/fixture-server/*.test.mjs
```

Gate frontend menyusul bersama kerangka frontend (plan 10).

## Aturan yang dijaga tes

- **Backend** (SPEC §4.3, `backend/tests/Arch`): fitur tidak memakai fitur lain; `Shared` tidak
  memakai fitur; controller hanya memakai Request, Service, Resource; hanya `Sources/` yang memakai
  `DataApiClient`; tidak ada DB/Eloquent di fitur selain `Sistem`; tidak ada rute PATCH; `env()`
  hanya di `config/`.
- **Data API**: `data` diteruskan mentah. Fixture baru direkam dari Data API lokal dengan
  `tools/fixture-server/rekam.mjs`, bukan ditulis tangan.
- **Tanpa secret di repo.** Token dan sandi produksi hanya ada di env server.
