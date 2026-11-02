#!/usr/bin/env bash
# Bangun ulang dokumen serah terima (plan 18, SPEC §8) lalu ekspor ke PDF (+ DOCX manual book).
#
#   scripts/ekspor-dokumen.sh              # dari port/ atau dari mana saja
#   EKSPOR_TANPA_PDF=1 scripts/ekspor-dokumen.sh   # hanya bangun ulang + pemeriksaan
#
# Langkah:
#   1. OpenAPI Laravel diekspor ulang dari kode (Scramble) bila PHP tersedia: `php` lokal, atau image
#      backend (PORTAL_PHP_IMAGE, bawaan dispar-portal-php:dev dari compose.dev.yaml) tanpa jaringan.
#      Tanpa keduanya, ekspor yang di-commit dipakai apa adanya. Tidak butuh Oracle/Data API.
#   2. scripts/dokumen/bangun.py: ERD, kamus data, unit-testing.md, skenario tes Data API, salinan
#      OpenAPI. GAGAL (exit 1) bila ada skenario tanpa tes, rute tanpa flowchart, atau dump DDL ≠
#      migration — ekspor tidak dilanjutkan.
#   3. Mermaid → PNG (mermaid-cli, versi disematkan, lewat npx), Markdown → HTML (pandoc) → PDF
#      (Chrome/Chromium headless). Manual book juga → DOCX. Keluaran: docs/_build/ (di-gitignore).
#
# Kebutuhan: python3 + PyYAML, pandoc ≥ 3, Node/npx, Chrome atau Chromium (CHROME=… untuk memilih).
set -euo pipefail

cd "$(dirname "$0")/.."
PORT_DIR="$PWD"
BUILD="$PORT_DIR/docs/_build"
MMDC_VERSI="11.17.0"
PHP_IMAGE="${PORTAL_PHP_IMAGE:-dispar-portal-php:dev}"

