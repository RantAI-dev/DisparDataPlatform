#!/usr/bin/env bash
# Tunggu Oracle service menerima login aplikasi (service CI tidak selalu punya healthcheck).
# Env: DB_HOST, DB_PORT (1521), DB_SERVICE_NAME, DB_USERNAME, DB_PASSWORD. Maks ±10 menit.
set -euo pipefail
for _ in $(seq 1 120); do
  if php -r 'exit(@oci_connect(getenv("DB_USERNAME"), getenv("DB_PASSWORD"), "//".getenv("DB_HOST").":".(getenv("DB_PORT") ?: 1521)."/".getenv("DB_SERVICE_NAME")) ? 0 : 1);'; then
    echo "Oracle siap"
    exit 0
  fi
  sleep 5
done
echo "Oracle tidak siap dalam batas waktu" >&2
exit 1
