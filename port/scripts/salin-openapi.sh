#!/usr/bin/env bash
# Salin ulang kontrak OpenAPI dari repo lakehouse (sumber kebenaran) ke docs/api/, dengan SHA
# sumber di baris pertama. Jalankan dari port/ selama portal masih di repo DisparDataPlatform;
# setelah pindah repo, arahkan SUMBER ke checkout DisparDataPlatform.
set -euo pipefail
cd "$(dirname "$0")/.."
SUMBER="${SUMBER:-..}"
sha=$(git -C "$SUMBER" log -1 --format=%H -- lakehouse/data-api/openapi.yaml lakehouse/data-api/docs/laravel-openapi.draft.yaml)
salin() {
  { echo "# SALINAN dari repo DisparDataPlatform \`$1\` @ $sha."
    echo "# Jangan diedit di sini: ubah sumbernya, lalu salin ulang (scripts/salin-openapi.sh)."
    cat "$SUMBER/$1"; } > "$2"
  echo "disalin: $2"
}
salin lakehouse/data-api/openapi.yaml docs/api/data-api.openapi.yaml
salin lakehouse/data-api/docs/laravel-openapi.draft.yaml docs/api/laravel-openapi.draft.yaml