# --- 1. OpenAPI Laravel ---------------------------------------------------------------------------
ekspor_openapi() {
  local env_php=(APP_NAME="Portal Disparekraf" APP_KEY="base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    CACHE_DRIVER=array DB_CONNECTION=sqlite LOG_CHANNEL=stderr)
  local tmp
  tmp="$(mktemp)"
  if command -v php >/dev/null && [[ -f backend/vendor/autoload.php ]]; then
    (cd backend && env "${env_php[@]}" php artisan scramble:export --path="$tmp" >/dev/null)
  elif command -v docker >/dev/null && docker image inspect "$PHP_IMAGE" >/dev/null 2>&1 && [[ -f backend/vendor/autoload.php ]]; then
    local e=() kv
    for kv in "${env_php[@]}"; do e+=(-e "$kv"); done
    docker run --rm --network none -u "$(id -u):$(id -g)" -v "$PORT_DIR/backend":/app -w /app "${e[@]}" \
      --entrypoint sh "$PHP_IMAGE" -c 'php artisan scramble:export --path=/tmp/api.json >/dev/null && cat /tmp/api.json' >"$tmp"
  else
    echo "lewati ekspor Scramble: php/image $PHP_IMAGE tidak ada; pakai docs/api/laravel-openapi.json yang di-commit"
    rm -f "$tmp"
    return
  fi
  if ! cmp -s "$tmp" docs/api/laravel-openapi.json; then
    mv "$tmp" docs/api/laravel-openapi.json
    echo "docs/api/laravel-openapi.json diperbarui dari kode (jalankan juga: cd frontend && npm run docs:api)"
  else
    rm -f "$tmp"
  fi
}
ekspor_openapi

# --- 2. Bagian yang dihasilkan + pemeriksaan ------------------------------------------------------
python3 scripts/dokumen/bangun.py

[[ -n "${EKSPOR_TANPA_PDF:-}" ]] && exit 0

# --- 3. PDF / DOCX --------------------------------------------------------------------------------
cari_chrome() {
  if [[ -n "${CHROME:-}" ]]; then echo "$CHROME"; return; fi
  local c
  for c in google-chrome chromium chromium-browser; do
    command -v "$c" >/dev/null && { command -v "$c"; return; }
  done
  # Chromium bawaan Playwright (frontend/node_modules/@playwright/test).
  c="$(find "$HOME/.cache/ms-playwright" -path '*/chromium-*/chrome-linux*/chrome' -type f 2>/dev/null | sort -V | tail -1)"
  [[ -n "$c" ]] && { echo "$c"; return; }
  echo "Chrome/Chromium tidak ditemukan; set CHROME=/path/ke/chrome" >&2
  exit 1
}
CHROME_BIN="$(cari_chrome)"
command -v pandoc >/dev/null || { echo "pandoc tidak ditemukan" >&2; exit 1; }

rm -rf "$BUILD"
mkdir -p "$BUILD/tmp"
printf '{"executablePath": "%s", "args": ["--no-sandbox"]}\n' "$CHROME_BIN" >"$BUILD/tmp/puppeteer.json"

mmdc() {
  PUPPETEER_SKIP_DOWNLOAD=1 npx -y "@mermaid-js/mermaid-cli@$MMDC_VERSI" \
    -p "$BUILD/tmp/puppeteer.json" -e png -w 1100 -s 2 -b white -q "$@"
}

# dokumen <nama> <judul> <berkas.md…>: render Mermaid per berkas, gabung, tulis <nama>.pdf.
# Per berkas, bukan sekali untuk gabungan: mermaid-cli merender semua diagram satu berkas di satu
# halaman Chrome, dan gabungan belasan diagram bisa melewati batas waktu screenshot puppeteer.
dokumen() {
  local nama="$1" judul="$2"
  shift 2
  local jadi="$BUILD/tmp/$nama.mmd.md" i=0 f bagian
  : >"$jadi"
  for f in "$@"; do
    i=$((i + 1))
    bagian="$BUILD/tmp/$nama-$i.md"
    # Komentar HTML (penanda blok hasil) dibuang supaya tidak tampil sebagai teks.
    sed '/^<!-- .* -->$/d' "$f" >"$bagian"
    if grep -q '^```mermaid' "$bagian"; then
      mmdc -i "$bagian" -o "$BUILD/tmp/$nama-$i.mmd.md" >/dev/null
      bagian="$BUILD/tmp/$nama-$i.mmd.md"
    fi
    cat "$bagian" >>"$jadi"
    printf '\n\n' >>"$jadi"
  done
  local sumber_gambar
  sumber_gambar="$BUILD/tmp:$(dirname "$1")"
  pandoc "$jadi" -f gfm -s --toc --toc-depth=2 --embed-resources --resource-path="$sumber_gambar" \
    --css scripts/dokumen/cetak.css --metadata title="$judul" --metadata lang=id -o "$BUILD/tmp/$nama.html"
  "$CHROME_BIN" --headless=new --no-sandbox --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$BUILD/$nama.pdf" "file://$BUILD/tmp/$nama.html" 2>/dev/null
  echo "ditulis: docs/_build/$nama.pdf"
}

dokumen data-diagram "Data diagram portal" docs/data-diagram.md
dokumen flowchart "Flowchart portal" docs/flowchart/README.md \
  docs/flowchart/{beranda,dataset,dashboard,indikator,atlas,gmti,spasial,hotel-scraped,autentikasi,sinkron,log-history}.md
dokumen unit-testing "Unit testing portal" docs/unit-testing.md
# Paket deploy (plan 19) ikut manual book bila ada di checkout ini.
MANUAL=(docs/manual-book/{pengguna,admin,operasi}.md)
[[ -f deploy/README.md ]] && MANUAL+=(deploy/README.md)
dokumen manual-book "Manual book portal" "${MANUAL[@]}"
dokumen api "Dokumentasi API portal" docs/api/README.md
dokumen data-api "Data API (pelengkap)" docs/data-api/README.md docs/data-api/skenario-tes.md
# Laporan paritas terbaru (plan 17, SPEC §7): lampiran wajib serah terima.
paritas="$(ls docs/paritas/laporan-*.md 2>/dev/null | sort | tail -1)"
[[ -n "$paritas" ]] && dokumen paritas "Laporan paritas portal" "$paritas"

pandoc "$BUILD/tmp/manual-book.mmd.md" -f gfm --toc --resource-path="docs/manual-book:$BUILD/tmp" \
  --metadata title="Manual book portal" --metadata lang=id -o "$BUILD/manual-book.docx"
echo "ditulis: docs/_build/manual-book.docx"
rm -rf "$BUILD/tmp"
