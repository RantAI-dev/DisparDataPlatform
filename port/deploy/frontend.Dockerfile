# Image produksi frontend (SPEC §9): Nuxt 4 hasil `nuxt build`, dijalankan Node 20 dari `.output`.
# Bangun dari folder port/:
#   docker build -f deploy/frontend.Dockerfile -t dispar-portal-frontend .
# Versi Node sama dengan scripts/ci/pasang-node.sh.

# --- build -------------------------------------------------------------------------------------
FROM node:20.20.2-bookworm-slim AS build
WORKDIR /app
# Dependensi dulu (layer cache). Skrip install (`nuxt prepare`) butuh kode, jadi dilewati di sini;
# `nuxt build` menyiapkan ulang semuanya.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY frontend/ ./
RUN npx nuxt build

# --- runtime -----------------------------------------------------------------------------------
# `.output` sudah membawa node_modules yang dipakai server; tidak ada npm install di sini.
FROM node:20.20.2-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /app/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
