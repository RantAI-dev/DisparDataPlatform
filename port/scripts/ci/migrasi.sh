#!/usr/bin/env bash
# Job `migrasi-xe21` CI: migration naik-turun-naik di Oracle XE 21 (kompatibilitas maju, SPEC §6).
set -euo pipefail
CI_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$CI_DIR/../../backend"
"$CI_DIR/tunggu-oracle.sh"
composer install --no-interaction --no-progress --prefer-dist
[[ -f .env ]] || cp .env.example .env
php artisan key:generate --force
php artisan migrate:fresh --seed --force
php artisan migrate:rollback --force
php artisan migrate --force
