#!/usr/bin/env bash
# Laravel untuk job e2e (plan 11): skema bersih + akun layanan, token frontend ditulis ke berkas,
# lalu `artisan serve` di 127.0.0.1:18000. Data API = fixture-server (DATA_API_URL).
# Env: DB_* (Oracle service), DATA_API_URL, TOKEN_BERKAS, LARAVEL_HOST (bawaan 127.0.0.1).
set -euo pipefail
CI_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$CI_DIR/../../backend"
export DB_USERNAME="${DB_USERNAME:-portal_test}" DB_PASSWORD="${DB_PASSWORD:-portal_test}"
"$CI_DIR/tunggu-oracle.sh"
composer install --no-interaction --no-progress --prefer-dist
# `artisan serve` tidak meneruskan env proses ke worker server; nilainya ditulis ke .env.
[[ -f .env ]] || cp .env.example .env
for v in DB_CONNECTION DB_HOST DB_PORT DB_SERVICE_NAME DB_SERVER_VERSION DB_USERNAME DB_PASSWORD DATA_API_URL; do
  sed -i "/^$v=/d" .env
  echo "$v=${!v}" >> .env
done
# e2e jauh melampaui 120 permintaan/menit dari satu klien.
sed -i '/^PORTAL_BATAS_PER_MENIT=/d; /^DATA_API_TOKEN=/d' .env
printf 'PORTAL_BATAS_PER_MENIT=100000\nDATA_API_TOKEN=token-fixture\n' >> .env
php artisan key:generate --force
php artisan migrate:fresh --force
php artisan db:seed --force --class='App\Shared\Auth\ServiceAccountSeeder'
php artisan portal:token frontend read | grep -E '^[0-9]+\|' > "$TOKEN_BERKAS"
exec env PHP_CLI_SERVER_WORKERS=4 php artisan serve --host="${LARAVEL_HOST:-127.0.0.1}" --port=18000
