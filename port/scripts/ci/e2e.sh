#!/usr/bin/env bash
# Job `e2e` CI: Nuxt hasil build + Playwright (tests/e2e). Rute API yang belum ada di Laravel
# (plan 11+) dipalsukan di tes; E2E_LARAVEL_URL kosong → tes kesehatan backend dilewati.
set -euo pipefail
cd "$(dirname "$0")/../../frontend"
npm ci --no-audit --no-fund
[[ "${PLAYWRIGHT_SUDAH_ADA:-}" == "1" ]] || npx playwright install --with-deps chromium
npx nuxt build
CI=1 npx playwright test
