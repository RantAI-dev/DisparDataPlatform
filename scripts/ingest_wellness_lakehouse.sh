#!/usr/bin/env bash
# Skrip eksekusi ingest dataset wellness-jakarta ke lakehouse Dispar.
# Jalankan dari host server produksi (yang punya /home/alfi/repos/DisparDataPlatform/
# atau path repo Dispar — sesuaikan REPO_PATH di bawah).
#
# Apa yang dilakukan:
#   1. Copy file wellness-jakarta.json ke /tmp di dalam container dispar-lake-dagster
#      (image dispar-lake-dagster:latest sudah punya package dispar_ingest pre-installed).
#   2. Trigger secondary_ingest lewat env yang sudah di-set di container dispar-lake-dagster.
#   3. Tunggu selesai, print logs.
#
# Prasyarat:
#   - Container dispar-lake-dagster running (image dispar-lake-dagster:latest)
#   - Image dispar-lake-dagster sudah built (sudah ada dispar_ingest terinstall)
#   - User punya akses docker di host (sudo / docker group)
#
# Usage:
#   bash scripts/ingest_wellness_lakehouse.sh
#
# Setelah sukses, verifikasi via:
#   curl -sS "http://192.168.18.187:18123/?user=dispar&password=$CH_PASSWORD" \
#     --data-binary "SELECT count() FROM bronze_sec.wellness_jakarta"

set -euo pipefail

CONTAINER="lake-dagster"
WELLNESS_FILE="/home/alfi/repos/DisparDataPlatform/data/sekunder/wellness-jakarta.json"
TARGET_DIR_IN_CONTAINER="/repo/data/sekunder"
TARGET_FILE_IN_CONTAINER="${TARGET_DIR_IN_CONTAINER}/wellness-jakarta.json"

echo "[1/4] Verifikasi container dispar-lake-dagster running..."
docker ps --format '{{.Names}}\t{{.Image}}' | grep -E "^${CONTAINER}\s" || {
  echo "ERROR: container $CONTAINER tidak running."
  exit 1
}

echo "[2/4] Verifikasi file sumber ada di host..."
test -f "$WELLNESS_FILE" || {
  echo "ERROR: $WELLNESS_FILE tidak ditemukan. Sesuaikan path."
  exit 1
}

echo "[3/4] Upload wellness-jakarta.json ke container ${CONTAINER}:${TARGET_FILE_IN_CONTAINER}..."
# Buat tar archive berisi path relatif target_dir/wellness-jakarta.json
TMP_TAR=$(mktemp /tmp/wellness-upload.XXXXXX.tar)
trap "rm -f $TMP_TAR" EXIT
TMP_DIR=$(mktemp -d /tmp/wellness-upload.XXXXXX)
trap "rm -rf $TMP_DIR $TMP_TAR" EXIT
mkdir -p "$TMP_DIR/data/sekunder"
cp "$WELLNESS_FILE" "$TMP_DIR/data/sekunder/wellness-jakarta.json"
(cd "$TMP_DIR" && tar -cf "$TMP_TAR" data/sekunder/wellness-jakarta.json)

# Upload via docker cp
docker cp "$TMP_TAR" "${CONTAINER}:/tmp/wellness-upload.tar"
docker exec "$CONTAINER" mkdir -p "$TARGET_DIR_IN_CONTAINER"
docker exec "$CONTAINER" tar -xf /tmp/wellness-upload.tar -C /
docker exec "$CONTAINER" rm /tmp/wellness-upload.tar
echo "  Uploaded."

echo "[4/4] Jalankan secondary_ingest di dalam container ${CONTAINER}..."
# Env values sudah di-set di container dispar-lake-dagster (CH_PASSWORD, S3_*, dll).
# Jadi tidak perlu set env tambahan.
docker exec "$CONTAINER" python -m dispar_ingest.secondary_ingest /repo/data/sekunder 2>&1 | tee /tmp/secondary-ingest-wellness.log

echo ""
echo "=== Selesai ==="
echo "Log lengkap: /tmp/secondary-ingest-wellness.log"
echo ""
echo "Verifikasi count:"
echo "  curl -sS 'http://192.168.18.187:18123/?user=dispar&password=\$CH_PASSWORD' \\"
echo "    --data-binary 'SELECT count() FROM bronze_sec.wellness_jakarta FORMAT TSV'"