#!/usr/bin/env bash
# Job `backend` CI (GitHub & GitLab): pint + Pest di image backend/Dockerfile, Oracle XE 18 sebagai
# service. Tes memaksa skema `portal_test` (phpunit.xml), jadi service dibuat dengan APP_USER itu.
set -euo pipefail
CI_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$CI_DIR/../../backend"
# Artisan (composer post-autoload) sudah membuka koneksi, jadi kredensial diekspor untuk semua langkah.
export DB_USERNAME="${DB_USERNAME:-portal_test}" DB_PASSWORD="${DB_PASSWORD:-portal_test}"
"$CI_DIR/tunggu-oracle.sh"
composer install --no-interaction --no-progress --prefer-dist
[[ -f .env ]] || cp .env.example .env
php artisan key:generate --force
vendor/bin/pint --test
vendor/bin/pest --log-junit storage/logs/pest-junit.xml
# Dokumen API (plan 11): docs/api/laravel-openapi.json = ekspor Scramble terbaru dari kode. Bila
# berbeda, jalankan ulang ekspor lalu `npm run docs:api` di frontend.
php artisan scramble:export --path=storage/api.json
diff -u ../docs/api/laravel-openapi.json storage/api.json
# Migration naik-turun-naik di XE 18 (plan 10 §Test); job migrasi-xe21 mengulanginya di XE 21.
php artisan migrate:fresh --force
php artisan migrate:rollback --force
php artisan migrate --force
