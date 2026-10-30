#!/usr/bin/env bash
# Job `frontend` CI: eslint (pemisahan layer), typecheck, Vitest (unit/nuxt/nitro), perkakas fixture.
set -euo pipefail
cd "$(dirname "$0")/../../frontend"
npm ci --no-audit --no-fund
npm run lint
npx nuxt typecheck
npx vitest run --reporter=default --reporter=junit --outputFile.junit=test-results/vitest-junit.xml
node --test ../tools/fixture-server/*.test.mjs
