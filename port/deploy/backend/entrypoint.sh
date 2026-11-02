#!/bin/bash
# Entrypoint image backend (deploy/backend.Dockerfile).
#
#   tanpa argumen    php-fpm + nginx (web, port 8080)
#   dengan argumen   jalankan perintah itu, mis. `php artisan schedule:work` (scheduler) atau
#                    `php artisan migrate --force`
#
# config:cache dan route:cache dibuat di sini, bukan saat build: nilai config (DB_*, DATA_API_*,
# APP_KEY) baru ada sebagai env saat container start, dan image yang sama dipakai di server mana pun.
# Boot Laravel membuka koneksi Oracle (store cache), jadi container gagal start bila Oracle tak
# terjangkau. stdout keduanya dibuang supaya `$(docker compose run ... portal:token ...)` bersih.
set -euo pipefail
cd /var/www/backend

php artisan config:cache >/dev/null
php artisan route:cache >/dev/null

if [[ $# -gt 0 ]]; then
  exec "$@"
fi

php-fpm &
nginx -g 'daemon off;' &

# `docker stop` (SIGTERM): hentikan keduanya dengan anggun (SIGQUIT = graceful bagi nginx dan
# php-fpm), lalu keluar 0.
# shellcheck disable=SC2329 # dipanggil lewat trap
berhenti() {
  # shellcheck disable=SC2046 # satu PID per kata
  kill -QUIT $(jobs -p) 2>/dev/null || true
  wait || true
  exit 0
}
trap berhenti TERM INT

# Satu proses mati sendiri → hentikan yang lain dan keluar, supaya Docker me-restart container.
status=0
wait -n || status=$?
# shellcheck disable=SC2046 # satu PID per kata
kill -TERM $(jobs -p) 2>/dev/null || true
wait || true
exit "$status"
