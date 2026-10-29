#!/usr/bin/env bash
# Job `e2e` CI: Nuxt hasil build + Playwright (tests/e2e) melawan Laravel + Data API palsu
# (fixture-server memutar fixtures/data-api). Laravel dijalankan LARAVEL_JALAN (bawaan:
# scripts/ci/laravel-e2e.sh langsung; GitHub menjalankannya di image PHP lewat `docker run`).
set -euo pipefail
AKAR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$AKAR/frontend"
npm ci --no-audit --no-fund
[[ "${PLAYWRIGHT_SUDAH_ADA:-}" == "1" ]] || npx playwright install --with-deps chromium
npx nuxt build

export TOKEN_BERKAS="${TOKEN_BERKAS:-$AKAR/frontend/.e2e-token}" DATA_API_URL="http://127.0.0.1:18090"
rm -f "$TOKEN_BERKAS"
PORT=18090 node "$AKAR/tools/fixture-server/putar.mjs" &
(cd "$AKAR" && ${LARAVEL_JALAN:-bash scripts/ci/laravel-e2e.sh}) &
trap 'kill $(jobs -p) 2>/dev/null || true' EXIT

for _ in $(seq 1 120); do
  [[ -s "$TOKEN_BERKAS" ]] && curl -fsS --max-time 5 -o /dev/null http://127.0.0.1:18000/api/v1/sistem/kesehatan && break
  sleep 5
done
NUXT_FRONTEND_TOKEN="$(cat "$TOKEN_BERKAS")"
export NUXT_FRONTEND_TOKEN NUXT_LARAVEL_URL=http://127.0.0.1:18000 E2E_LARAVEL_URL=http://127.0.0.1:18000
CI=1 npx playwright test
