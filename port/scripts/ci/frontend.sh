#!/usr/bin/env bash
# Job `frontend` CI: eslint (pemisahan layer), typecheck, Vitest (unit/nuxt/nitro), perkakas fixture.
set -euo pipefail
cd "$(dirname "$0")/../../frontend"
npm ci --no-audit --no-fund
npm run lint
npx nuxt typecheck
# Cakupan (plan 18): coverage/coverage-summary.json dibaca scripts/dokumen/bangun.py.
npx vitest run --reporter=default --reporter=junit --outputFile.junit=test-results/vitest-junit.xml --coverage
node --test ../tools/fixture-server/*.test.mjs
